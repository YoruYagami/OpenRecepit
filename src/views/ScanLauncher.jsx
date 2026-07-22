import React from "react";
import { fmtDateRange } from "../utils/formatters.js";
import { Icon } from "../components/ui/Icon.jsx";

export function ScanLauncher({ trips, onLaunch }) {
  const sorted = trips.slice().sort((a, b) => b.createdAt - a.createdAt);
  const [latest, ...others] = sorted;

  return (
    <div className="px-5 pb-6 pt-2 fade-in">
      <h2 className="text-2xl font-extrabold text-ink mb-1">Scansiona scontrini</h2>
      <p className="text-sm text-ink/60 mb-5">Scegli la trasferta a cui aggiungere le spese.</p>

      {latest && (
        <div className="bg-surface rounded-2xl shadow-soft p-5 border border-line">
          <p className="text-[10px] uppercase tracking-wider font-bold text-ink/50">
            Ultima trasferta
          </p>
          <div className="flex items-center justify-between gap-3 mt-1">
            <div className="min-w-0">
              <h3 className="font-extrabold text-ink truncate text-xl">{latest.name}</h3>
              <p className="text-xs text-ink/60 truncate mt-0.5">
                {[latest.city, fmtDateRange(latest.startDate, latest.endDate)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="text-xs font-semibold text-ink/60 bg-surface-2 px-2 py-1 rounded-md shrink-0">
              {latest.expenses.length} spes{latest.expenses.length === 1 ? "a" : "e"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => onLaunch(latest.id, "camera")}
              className="h-12 rounded-xl bg-ink text-paper text-sm font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Icon name="camera" className="w-4 h-4" /> Scatta
            </button>
            <button
              onClick={() => onLaunch(latest.id, "gallery")}
              className="h-12 rounded-xl bg-surface border border-line-strong shadow-soft text-sm font-semibold text-ink inline-flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Icon name="image" className="w-4 h-4" /> Galleria
            </button>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink/50 mt-6 mb-2">
            Altre trasferte
          </h3>
          <div className="flex flex-col gap-2">
            {others.map((t) => (
              <div
                key={t.id}
                className="bg-surface rounded-xl shadow-soft px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-ink truncate">{t.name}</p>
                  <p className="text-[11px] text-ink/55 truncate">
                    {t.expenses.length} spes{t.expenses.length === 1 ? "a" : "e"}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => onLaunch(t.id, "camera")}
                    aria-label={`Scatta per ${t.name}`}
                    className="h-10 w-10 rounded-lg bg-surface-2 hover:bg-line grid place-items-center text-ink/70 active:scale-95"
                  >
                    <Icon name="camera" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onLaunch(t.id, "gallery")}
                    aria-label={`Galleria per ${t.name}`}
                    className="h-10 w-10 rounded-lg bg-surface-2 hover:bg-line grid place-items-center text-ink/70 active:scale-95"
                  >
                    <Icon name="image" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {trips.length === 0 && (
        <div className="text-center p-8 bg-surface rounded-2xl border border-line">
          <p className="text-sm text-ink/60">Crea prima una trasferta dalla scheda "Trasferte".</p>
        </div>
      )}
    </div>
  );
}
