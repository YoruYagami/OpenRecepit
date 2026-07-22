import React, { useEffect, useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { getImage } from "../../utils/imageStore.js";

/*
 * Lightbox body — rendered inside <Overlay variant="lightbox" closeOnBackdrop>.
 * Opens instantly with whatever url it was given (usually the thumbnail) and
 * swaps in the stored full-resolution image when it loads.
 */
export function ImageViewerBody({ url, fullRef, pdf, caption, filename, onClose }) {
  const [displayUrl, setDisplayUrl] = useState(url || null);

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

  const downloadImage = async () => {
    if (!displayUrl) return;
    try {
      const blob = await (await fetch(displayUrl)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(filename || caption || "scontrino").replace(/[^\w.-]+/g, "_")}${pdf ? ".pdf" : ".jpg"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* download best-effort */
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
          aria-label="Scarica immagine"
          title="Scarica"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition ml-2 shrink-0"
        >
          <Icon name="download" className="w-5 h-5" />
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
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-4 text-white/80"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="fileText" className="w-16 h-16 opacity-70" />
            <p className="text-sm font-semibold max-w-[80%] truncate">
              {filename || caption || "Documento PDF"}
            </p>
            <button
              onClick={downloadImage}
              className="h-11 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold inline-flex items-center gap-2 active:scale-95"
            >
              <Icon name="download" className="w-4 h-4" /> Scarica PDF
            </button>
          </div>
        ) : (
          <div className="w-full h-full relative group">
            {displayUrl && (
              <img
                src={displayUrl}
                alt={caption || ""}
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
