import { useCallback, useRef } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { useNav } from "../navigation/NavProvider.jsx";
import { useConfirm } from "./useConfirm.js";
import { uid } from "../utils/formatters.js";

/** Trip create/edit/delete; the form opens as a sheet on the nav stack. */
export function useTripActions() {
  const { trips, setTrips, toast } = useAppContext();
  const nav = useNav();
  const confirm = useConfirm();
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  const openTripForm = useCallback(
    (initial = null) => {
      nav.pushOverlay({
        kind: "tripForm",
        props: {
          initial,
          onSave: (data) => {
            if (initial) {
              setTrips((ts) => ts.map((t) => (t.id === initial.id ? { ...t, ...data } : t)));
              toast("Trasferta aggiornata", "success");
              nav.closeTopOverlay();
            } else {
              const t = { id: uid(), createdAt: Date.now(), expenses: [], ...data };
              setTrips((ts) => [t, ...ts]);
              toast("Trasferta creata", "success");
              // Close the sheet, then land inside the new trip.
              nav.closeOverlaysThen(() => nav.openTrip(t.id));
            }
          },
        },
      });
    },
    [setTrips, toast, nav]
  );

  const deleteTrip = useCallback(
    async (tripId) => {
      const t = tripsRef.current.find((x) => x.id === tripId);
      if (!t) return;
      const ok = await confirm({
        title: "Eliminare la trasferta?",
        message: `"${t.name}" e tutte le sue ${t.expenses.length} spese verranno eliminate.`,
        danger: true,
        confirmLabel: "Elimina",
      });
      if (!ok) return;
      setTrips((ts) => ts.filter((x) => x.id !== tripId));
      toast("Trasferta eliminata");
    },
    [confirm, setTrips, toast]
  );

  return { openTripForm, deleteTrip };
}
