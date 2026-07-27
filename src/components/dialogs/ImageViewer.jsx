import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { Spinner } from "../ui/Spinner.jsx";
import { getImage } from "../../utils/imageStore.js";
import { saveOrShareDataUrl } from "../../utils/download.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/*
 * Pointer-based pinch/pan for the lightbox (the Capacitor WebView has page
 * zoom disabled, so gestures are ours to implement): two-finger pinch, drag
 * to pan when zoomed, double-tap to toggle 2.5x, mouse wheel on desktop.
 */
function useZoomPan({ panWithOnePointer = true } = {}) {
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const tRef = useRef(t);
  tRef.current = t;
  const pointers = useRef(new Map());
  const gest = useRef(null);
  const lastTap = useRef({ time: 0, x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...pointers.current.values()];
      if (pts.length === 2) {
        gest.current = {
          type: "pinch",
          startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
          startScale: tRef.current.scale,
          startX: tRef.current.x,
          startY: tRef.current.y,
        };
      } else if (pts.length === 1 && panWithOnePointer && tRef.current.scale > 1) {
        gest.current = {
          type: "pan",
          px: e.clientX,
          py: e.clientY,
          startX: tRef.current.x,
          startY: tRef.current.y,
          moved: false,
        };
      }
    },
    [panWithOnePointer]
  );

  const onPointerMove = useCallback((e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gest.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (g.type === "pinch" && pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setT({
        scale: clamp((dist / g.startDist) * g.startScale, 1, 6),
        x: g.startX,
        y: g.startY,
      });
    } else if (g.type === "pan") {
      const dx = e.clientX - g.px;
      const dy = e.clientY - g.py;
      if (Math.hypot(dx, dy) > 4) g.moved = true;
      setT({ scale: tRef.current.scale, x: g.startX + dx, y: g.startY + dy });
    }
  }, []);

  const onPointerUp = useCallback((e) => {
    pointers.current.delete(e.pointerId);
    if (gest.current?.type === "pinch" && pointers.current.size < 2) {
      gest.current = null;
    }
    if (pointers.current.size === 0) {
      const wasPanMove = gest.current?.type === "pan" && gest.current.moved;
      gest.current = null;
      if (!wasPanMove) {
        const now = Date.now();
        const lt = lastTap.current;
        if (now - lt.time < 300 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
          setT((cur) =>
            cur.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }
          );
          lastTap.current = { time: 0, x: 0, y: 0 };
          return;
        }
        lastTap.current = { time: now, x: e.clientX, y: e.clientY };
      }
      // Snap back when zoomed (almost) all the way out.
      if (tRef.current.scale <= 1.02) setT({ scale: 1, x: 0, y: 0 });
    }
  }, []);

  const onWheel = useCallback((e) => {
    setT((cur) => {
      const scale = clamp(cur.scale * (1 - e.deltaY / 500), 1, 6);
      return scale <= 1 ? { scale: 1, x: 0, y: 0 } : { ...cur, scale };
    });
  }, []);

  return {
    transform: t,
    zoomed: t.scale > 1,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
    },
  };
}

/** Renders PDF pages to canvases with pdf.js (lazy-loaded). */
function PdfPreview({ dataUrl }) {
  const containerRef = useRef(null);
  const [state, setState] = useState("loading");
  const zoom = useZoomPan({ panWithOnePointer: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";
        const pages = Math.min(doc.numPages, 20);
        for (let n = 1; n <= pages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const width = container.clientWidth || 360;
          const base = page.getViewport({ scale: 1 });
          // Render sharp (2x) so pinch zoom keeps text readable.
          const viewport = page.getViewport({ scale: (width / base.width) * 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.className = "rounded-lg mb-2 bg-white";
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          if (cancelled) return;
          container.appendChild(canvas);
        }
        setState("ready");
      } catch (e) {
        console.debug("pdf render failed", e);
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  if (state === "error") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/70">
        <Icon name="fileText" className="w-14 h-14 opacity-70" />
        <p className="text-sm">Anteprima non disponibile — usa Scarica</p>
      </div>
    );
  }
  return (
    <div
      className="w-full h-full overflow-y-auto px-2"
      style={{ touchAction: "pan-y" }}
      onClick={(e) => e.stopPropagation()}
      {...zoom.handlers}
    >
      {state === "loading" && (
        <div className="flex items-center justify-center py-16">
          <Spinner className="w-7 h-7 text-white/60" />
        </div>
      )}
      <div
        ref={containerRef}
        className="max-w-3xl mx-auto pb-6"
        style={{
          transform: `translate(${zoom.transform.x}px, 0) scale(${zoom.transform.scale})`,
          transformOrigin: "top center",
        }}
      />
    </div>
  );
}

/*
 * Lightbox body — rendered inside <Overlay variant="lightbox" closeOnBackdrop>.
 * Images open instantly (thumbnail first, full-res swapped in) with pinch
 * zoom; PDFs render inline via pdf.js. Download works natively (share sheet)
 * and on the web (blob download).
 */
export function ImageViewerBody({ url, fullRef, pdf, caption, filename, onClose }) {
  const [displayUrl, setDisplayUrl] = useState(url || null);
  const [saving, setSaving] = useState(false);
  const zoom = useZoomPan();

  useEffect(() => {
    setDisplayUrl(url || null);
    if (!fullRef) return;
    let stale = false;
    getImage(fullRef)
      .then((full) => {
        if (full && !stale) setDisplayUrl(full);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [url, fullRef]);

  const downloadImage = async (e) => {
    e?.stopPropagation();
    if (!displayUrl || saving) return;
    setSaving(true);
    try {
      const base = (filename || caption || "scontrino").replace(/[^\w.-]+/g, "_");
      const name = /\.(pdf|jpe?g|png|webp)$/i.test(base)
        ? base
        : `${base}${pdf ? ".pdf" : ".jpg"}`;
      await saveOrShareDataUrl(displayUrl, name);
    } catch (err) {
      console.debug("save failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="flex items-center justify-between px-4 pt-6 h-20 shrink-0 text-white/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{caption || "Dettaglio immagine"}</p>
          {filename && <p className="text-[11px] opacity-60 truncate">{filename}</p>}
        </div>
        <button
          onClick={downloadImage}
          disabled={saving}
          aria-label="Scarica"
          title="Scarica"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition ml-2 shrink-0 disabled:opacity-50"
        >
          {saving ? <Spinner className="w-5 h-5" /> : <Icon name="download" className="w-5 h-5" />}
        </button>
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition ml-1 shrink-0"
        >
          <Icon name="x" className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 relative px-2 pb-6">
        {pdf ? (
          displayUrl ? (
            <PdfPreview dataUrl={displayUrl} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-7 h-7 text-white/60" />
            </div>
          )
        ) : (
          <div
            className="w-full h-full relative overflow-hidden touch-none"
            onClick={(e) => e.stopPropagation()}
            {...zoom.handlers}
          >
            {displayUrl && (
              <img
                src={displayUrl}
                alt={caption || ""}
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain select-none"
                style={{
                  transform: `translate(${zoom.transform.x}px, ${zoom.transform.y}px) scale(${zoom.transform.scale})`,
                }}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
