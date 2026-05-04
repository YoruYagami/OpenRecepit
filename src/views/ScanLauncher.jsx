import React from 'react';
import { fmtDateRange } from '../utils/formatters.js';

export function ScanLauncher({ trips, onLaunch }) {
  return (
    <div className="px-5 pb-6 pt-2 fade-in">
      <h2 className="text-2xl font-extrabold text-ink mb-1">Scansiona scontrini</h2>
      <p className="text-sm text-ink/60 mb-5">Scegli la trasferta a cui aggiungere le spese.</p>

      <div className="flex flex-col gap-2">
        {trips
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((t) => (
            <div key={t.id} className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-ink truncate text-lg">{t.name}</h3>
                  <p className="text-xs text-ink/60 truncate mt-0.5">
                    {[t.city, fmtDateRange(t.startDate, t.endDate)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs font-semibold text-ink/60 bg-black/5 px-2 py-1 rounded-md shrink-0">
                  {t.expenses.length} spes{t.expenses.length === 1 ? "a" : "e"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onLaunch(t.id, "camera")}
                  className="h-11 rounded-xl bg-ink text-white text-sm font-semibold inline-flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                  📷 Scatta
                </button>
                <button
                  onClick={() => onLaunch(t.id, "gallery")}
                  className="h-11 rounded-xl bg-white border border-black/5 shadow-soft text-sm font-semibold text-ink inline-flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                  🖼️ Galleria
                </button>
              </div>
            </div>
          ))}
        {trips.length === 0 && (
          <div className="text-center p-8 bg-white rounded-2xl border border-black/5">
            <p className="text-sm text-ink/60">Crea prima una trasferta dalla scheda "Trasferte".</p>
          </div>
        )}
      </div>
    </div>
  );
}
