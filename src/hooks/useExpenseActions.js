import { useCallback, useRef } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import { fileSha256, fileToResizedDataURL } from "../utils/image.js";
import { readFile } from "../utils/file.js";
import { storeFullImage } from "../utils/expenseImages.js";
import { emptyExpenseData } from "../utils/expenseLogic.js";
import { uid } from "../utils/formatters.js";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/** Expense CRUD extracted from App: delete-with-undo, manual add, update, attachments. */
export function useExpenseActions({ pickFiles }) {
  const { trips, setTrips, toast } = useAppContext();
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  // Delete immediately with an undo window instead of a blocking confirm:
  // less friction, and safer than a reflexively-tapped dialog.
  const deleteExpense = useCallback(
    (tripId, expenseId) => {
      const trip = tripsRef.current.find((t) => t.id === tripId);
      const removed = trip?.expenses.find((e) => e.id === expenseId);
      if (!removed) return;
      setTrips((ts) =>
        ts.map((t) =>
          t.id === tripId ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) } : t
        )
      );
      toast("Spesa eliminata", "info", {
        actionLabel: "Annulla",
        onAction: () =>
          setTrips((ts) =>
            ts.map((t) =>
              t.id === tripId && !t.expenses.some((e) => e.id === removed.id)
                ? { ...t, expenses: [...t.expenses, removed] }
                : t
            )
          ),
      });
    },
    [setTrips, toast]
  );

  const addManualExpense = useCallback(
    (tripId) => {
      const expense = { id: uid(), ...emptyExpenseData(), createdAt: Date.now() };
      setTrips((ts) =>
        ts.map((t) => (t.id === tripId ? { ...t, expenses: [...t.expenses, expense] } : t))
      );
      return expense.id;
    },
    [setTrips]
  );

  // Silent removal for cancelling a just-created manual expense (no dialog).
  const removeExpenseSilent = useCallback(
    (tripId, expenseId) => {
      setTrips((ts) =>
        ts.map((t) =>
          t.id === tripId ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) } : t
        )
      );
    },
    [setTrips]
  );

  const updateExpense = useCallback(
    (tripId, expenseId, patch) => {
      setTrips((ts) =>
        ts.map((t) =>
          t.id === tripId
            ? {
                ...t,
                expenses: t.expenses.map((e) =>
                  e.id === expenseId
                    ? {
                        ...e,
                        ...patch,
                        importo:
                          patch.importo !== undefined
                            ? parseFloat(patch.importo) || 0
                            : e.importo,
                      }
                    : e
                ),
              }
            : t
        )
      );
    },
    [setTrips]
  );

  const addAttachment = useCallback(
    async (tripId, expenseId, mode = "gallery") => {
      // Attachments accept PDFs too, so the gallery button opens the document
      // picker (the native photo picker is images-only).
      const files = await pickFiles({ source: mode === "gallery" ? "files" : mode });
      if (files.length === 0) return;
      const working = files.filter((f) => f.size <= MAX_IMAGE_BYTES);
      if (working.length < files.length) toast("Immagini troppo grandi ignorate", "error");
      if (working.length === 0) return;
      toast("Aggiunta allegato in corso...", "info");
      const built = [];
      for (const file of working) {
        try {
          let imageHash = null;
          try {
            imageHash = await fileSha256(file);
          } catch (e) {
            console.debug("attachment hash failed", e);
          }
          const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
          if (isPdf) {
            const dataUrl = await readFile(file, { as: "dataURL" });
            built.push({
              thumb: null,
              imageHash,
              pdf: true,
              fileName: file.name || "documento.pdf",
              ...(await storeFullImage(dataUrl)),
            });
          } else {
            const [full, thumb] = await Promise.all([
              fileToResizedDataURL(file, 1280, 0.85),
              fileToResizedDataURL(file, 320, 0.6),
            ]);
            built.push({ thumb, imageHash, ...(await storeFullImage(full)) });
          }
        } catch (e) {
          toast("Errore allegato: " + e?.message, "error");
        }
      }
      if (built.length > 0) {
        setTrips((ts) =>
          ts.map((t) =>
            t.id === tripId
              ? {
                  ...t,
                  expenses: t.expenses.map((e) =>
                    e.id === expenseId
                      ? { ...e, extraImages: [...(e.extraImages || []), ...built] }
                      : e
                  ),
                }
              : t
          )
        );
        toast(
          `Aggiunt${built.length === 1 ? "o" : "i"} ${built.length} allegat${built.length === 1 ? "o" : "i"}`,
          "success"
        );
      }
    },
    [pickFiles, setTrips, toast]
  );

  return { deleteExpense, addManualExpense, removeExpenseSilent, updateExpense, addAttachment };
}
