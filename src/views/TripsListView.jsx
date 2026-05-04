import React, { useMemo } from 'react';
import { fmtDateRange, fmtMoney } from '../utils/formatters.js';
import { PrimaryButton } from '../components/ui/Button.jsx';

export function TripsListView({ trips, onOpen, onNew, onDelete }) {
  const sorted = useMemo(
    () => [...trips].sort((a, b) => b.createdAt - a.createdAt),
    [trips]
  );

  return (
    <div className="px-5 pb-6 pt-2 fade-in">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">Trasferte</h2>
          <p className="text-sm text-ink/60">{trips.length === 0 ? "Nessuna trasferta" : `${trips.length} trasferta${trips.length === 1 ? "" : "e"}`}</p>
        </div>
        <button
          onClick={onNew}
          className="h-11 px-4 rounded-xl bg-ink text-white font-semibold inline-flex items-center gap-2 active:scale-[0.98] shadow-soft"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Nuova</span>
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center mt-8">
          <div className="text-5xl mb-3">🧳</div>
          <p className="font-semibold text-ink">Crea la tua prima trasferta</p>
          <p className="text-sm text-ink/60 mt-1">Aggiungi una trasferta per iniziare a registrare le spese.</p>
          <PrimaryButton className="mt-5 mx-auto" onClick={onNew}>Crea trasferta</PrimaryButton>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map((t) => {
          const total = t.expenses.reduce((s, e) => s + (e.importo || 0), 0);
          return (
            <button
              key={t.id}
              onClick={() => onOpen(t.id)}
              className="text-left bg-white rounded-2xl shadow-soft p-4 active:scale-[0.99] transition hover:bg-black/[0.01]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-ink truncate text-lg">{t.name}</h3>
                  <p className="text-sm text-ink/60 truncate mt-0.5">
                    {[t.city, fmtDateRange(t.startDate, t.endDate)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                  className="shrink-0 w-9 h-9 rounded-full hover:bg-black/5 grid place-items-center text-ink/40"
                  aria-label="Elimina"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
                <span className="text-xs font-semibold text-ink/60 bg-black/5 px-2.5 py-1 rounded-md">
                  {t.expenses.length} scontrin{t.expenses.length === 1 ? "o" : "i"}
                </span>
                <span className="font-mono font-bold text-ink text-lg">{fmtMoney(total)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
