import React, { useState, useMemo } from 'react';
import { fmtDateRange, fmtMoney, fmtDayLabel, expenseTimeMinutes } from '../utils/formatters.js';
import { CATEGORIES } from '../constants.js';
import { expenseWarnings } from '../utils/expenseLogic.js';
import { EditableReceiptCard } from '../components/receipts/EditableReceiptCard.jsx';
import { CategoryBadge } from '../components/ui/CategoryBadge.jsx';

export function TripDetailView({
  trip,
  onBack,
  onEditTrip,
  onDeleteExpense,
  onUpdateExpense,
  onReanalyzeExpense,
  onReanalyzeTrip,
  onAddAttachment,
  reanalyzingId,
  onScanCamera,
  onScanGallery,
  onExportCSV,
  onExportSummary,
  onViewImage,
  settings,
}) {
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const sortedExpenses = useMemo(
    () => [...trip.expenses].sort((a, b) => (a.data < b.data ? 1 : -1)),
    [trip.expenses]
  );

  const groupedByDay = useMemo(() => {
    const map = new Map();
    for (const e of trip.expenses) {
      const key = e.data || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    const entries = [...map.entries()].sort((a, b) => {
      if (!a[0]) return 1;
      if (!b[0]) return -1;
      return a[0] < b[0] ? 1 : -1;
    });
    return entries.map(([date, items]) => ({
      date,
      items: items.slice().sort((a, b) => {
        const tb = expenseTimeMinutes(b);
        const ta = expenseTimeMinutes(a);
        if (tb !== ta) return tb - ta;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }),
      total: items.reduce((s, e) => s + (e.importo || 0), 0),
    }));
  }, [trip.expenses]);

  const totalsByCat = useMemo(() => {
    const map = {};
    trip.expenses.forEach((e) => {
      map[e.categoria] = (map[e.categoria] || 0) + (e.importo || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [trip.expenses]);

  const grandTotal = useMemo(
    () => trip.expenses.reduce((s, e) => s + (e.importo || 0), 0),
    [trip.expenses]
  );

  return (
    <div className="pb-28 fade-in">
      <div className="px-5 pt-2 pb-4">
        <button onClick={onBack} className="text-sm font-semibold text-ink/60 inline-flex items-center gap-1 mb-3 hover:text-ink bg-black/5 px-2.5 py-1 rounded-lg">
          ← Trasferte
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-ink truncate">{trip.name}</h2>
            <p className="text-sm text-ink/60 truncate mt-0.5">
              {[trip.city, fmtDateRange(trip.startDate, trip.endDate)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onEditTrip} className="shrink-0 w-10 h-10 rounded-full bg-white border border-black/5 hover:bg-black/5 grid place-items-center text-ink/60" aria-label="Modifica trasferta" title="Modifica">
            ✎
          </button>
        </div>

        <div className="mt-4 bg-white rounded-2xl shadow-soft p-5 flex items-center justify-between border border-black/5">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-ink/50">Totale Trasferta</p>
            <p className="font-mono text-3xl font-extrabold text-ink mt-0.5">{fmtMoney(grandTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider font-bold text-ink/50">Scontrini</p>
            <p className="text-2xl font-extrabold text-ink mt-0.5">{trip.expenses.length}</p>
          </div>
        </div>
      </div>

      {totalsByCat.length > 0 && (
        <div className="px-5">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1">
            {totalsByCat.map(([cat, amt]) => {
              const c = CATEGORIES[cat] || CATEGORIES.altro;
              return (
                <div key={cat} className="shrink-0 rounded-xl px-3 py-2 flex items-center gap-2" style={{ backgroundColor: c.color + "1a" }}>
                  <span aria-hidden>{c.icon}</span>
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: c.color }}>{c.label}</p>
                    <p className="font-mono text-sm font-bold" style={{ color: c.color }}>{fmtMoney(amt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 mt-4 grid grid-cols-2 gap-2">
        <button onClick={onScanCamera} className="h-12 rounded-xl bg-ink text-white text-sm font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] shadow-soft hover:bg-ink/90 transition">
          📷 Scatta foto
        </button>
        <button onClick={onScanGallery} className="h-12 rounded-xl bg-white border border-black/10 text-ink text-sm font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] shadow-soft hover:bg-black/5 transition">
          🖼️ Carica
        </button>
      </div>

      {trip.expenses.length > 0 && (
        <div className="px-5 mt-2 grid grid-cols-2 gap-2">
          <button onClick={onExportCSV} className="h-10 rounded-xl bg-white border border-black/5 shadow-soft text-xs font-bold text-ink/70 active:scale-[0.98] hover:bg-black/5 transition">
            ⬇️ Esporta CSV
          </button>
          <button onClick={onExportSummary} className="h-10 rounded-xl bg-white border border-black/5 shadow-soft text-xs font-bold text-ink/70 active:scale-[0.98] hover:bg-black/5 transition">
            📋 Riepilogo
          </button>
          <button 
            onClick={() => onReanalyzeTrip && onReanalyzeTrip(trip.id)} 
            disabled={!!reanalyzingId}
            className="col-span-2 h-10 rounded-xl bg-white border border-black/5 shadow-soft text-xs font-bold text-ink/70 active:scale-[0.98] hover:bg-black/5 transition disabled:opacity-50 inline-flex justify-center items-center gap-1"
          >
            {reanalyzingId ? <span className="animate-spin text-sm">↻</span> : <span>🔄</span>}
            <span>Rianalizza tutto</span>
          </button>
        </div>
      )}

      <div className="px-5 mt-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60 mb-3 border-b border-black/5 pb-2">Dettaglio Spese</h3>
        {sortedExpenses.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-soft p-8 text-center mt-4">
            <div className="text-4xl mb-2 opacity-50">📸</div>
            <p className="font-semibold text-ink">Nessuno scontrino</p>
            <p className="text-sm text-ink/60 mt-1">Aggiungi una spesa per vederla qui.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedByDay.map(({ date, items, total }) => (
              <div key={date || "no-date"} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between px-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink/50 bg-black/5 px-2 py-0.5 rounded-md">
                    {fmtDayLabel(date)}
                  </h4>
                  <span className="text-[11px] font-mono font-semibold text-ink/60">
                    {fmtMoney(total)} · {items.length} spes{items.length === 1 ? "a" : "e"}
                  </span>
                </div>
                {items.map((e) => {
                  if (editingExpenseId === e.id) {
                    const isReanalyzing = reanalyzingId === e.id;
                    return (
                      <div key={e.id}>
                        <EditableReceiptCard
                          item={{ id: e.id, status: isReanalyzing ? "processing" : "done", thumb: e.thumb, full: e.full, extraImages: e.extraImages, data: e }}
                          onChange={(it) => onUpdateExpense(e.id, it.data)}
                          onConfirm={() => setEditingExpenseId(null)}
                          onDiscard={() => setEditingExpenseId(null)}
                          onRetry={() => {}}
                          onReanalyze={onReanalyzeExpense ? () => onReanalyzeExpense(e.id) : undefined}
                          onAddAttachment={onAddAttachment ? (mode) => onAddAttachment(e.id, mode) : undefined}
                          onViewImage={onViewImage}
                          confirmLabel="Salva"
                          settings={settings}
                          trip={trip}
                        />
                      </div>
                    );
                  }
                  const c = CATEGORIES[e.categoria] || CATEGORIES.altro;
                  const warns = settings ? expenseWarnings(e, settings, trip) : [];
                  const previewUrl = e.full || e.thumb;
                  return (
                    <div
                      key={e.id}
                      className={`bg-white rounded-2xl shadow-soft p-3 flex items-center gap-3 active:scale-[0.99] transition hover:shadow-md ${
                        warns.length > 0 ? "ring-1 ring-amber-300" : ""
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (previewUrl && onViewImage) {
                            onViewImage({ url: previewUrl, caption: e.esercente, filename: `${e.esercente || "scontrino"}_${e.data || ""}` });
                          } else {
                            setEditingExpenseId(e.id);
                          }
                        }}
                        className="shrink-0 w-12 h-12 rounded-xl overflow-hidden grid place-items-center relative transition-transform hover:scale-105"
                        style={{ backgroundColor: c.color + "1a" }}
                        aria-label="Vedi immagine"
                        title="Tocca per ingrandire"
                      >
                        {e.thumb ? (
                          <img src={e.thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{c.icon}</span>
                        )}
                        {e.extraImages && e.extraImages.length > 0 && (
                          <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1 font-bold rounded-tl-lg backdrop-blur-sm">
                            +{e.extraImages.length}
                          </span>
                        )}
                        {warns.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] grid place-items-center shadow">!</span>}
                      </button>
                      <button onClick={() => setEditingExpenseId(e.id)} className="flex-1 min-w-0 text-left hover:opacity-80 transition">
                        <div className="flex items-center gap-2">
                          <CategoryBadge id={e.categoria} size="sm" />
                          {e.ora && <span className="text-[11px] text-ink/50 font-mono font-semibold">{e.ora}</span>}
                        </div>
                        <p className="font-bold text-ink truncate mt-1 text-sm">{e.esercente}</p>
                        {e.descrizione && <p className="text-xs text-ink/60 truncate mt-0.5">{e.descrizione}</p>}
                        {warns.length > 0 && <p className="text-[11px] text-amber-700 truncate mt-1 font-semibold">⚠️ {warns.map((w) => w.message).join(" · ")}</p>}
                      </button>
                      <div className="text-right shrink-0 flex flex-col justify-between items-end h-full py-0.5">
                        <p className="font-mono text-base font-extrabold text-ink">{fmtMoney(e.importo, e.valuta)}</p>
                        <button onClick={() => onDeleteExpense(e.id)} className="text-[11px] font-bold text-red-500 hover:text-red-700 mt-2 px-2 py-1 bg-red-50 rounded-md">
                          Elimina
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
