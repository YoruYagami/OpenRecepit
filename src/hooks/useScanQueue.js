import { useCallback, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { useNav } from "../navigation/NavProvider.jsx";
import { analyzeReceipt } from "../api/openRouter.js";
import { fileSha256, fileToResizedDataURL } from "../utils/image.js";
import { readFile } from "../utils/file.js";
import { buildExpenseFromQueueItem } from "../utils/expenseImages.js";
import { emptyExpenseData, findContentDuplicate } from "../utils/expenseLogic.js";
import { uid } from "../utils/formatters.js";

// Bounds on a single import batch so a huge multi-select can't OOM the tab.
const MAX_IMAGES_PER_BATCH = 30;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
// Parallel analyses: big batches finish ~3x faster without hammering the API.
const ANALYZE_CONCURRENCY = 3;

const isPdfFile = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");

/*
 * The entire scan pipeline, extracted from App: file intake → resize/hash →
 * queue overlay → concurrent analysis → review/confirm into the trip.
 *
 * The queue overlay lives on the nav stack; closing it (✕, back button,
 * Escape) is guarded — unconfirmed or failed items raise a confirm dialog
 * before anything is discarded.
 */
export function useScanQueue({ pickFiles }) {
  const { setTrips, settings, toast } = useAppContext();
  const nav = useNav();

  const [queue, setQueue] = useState([]);
  const queueRef = useRef([]);
  queueRef.current = queue;

  const targetTripIdRef = useRef(null);
  const overlayIdRef = useRef(null);
  // Aborts in-flight scan requests when the queue is closed/discarded.
  const abortRef = useRef(null);

  // Live trips for duplicate detection: an expense confirmed mid-batch must be
  // seen by the checks of the items still analyzing.
  const { trips } = useAppContext();
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  const abortRequests = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const dirtyCount = () =>
    queueRef.current.filter((it) => it.status === "done" || it.status === "error").length;

  const handleQueueDismissed = useCallback(() => {
    overlayIdRef.current = null;
    abortRequests();
    const hadConfirmed = queueRef.current.some((it) => it.status === "confirmed");
    const target = targetTripIdRef.current;
    targetTripIdRef.current = null;
    setQueue([]);
    if (hadConfirmed && target) nav.openTrip(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openQueueOverlay = useCallback(() => {
    if (overlayIdRef.current) return;
    const id = nav.pushOverlay({ kind: "scanQueue", onDismiss: handleQueueDismissed });
    overlayIdRef.current = id;
    nav.registerGuard(id, {
      check: () => (dirtyCount() > 0 ? "veto" : "ok"),
      onVeto: () => {
        const n = dirtyCount();
        nav.pushOverlay({
          kind: "confirm",
          props: {
            title: "Chiudere senza confermare?",
            message: `Ci sono ${n} scontrini non confermati o falliti: verranno scartati.`,
            danger: true,
            confirmLabel: "Chiudi",
            onConfirm: () => nav.forceCloseOverlays(2),
            onCancel: () => nav.closeTopOverlay(),
          },
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleQueueDismissed]);

  const processQueueItem = useCallback(
    async (item) => {
      if (!abortRef.current || abortRef.current.signal.aborted) {
        abortRef.current = new AbortController();
      }
      const signal = abortRef.current.signal;
      setQueue((q) =>
        q.map((it) => (it.id === item.id ? { ...it, status: "processing", error: null } : it))
      );
      try {
        const parsed = await analyzeReceipt({
          apiKey: settings.apiKey,
          model: settings.model,
          ...(item.isPdf
            ? { pdfDataUrl: item.full, fileName: item.fileName }
            : { imageDataUrl: item.full }),
          signal,
        });
        const targetTrip = tripsRef.current.find((t) => t.id === item.tripId);
        const dup = targetTrip ? findContentDuplicate(parsed, targetTrip.expenses) : null;
        const data = {
          ...parsed,
          ...(dup
            ? {
                duplicateOf: dup.id,
                duplicateLabel: `${dup.esercente} · ${dup.importo} ${dup.valuta}`,
              }
            : {}),
        };
        setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: "done", data } : it)));
      } catch (err) {
        setQueue((q) =>
          q.map((it) =>
            it.id === item.id
              ? { ...it, status: "error", error: err?.message || "Errore di analisi" }
              : it
          )
        );
      }
    },
    [settings.apiKey, settings.model]
  );

  const processFiles = useCallback(
    async (tripId, files, { append = false } = {}) => {
      if (!tripId || files.length === 0) return;

      let working = Array.from(files);
      const oversized = working.filter((f) => f.size > MAX_IMAGE_BYTES).length;
      working = working.filter((f) => f.size <= MAX_IMAGE_BYTES);
      if (oversized > 0) {
        toast(
          `${oversized} immagin${oversized === 1 ? "e" : "i"} troppo grand${oversized === 1 ? "e" : "i"} ignorat${oversized === 1 ? "a" : "e"}`,
          "error"
        );
      }
      if (working.length > MAX_IMAGES_PER_BATCH) {
        toast(
          `Massimo ${MAX_IMAGES_PER_BATCH} immagini per volta: elaboro le prime ${MAX_IMAGES_PER_BATCH}.`,
          "info"
        );
        working = working.slice(0, MAX_IMAGES_PER_BATCH);
      }
      if (working.length === 0) return;
      if (working.length > 1) toast(`Preparazione di ${working.length} immagini…`, "info");

      const trip = tripsRef.current.find((t) => t.id === tripId);
      const existingHashes = new Set(
        (trip?.expenses || []).map((e) => e.imageHash).filter(Boolean)
      );
      // In append mode the photos already queued count as "seen" too.
      const seenInBatch = new Set(
        append ? queueRef.current.map((it) => it.imageHash).filter(Boolean) : []
      );
      const built = await Promise.all(
        working.map(async (file) => {
          let thumb = null,
            full = null,
            error = null,
            imageHash = null;
          try {
            imageHash = await fileSha256(file);
          } catch (e) {
            console.debug("image hash failed (duplicate detection disabled for this file)", e);
          }
          if (imageHash && (existingHashes.has(imageHash) || seenInBatch.has(imageHash))) {
            return { skipped: true, imageHash };
          }
          if (imageHash) seenInBatch.add(imageHash);
          const isPdf = isPdfFile(file);
          try {
            if (isPdf) {
              full = await readFile(file, { as: "dataURL" });
            } else {
              [full, thumb] = await Promise.all([
                fileToResizedDataURL(file, 1280, 0.85),
                fileToResizedDataURL(file, 320, 0.6),
              ]);
            }
          } catch (err) {
            error = err?.message || "Impossibile leggere il file";
          }
          return {
            id: uid(),
            tripId,
            fileName: file.name || (isPdf ? "documento.pdf" : "scontrino.jpg"),
            status: error ? "error" : "pending",
            error,
            thumb,
            full,
            imageHash,
            isPdf,
            data: null,
          };
        })
      );

      const newItems = built.filter((b) => !b.skipped);
      const skippedDuplicateFiles = built.length - newItems.length;
      if (skippedDuplicateFiles > 0) {
        toast(
          `${skippedDuplicateFiles} duplicat${skippedDuplicateFiles === 1 ? "o" : "i"} saltat${skippedDuplicateFiles === 1 ? "o" : "i"}`,
          "info"
        );
      }
      if (newItems.length === 0) return;

      targetTripIdRef.current = tripId;
      if (append && overlayIdRef.current) {
        setQueue((q) => [...q, ...newItems]);
      } else {
        setQueue(newItems);
        openQueueOverlay();
      }

      // Bounded worker pool over the pending items.
      const pending = newItems.filter((it) => it.status !== "error");
      const workers = Array.from({ length: Math.min(ANALYZE_CONCURRENCY, pending.length) }, () =>
        (async () => {
          while (pending.length > 0) {
            const item = pending.shift();
            await processQueueItem(item);
          }
        })()
      );
      await Promise.all(workers);
    },
    [openQueueOverlay, processQueueItem, toast]
  );

  const startScan = useCallback(
    async (tripId, mode) => {
      if (!settings.apiKey) {
        toast("Imposta prima la API key di OpenRouter", "error");
        nav.setTab("settings");
        return;
      }
      const files = await pickFiles({ source: mode });
      if (files.length > 0) await processFiles(tripId, files);
    },
    [settings.apiKey, pickFiles, processFiles, toast, nav]
  );

  const addMorePhotos = useCallback(async () => {
    const tripId = targetTripIdRef.current;
    if (!tripId) return;
    const files = await pickFiles({ source: "gallery" });
    if (files.length > 0) await processFiles(tripId, files, { append: true });
  }, [pickFiles, processFiles]);

  const confirmItem = useCallback(
    async (itemId) => {
      const item = queueRef.current.find((it) => it.id === itemId);
      if (!item || item.status !== "done") return;
      const expense = await buildExpenseFromQueueItem(item);
      setTrips((ts) =>
        ts.map((t) => (t.id === item.tripId ? { ...t, expenses: [...t.expenses, expense] } : t))
      );
      setQueue((q) => q.map((it) => (it.id === itemId ? { ...it, status: "confirmed" } : it)));
    },
    [setTrips]
  );

  // Analysis failed but the photo is good: save it as a blank expense to edit
  // by hand, instead of forcing the user to choose between retry and losing it.
  const saveRawItem = useCallback(
    async (itemId) => {
      const item = queueRef.current.find((it) => it.id === itemId);
      if (!item || item.status !== "error") return;
      const expense = await buildExpenseFromQueueItem({ ...item, data: emptyExpenseData() });
      setTrips((ts) =>
        ts.map((t) => (t.id === item.tripId ? { ...t, expenses: [...t.expenses, expense] } : t))
      );
      setQueue((q) => q.map((it) => (it.id === itemId ? { ...it, status: "confirmed" } : it)));
      toast("Salvato senza analisi — completa i dati dalla trasferta", "info");
    },
    [setTrips, toast]
  );

  const discardItem = useCallback(
    (itemId) => setQueue((q) => q.filter((it) => it.id !== itemId)),
    []
  );

  const retryItem = useCallback(
    (itemId) => {
      const item = queueRef.current.find((it) => it.id === itemId);
      if (item) processQueueItem(item);
    },
    [processQueueItem]
  );

  const confirmAll = useCallback(async () => {
    const tripId = targetTripIdRef.current;
    if (!tripId) return;
    const all = queueRef.current.filter((it) => it.status === "done");
    const toAdd = all.filter((it) => !it.data?.duplicateOf);
    if (toAdd.length === 0) return toast("Nessuno scontrino valido da aggiungere", "error");
    const newExpenses = await Promise.all(toAdd.map(buildExpenseFromQueueItem));
    setTrips((ts) =>
      ts.map((t) => (t.id === tripId ? { ...t, expenses: [...t.expenses, ...newExpenses] } : t))
    );
    setQueue((q) =>
      q.map((it) => (toAdd.find((a) => a.id === it.id) ? { ...it, status: "confirmed" } : it))
    );
    toast(`${toAdd.length} scontrini aggiunti`, "success");
    setTimeout(() => nav.closeTopOverlay(), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTrips, toast]);

  const discardAll = useCallback(() => {
    nav.pushOverlay({
      kind: "confirm",
      props: {
        title: "Scartare tutti?",
        message: "Gli scontrini non confermati verranno scartati.",
        danger: true,
        confirmLabel: "Scarta tutti",
        onConfirm: () => nav.forceCloseOverlays(2),
        onCancel: () => nav.closeTopOverlay(),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeItem = useCallback(
    (item) => setQueue((q) => q.map((i) => (i.id === item.id ? item : i))),
    []
  );

  return {
    queue,
    startScan,
    addMorePhotos,
    targetTripId: targetTripIdRef.current,
    handlers: {
      changeItem,
      confirmItem,
      discardItem,
      retryItem,
      reanalyzeItem: retryItem,
      saveRawItem,
      confirmAll,
      discardAll,
    },
  };
}
