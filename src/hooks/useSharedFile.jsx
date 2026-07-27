import { useCallback, useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { useAppContext } from "../context/AppContext.jsx";
import { useNav } from "../navigation/NavProvider.jsx";
import { analyzeReceipt } from "../api/openRouter.js";
import { findContentDuplicate } from "../utils/expenseLogic.js";
import { storeFullImage } from "../utils/expenseImages.js";
import { sha256Text, fileToResizedDataURL } from "../utils/image.js";
import { uid } from "../utils/formatters.js";

const SharedFile = registerPlugin("SharedFile");

/*
 * Android share target flow: a PDF/image shared from another app (e.g. a
 * Revolut receipt) opens a sheet with three outcomes —
 *   1. AI analysis: if a matching expense already exists (same date/amount/
 *      merchant, any trip) the file is attached to it automatically;
 *      otherwise a new expense is created in the most recent trip.
 *   2. Manual attach to an expense picked from a list.
 *   3. Cancel.
 * The native side (SharedFilePlugin.java) queues the share; we poll it on
 * launch and on every resume.
 */
export function useSharedFile() {
  const { trips, setTrips, settings, toast } = useAppContext();
  const nav = useNav();
  const tripsRef = useRef(trips);
  tripsRef.current = trips;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const busyRef = useRef(false);

  const buildEntry = async (shared) => {
    const blob = await (await fetch(shared.dataUrl)).blob();
    if (shared.isPdf) {
      const imageHash = await sha256Text(shared.dataUrl).catch(() => null);
      return {
        thumb: null,
        imageHash,
        pdf: true,
        fileName: shared.fileName,
        ...(await storeFullImage(shared.dataUrl)),
      };
    }
    const [full, thumb] = await Promise.all([
      fileToResizedDataURL(blob, 1280, 0.85),
      fileToResizedDataURL(blob, 320, 0.6),
    ]);
    const imageHash = await sha256Text(full).catch(() => null);
    return { thumb, imageHash, ...(await storeFullImage(full)) };
  };

  const attachToExpense = async (tripId, expenseId, shared) => {
    const entry = await buildEntry(shared);
    setTrips((ts) =>
      ts.map((t) =>
        t.id === tripId
          ? {
              ...t,
              expenses: t.expenses.map((e) =>
                e.id === expenseId
                  ? { ...e, extraImages: [...(e.extraImages || []), entry] }
                  : e
              ),
            }
          : t
      )
    );
  };

  const analyzeAndFile = async (shared) => {
    const s = settingsRef.current;
    if (!s.apiKey) throw new Error("Configura prima la API key di OpenRouter");
    const all = tripsRef.current;
    if (all.length === 0) throw new Error("Crea prima una trasferta");
    const parsed = await analyzeReceipt({
      apiKey: s.apiKey,
      model: s.model,
      ...(shared.isPdf
        ? { pdfDataUrl: shared.dataUrl, fileName: shared.fileName }
        : { imageDataUrl: shared.dataUrl }),
    });
    // Auto-attach when a matching expense already exists, in any trip.
    for (const t of all) {
      const dup = findContentDuplicate(parsed, t.expenses);
      if (dup) {
        await attachToExpense(t.id, dup.id, shared);
        return { attachedTo: { trip: t, expense: dup } };
      }
    }
    // Otherwise create the expense in the most recent trip.
    const target = [...all].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    const entry = await buildEntry(shared);
    const expense = {
      id: uid(),
      ...parsed,
      thumb: entry.thumb,
      imageHash: entry.imageHash,
      ...(entry.fullRef ? { fullRef: entry.fullRef } : {}),
      ...(entry.full ? { full: entry.full } : {}),
      ...(shared.isPdf ? { pdf: true, fileName: shared.fileName } : {}),
      createdAt: Date.now(),
    };
    setTrips((ts) =>
      ts.map((t) => (t.id === target.id ? { ...t, expenses: [...t.expenses, expense] } : t))
    );
    return { createdIn: target, expense };
  };

  const openSharedSheet = useCallback(
    (shared) => {
      nav.pushOverlay({
        kind: "sharedFile",
        props: {
          fileName: shared.fileName,
          isPdf: shared.isPdf,
          canAnalyze: !!settingsRef.current.apiKey && tripsRef.current.length > 0,
          hasTrips: tripsRef.current.length > 0,
          onAnalyze: async () => {
            const res = await analyzeAndFile(shared);
            nav.closeOverlaysThen(() => {
              if (res.attachedTo) {
                toast(
                  `Allegato a "${res.attachedTo.expense.esercente}" (${res.attachedTo.trip.name})`,
                  "success"
                );
                nav.openTrip(res.attachedTo.trip.id);
              } else {
                toast(`Spesa creata in "${res.createdIn.name}"`, "success");
                nav.openTrip(res.createdIn.id);
              }
            });
          },
          onAttachExisting: () => {
            nav.pushOverlay({
              kind: "expensePicker",
              props: {
                onPick: async (tripId, expenseId) => {
                  await attachToExpense(tripId, expenseId, shared);
                  nav.closeOverlaysThen(() => {
                    toast("Documento allegato", "success");
                    nav.openTrip(tripId);
                  });
                },
              },
            });
          },
        },
      });
    },
    // analyzeAndFile/attachToExpense read live state via refs; nav methods are
    // stable. Recreating this callback would only churn the consume effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast]
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const check = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const res = await SharedFile.consume();
        if (res?.data) {
          const mime = res.mimeType || "application/octet-stream";
          const isPdf = mime === "application/pdf" || /\.pdf$/i.test(res.fileName || "");
          if (!isPdf && !mime.startsWith("image/")) {
            toast("Tipo di file non supportato", "error");
          } else {
            openSharedSheet({
              dataUrl: `data:${mime};base64,${res.data}`,
              fileName: res.fileName || (isPdf ? "documento.pdf" : "immagine.jpg"),
              mimeType: mime,
              isPdf,
            });
          }
        }
      } catch (e) {
        console.debug("share consume failed", e);
      } finally {
        busyRef.current = false;
      }
    };
    check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [openSharedSheet, toast]);
}
