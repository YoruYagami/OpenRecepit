import { useCallback, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { useNav } from "../navigation/NavProvider.jsx";
import { analyzeReceipt } from "../api/openRouter.js";
import { sha256Text, fileToResizedDataURL } from "../utils/image.js";
import { readFile } from "../utils/file.js";
import { buildExpenseFromQueueItem, storeFullImage } from "../utils/expenseImages.js";
import {
  emptyExpenseData,
  findContentDuplicate,
  looksLikeSameTransaction,
  mergeQueueItems,
} from "../utils/expenseLogic.js";
import { uid, fmtMoney } from "../utils/formatters.js";

// Bounds on a single import batch so a huge multi-select can't OOM the tab.
const MAX_IMAGES_PER_BATCH = 30;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
// Parallel analyses: big batches finish ~3x faster without hammering the API.
const ANALYZE_CONCURRENCY = 3;

const isPdfFile = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");

/**
 * Fold a just-analyzed item into an earlier one from the same batch when they
 * are the same transaction (receipt + POS slip + statement of one dinner), so
 * the queue shows a single expense with the others attached. Items the user
 * has split apart (`noMerge`) or already confirmed are left alone.
 */
function autoMergeQueue(queue, justDoneId) {
  const item = queue.find((it) => it.id === justDoneId);
  if (!item || item.status !== "done" || item.noMerge || item.data?.attachToId) return queue;
  const partner = queue.find(
    (it) =>
      it.id !== item.id &&
      it.status === "done" &&
      !it.noMerge &&
      !it.data?.attachToId &&
      looksLikeSameTransaction(it.data, item.data)
  );
  if (!partner) return queue;
  const merged = mergeQueueItems([partner, item]);
  return queue.flatMap((it) => {
    if (it.id === partner.id) return [{ ...merged, id: partner.id }];
    if (it.id === item.id) return [];
    return [it];
  });
}

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
        // A same-transaction match among SAVED expenses (receipt already
        // confirmed, this is its POS slip) is offered as "attach", not as a
        // duplicate to discard.
        const sameSaved = targetTrip
          ? targetTrip.expenses.find((e) => looksLikeSameTransaction(parsed, e))
          : null;
        const dup = targetTrip ? findContentDuplicate(parsed, targetTrip.expenses) : null;
        const data = {
          ...parsed,
          ...(dup
            ? {
                duplicateOf: dup.id,
                duplicateLabel: `${dup.esercente} · ${dup.importo} ${dup.valuta}`,
              }
            : {}),
          ...(sameSaved
            ? {
                attachToId: sameSaved.id,
                attachToLabel: `${sameSaved.esercente} · ${fmtMoney(sameSaved.importo, sameSaved.valuta)}`,
              }
            : {}),
        };
        setQueue((q) => {
          const next = q.map((it) => (it.id === item.id ? { ...it, status: "done", data } : it));
          return autoMergeQueue(next, item.id);
        });
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
      const prepared = await Promise.all(
        working.map(async (file) => {
          let thumb = null,
            full = null,
            error = null,
            imageHash = null;
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
          // Hash the resized output, not the source bytes: pickers re-encode
          // files on every pass, so only our own pipeline output is stable.
          if (full) {
            try {
              imageHash = await sha256Text(full);
            } catch (e) {
              console.debug("image hash failed (duplicate detection disabled)", e);
            }
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

      // Sequential dedupe pass: no concurrency race between check and add.
      const newItems = [];
      let skippedDuplicateFiles = 0;
      for (const b of prepared) {
        if (b.imageHash && (existingHashes.has(b.imageHash) || seenInBatch.has(b.imageHash))) {
          skippedDuplicateFiles++;
          continue;
        }
        if (b.imageHash) seenInBatch.add(b.imageHash);
        newItems.push(b);
      }
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

  /** Undo an automatic grouping: the attachments become separate queue items. */
  const splitItem = useCallback((itemId) => {
    setQueue((q) => {
      const item = q.find((it) => it.id === itemId);
      if (!item || !item.mergedCount) return q;
      const attachments = item.extraImages || [];
      const restored = attachments.map((im) => ({
        id: uid(),
        tripId: item.tripId,
        fileName: im.fileName || item.fileName,
        status: "done",
        thumb: im.thumb,
        full: im.full,
        imageHash: im.imageHash,
        isPdf: !!im.pdf,
        noMerge: true, // don't re-merge what the user just split
        data: { ...item.data, iva: undefined },
      }));
      const base = {
        ...item,
        extraImages: [],
        mergedFrom: undefined,
        mergedCount: undefined,
        noMerge: true,
      };
      return q.flatMap((it) => (it.id === itemId ? [base, ...restored] : [it]));
    });
    toast("Documenti separati", "info");
  }, [toast]);

  /** Attach this document to an expense already saved in the trip. */
  const attachItem = useCallback(
    async (itemId) => {
      const item = queueRef.current.find((it) => it.id === itemId);
      const targetId = item?.data?.attachToId;
      if (!item || !targetId) return;
      const entry = {
        thumb: item.thumb,
        imageHash: item.imageHash,
        ...(item.isPdf ? { pdf: true, fileName: item.fileName } : {}),
        ...(await storeFullImage(item.full)),
      };
      setTrips((ts) =>
        ts.map((t) =>
          t.id === item.tripId
            ? {
                ...t,
                expenses: t.expenses.map((e) =>
                  e.id === targetId
                    ? { ...e, extraImages: [...(e.extraImages || []), entry] }
                    : e
                ),
              }
            : t
        )
      );
      setQueue((q) => q.map((it) => (it.id === itemId ? { ...it, status: "confirmed" } : it)));
      toast("Documento allegato alla spesa esistente", "success");
    },
    [setTrips, toast]
  );

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
    const candidates = all.filter((it) => !it.data?.duplicateOf);
    // Documents matching an already-saved expense are attached to it rather
    // than added as new expenses.
    const toAttach = candidates.filter((it) => it.data?.attachToId);
    const toAdd = candidates.filter((it) => !it.data?.attachToId);
    if (toAdd.length === 0 && toAttach.length === 0)
      return toast("Nessuno scontrino valido da aggiungere", "error");

    const newExpenses = await Promise.all(toAdd.map(buildExpenseFromQueueItem));
    const attachments = await Promise.all(
      toAttach.map(async (it) => ({
        targetId: it.data.attachToId,
        entry: {
          thumb: it.thumb,
          imageHash: it.imageHash,
          ...(it.isPdf ? { pdf: true, fileName: it.fileName } : {}),
          ...(await storeFullImage(it.full)),
        },
      }))
    );
    setTrips((ts) =>
      ts.map((t) => {
        if (t.id !== tripId) return t;
        const expenses = t.expenses.map((e) => {
          const mine = attachments.filter((a) => a.targetId === e.id);
          return mine.length > 0
            ? { ...e, extraImages: [...(e.extraImages || []), ...mine.map((a) => a.entry)] }
            : e;
        });
        return { ...t, expenses: [...expenses, ...newExpenses] };
      })
    );
    const doneIds = new Set(candidates.map((it) => it.id));
    setQueue((q) => q.map((it) => (doneIds.has(it.id) ? { ...it, status: "confirmed" } : it)));
    const parts = [];
    if (toAdd.length > 0) parts.push(`${toAdd.length} scontrini aggiunti`);
    if (toAttach.length > 0)
      parts.push(`${toAttach.length} allegat${toAttach.length === 1 ? "o" : "i"}`);
    toast(parts.join(" · "), "success");
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
      splitItem,
      attachItem,
      saveRawItem,
      confirmAll,
      discardAll,
    },
  };
}
