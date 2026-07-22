import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { useNav } from "../navigation/NavProvider.jsx";
import { analyzeReceipt } from "../api/openRouter.js";
import { loadFullImage } from "../utils/expenseImages.js";

/** Single-expense and whole-trip reanalysis, aborted when the user navigates away. */
export function useReanalyze() {
  const { trips, setTrips, settings, toast } = useAppContext();
  const nav = useNav();
  const [reanalyzingId, setReanalyzingId] = useState(null);

  // Cancel in-flight reanalysis when the user leaves the trip/tab it belongs
  // to, instead of silently burning API credits in the background.
  const abortRef = useRef(null);
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [nav.tab, nav.tripId]);

  const requireApiKey = useCallback(() => {
    if (settings.apiKey) return true;
    toast("Configura prima la API key", "error");
    nav.setTab("settings");
    return false;
  }, [settings.apiKey, toast, nav]);

  const reanalyzeExpense = useCallback(
    async (tripId, expenseId) => {
      const trip = trips.find((t) => t.id === tripId);
      const expense = trip?.expenses.find((e) => e.id === expenseId);
      if (!expense) return;
      const imageDataUrl = await loadFullImage(expense);
      if (!imageDataUrl) {
        toast("Immagine non disponibile per la rianalisi", "error");
        return;
      }
      if (!requireApiKey()) return;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setReanalyzingId(expenseId);
      try {
        const parsed = await analyzeReceipt({
          apiKey: settings.apiKey,
          model: settings.model,
          imageDataUrl,
          signal: ctrl.signal,
        });
        setTrips((ts) =>
          ts.map((t) =>
            t.id === tripId
              ? {
                  ...t,
                  expenses: t.expenses.map((e) => (e.id === expenseId ? { ...e, ...parsed } : e)),
                }
              : t
          )
        );
        toast("Scontrino rianalizzato", "success");
      } catch (e) {
        if (e?.name !== "AbortError") toast(e?.message || "Rianalisi fallita", "error");
      } finally {
        setReanalyzingId(null);
      }
    },
    [trips, settings.apiKey, settings.model, setTrips, toast, requireApiKey]
  );

  const reanalyzeTrip = useCallback(
    async (tripId) => {
      if (!requireApiKey()) return;
      const trip = trips.find((t) => t.id === tripId);
      if (!trip) return;
      const expensesWithImages = trip.expenses.filter((e) => e.full || e.fullRef);
      if (expensesWithImages.length === 0) {
        toast("Nessuno scontrino con immagine da rianalizzare", "error");
        return;
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let successCount = 0;
      for (const expense of expensesWithImages) {
        if (ctrl.signal.aborted) break;
        setReanalyzingId(expense.id);
        try {
          const imageDataUrl = await loadFullImage(expense);
          if (!imageDataUrl) continue;
          const parsed = await analyzeReceipt({
            apiKey: settings.apiKey,
            model: settings.model,
            imageDataUrl,
            signal: ctrl.signal,
          });
          setTrips((ts) =>
            ts.map((t) =>
              t.id === tripId
                ? {
                    ...t,
                    expenses: t.expenses.map((e) =>
                      e.id === expense.id ? { ...e, ...parsed } : e
                    ),
                  }
                : t
            )
          );
          successCount++;
        } catch (e) {
          if (e?.name === "AbortError") break;
          toast(`Errore rianalisi ${expense.esercente || "scontrino"}: ${e?.message}`, "error");
        }
      }
      setReanalyzingId(null);
      if (successCount > 0) {
        toast(`${successCount} scontrini rianalizzati con successo`, "success");
      }
    },
    [trips, settings.apiKey, settings.model, setTrips, toast, requireApiKey]
  );

  return { reanalyzingId, reanalyzeExpense, reanalyzeTrip };
}
