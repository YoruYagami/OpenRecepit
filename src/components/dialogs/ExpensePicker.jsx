import React, { useState } from "react";
import { fmtDate, fmtMoney } from "../../utils/formatters.js";
import { CATEGORIES } from "../../constants.js";
import { Icon } from "../ui/Icon.jsx";
import { Spinner } from "../ui/Spinner.jsx";

/** Pick an expense (trip by trip) to attach a shared document to. */
export function ExpensePickerBody({ trips, onPick, onClose }) {
  const [busyId, setBusyId] = useState(null);
  const sorted = [...trips].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const withExpenses = sorted.filter((t) => t.expenses.length > 0);

  const pick = async (tripId, expenseId) => {
    if (busyId) return;
    setBusyId(expenseId);
    try {
      await onPick(tripId, expenseId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-5 max-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-ink">Allega a una spesa</h3>
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="w-9 h-9 rounded-full hover:bg-surface-2 grid place-items-center text-ink/60"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      </div>
      {withExpenses.length === 0 ? (
        <p className="text-sm text-ink/60 py-6 text-center">Nessuna spesa disponibile.</p>
      ) : (
        <div className="overflow-y-auto flex flex-col gap-4 -mx-1 px-1">
          {withExpenses.map((t) => (
            <div key={t.id}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink/50 mb-1.5">
                {t.name}
              </p>
              <div className="flex flex-col gap-1.5">
                {[...t.expenses]
                  .sort((a, b) => (b.data || "") < (a.data || "") ? -1 : 1)
                  .map((e) => {
                    const c = CATEGORIES[e.categoria] || CATEGORIES.altro;
                    return (
                      <button
                        key={e.id}
                        onClick={() => pick(t.id, e.id)}
                        disabled={!!busyId}
                        className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 hover:bg-surface-2 px-3 py-2 text-left active:scale-[0.99] disabled:opacity-50"
                      >
                        <span className="shrink-0" aria-hidden>
                          {c.icon}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-ink truncate">
                            {e.esercente || "Senza nome"}
                          </span>
                          <span className="block text-[11px] text-ink/55">
                            {fmtDate(e.data)}
                          </span>
                        </span>
                        {busyId === e.id ? (
                          <Spinner className="w-4 h-4 text-ink/50" />
                        ) : (
                          <span className="font-mono text-sm font-bold text-ink shrink-0">
                            {fmtMoney(e.importo, e.valuta)}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
