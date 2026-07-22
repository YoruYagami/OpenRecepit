import React, { useState, useMemo, useRef, useEffect } from "react";
import { fmtDateRange, fmtMoney, fmtDayLabel, expenseTimeMinutes } from "../utils/formatters.js";
import { CATEGORIES } from "../constants.js";
import {
  expenseWarnings,
  totalsByCurrency,
  fmtCurrencyTotals,
} from "../utils/expenseLogic.js";
import { EditableReceiptCard } from "../components/receipts/EditableReceiptCard.jsx";
import { CategoryBadge } from "../components/ui/CategoryBadge.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { TextInput } from "../components/ui/Input.jsx";

function MenuItem({ icon, label, onClick, disabled, spinning }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-3 h-10 flex items-center gap-2.5 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-50 text-left"
    >
      <Icon name={icon} className={`w-4 h-4 text-ink/60 ${spinning ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </button>
  );
}

export function TripDetailView({
  trip,
  onBack,
  onEditTrip,
  onDeleteExpense,
  onUpdateExpense,
  onAddExpense,
  onRemoveExpense,
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
  // Id of a manually-created expense still in its first edit: cancelling it
  // removes the expense instead of leaving an empty €0.00 row behind.
  const manualNewIdRef = useRef(null);

  // Filters are view-local state (deliberately not history entries).
  const [activeCats, setActiveCats] = useState(() => new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Compact sticky bar appears once the big header scrolls out of view.
  const [showStickyBar, setShowStickyBar] = useState(false);
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setShowStickyBar(!entry.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const addManualExpense = () => {
    if (!onAddExpense) return;
    const id = onAddExpense();
    if (id) {
      manualNewIdRef.current = id;
      setEditingExpenseId(id);
    }
  };

  const tripCats = useMemo(
    () => [...new Set(trip.expenses.map((e) => e.categoria))],
    [trip.expenses]
  );

  const filtersActive = activeCats.size > 0 || search.trim().length > 0;
  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trip.expenses.filter((e) => {
      if (activeCats.size > 0 && !activeCats.has(e.categoria)) return false;
      if (q && !`${e.esercente || ""} ${e.descrizione || ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [trip.expenses, activeCats, search]);

  const groupedByDay = useMemo(() => {
    const map = new Map();
    for (const e of filteredExpenses) {
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
      total: totalsByCurrency(items),
    }));
  }, [filteredExpenses]);

  const totalsByCat = useMemo(() => {
    const map = {};
    trip.expenses.forEach((e) => {
      (map[e.categoria] ||= []).push(e);
    });
    return Object.entries(map)
      .map(([cat, items]) => [cat, totalsByCurrency(items)])
      .sort((a, b) => {
        const sum = (m) => Object.values(m).reduce((s, v) => s + v, 0);
        return sum(b[1]) - sum(a[1]);
      });
  }, [trip.expenses]);

  const grandTotal = useMemo(
    () => fmtCurrencyTotals(totalsByCurrency(trip.expenses)),
    [trip.expenses]
  );

  const clearFilters = () => {
    setActiveCats(new Set());
    setSearch("");
    setSearchOpen(false);
  };

  return (
    <div className="pb-28 fade-in">
      {showStickyBar && (
        <div className="sticky -top-4 z-20 bg-paper/95 backdrop-blur-md border-b border-line px-5 py-2 flex items-center gap-2 fade-in -mt-2 mb-2">
          <button
            onClick={onBack}
            aria-label="Trasferte"
            className="w-8 h-8 rounded-full hover:bg-surface-2 grid place-items-center text-ink/60 shrink-0"
          >
            <Icon name="arrowLeft" className="w-4 h-4" />
          </button>
          <p className="flex-1 min-w-0 font-bold text-ink truncate text-sm">{trip.name}</p>
          <p className="font-mono text-sm font-extrabold text-ink shrink-0">{grandTotal}</p>
        </div>
      )}

      <div className="px-5 pt-2 pb-4">
        <button
          onClick={onBack}
          className="text-sm font-semibold text-ink/60 inline-flex items-center gap-1 mb-3 hover:text-ink bg-surface-2 px-2.5 py-1 rounded-lg"
        >
          <Icon name="arrowLeft" className="w-4 h-4" /> Trasferte
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-ink truncate">{trip.name}</h2>
            <p className="text-sm text-ink/60 truncate mt-0.5">
              {[trip.city, fmtDateRange(trip.startDate, trip.endDate)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            onClick={onEditTrip}
            className="shrink-0 w-10 h-10 rounded-full bg-surface border border-line hover:bg-surface-2 grid place-items-center text-ink/60"
            aria-label="Modifica trasferta"
            title="Modifica"
          >
            <Icon name="pencil" className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 bg-surface rounded-2xl shadow-soft p-5 flex items-center justify-between border border-line">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-ink/50">
              Totale Trasferta
            </p>
            <p className="font-mono text-3xl font-extrabold text-ink mt-0.5">{grandTotal}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider font-bold text-ink/50">Scontrini</p>
            <p className="text-2xl font-extrabold text-ink mt-0.5">{trip.expenses.length}</p>
          </div>
        </div>
        <div ref={sentinelRef} aria-hidden />
      </div>

      {totalsByCat.length > 0 && (
        <div className="px-5">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1">
            {totalsByCat.map(([cat, amt]) => {
              const c = CATEGORIES[cat] || CATEGORIES.altro;
              return (
                <div
                  key={cat}
                  className="shrink-0 rounded-xl px-3 py-2 flex items-center gap-2 cat-tint"
                  style={{ "--cat": c.color }}
                >
                  <span aria-hidden>{c.icon}</span>
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wide font-semibold">{c.label}</p>
                    <p className="font-mono text-sm font-bold">{fmtCurrencyTotals(amt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 mt-4 grid grid-cols-3 gap-2">
        <button
          onClick={onScanCamera}
          className="h-12 rounded-xl bg-ink text-paper text-sm font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-soft hover:bg-ink/90 transition"
        >
          <Icon name="camera" className="w-4 h-4" /> Scatta
        </button>
        <button
          onClick={onScanGallery}
          className="h-12 rounded-xl bg-surface border border-line-strong text-ink text-sm font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-soft hover:bg-surface-2 transition"
        >
          <Icon name="image" className="w-4 h-4" /> Carica
        </button>
        <button
          onClick={addManualExpense}
          className="h-12 rounded-xl bg-surface border border-line-strong text-ink text-sm font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-soft hover:bg-surface-2 transition"
        >
          <Icon name="plus" className="w-4 h-4" /> Manuale
        </button>
      </div>

      {trip.expenses.length > 0 && (
        <div className="px-5 mt-3 flex items-center justify-between relative">
          <span className="text-xs font-semibold text-ink/50">
            {trip.expenses.length} scontrin{trip.expenses.length === 1 ? "o" : "i"}
          </span>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Altre azioni"
            className="w-9 h-9 rounded-full hover:bg-surface-2 grid place-items-center text-ink/60"
          >
            <Icon name="dots" className="w-5 h-5" />
          </button>
          {menuOpen && (
            <>
              <button
                aria-label="Chiudi menu"
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-5 top-10 z-30 bg-surface border border-line shadow-soft-lg rounded-xl py-1 w-52 fade-in">
                <MenuItem
                  icon="download"
                  label="Esporta CSV"
                  onClick={() => {
                    setMenuOpen(false);
                    onExportCSV();
                  }}
                />
                <MenuItem
                  icon="fileText"
                  label="Riepilogo"
                  onClick={() => {
                    setMenuOpen(false);
                    onExportSummary();
                  }}
                />
                <MenuItem
                  icon="refresh"
                  label="Rianalizza tutto"
                  disabled={!!reanalyzingId}
                  spinning={!!reanalyzingId}
                  onClick={() => {
                    setMenuOpen(false);
                    onReanalyzeTrip?.(trip.id);
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {trip.expenses.length > 5 && (
        <div className="px-5 mt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
              <button
                onClick={() => setActiveCats(new Set())}
                className={`shrink-0 inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold transition ${
                  activeCats.size === 0
                    ? "bg-ink text-paper"
                    : "bg-surface-2 text-ink/70 hover:text-ink"
                }`}
              >
                Tutte
              </button>
              {tripCats.map((cat) => {
                const c = CATEGORIES[cat] || CATEGORIES.altro;
                const active = activeCats.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() =>
                      setActiveCats((prev) => {
                        const next = new Set(prev);
                        if (next.has(cat)) next.delete(cat);
                        else next.add(cat);
                        return next;
                      })
                    }
                    className={`shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-xs font-semibold cat-tint transition ${
                      active ? "ring-2 ring-ink/40" : ""
                    }`}
                    style={{ "--cat": c.color }}
                  >
                    <span aria-hidden>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() =>
                setSearchOpen((s) => {
                  if (s) setSearch("");
                  return !s;
                })
              }
              aria-label="Cerca spese"
              className={`shrink-0 w-9 h-9 rounded-full grid place-items-center transition ${
                searchOpen ? "bg-ink text-paper" : "hover:bg-surface-2 text-ink/60"
              }`}
            >
              <Icon name="search" className="w-4 h-4" />
            </button>
          </div>
          {searchOpen && (
            <TextInput
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca esercente o descrizione…"
              className="mt-2 w-full"
            />
          )}
        </div>
      )}

      <div className="px-5 mt-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60 mb-3 border-b border-line pb-2">
          Dettaglio Spese
        </h3>
        {trip.expenses.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-soft p-8 text-center mt-4">
            <div className="text-4xl mb-2 opacity-50">📸</div>
            <p className="font-semibold text-ink">Nessuno scontrino</p>
            <p className="text-sm text-ink/60 mt-1">Aggiungi una spesa per vederla qui.</p>
          </div>
        ) : filteredExpenses.length === 0 && filtersActive ? (
          <div className="bg-surface rounded-2xl shadow-soft p-8 text-center mt-4">
            <p className="font-semibold text-ink">Nessuna spesa corrisponde ai filtri</p>
            <button
              onClick={clearFilters}
              className="mt-3 h-9 px-4 rounded-lg bg-surface-2 text-sm font-semibold text-ink active:scale-[0.98]"
            >
              Azzera filtri
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedByDay.map(({ date, items, total }) => (
              <div key={date || "no-date"} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between px-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink/50 bg-surface-2 px-2 py-0.5 rounded-md">
                    {fmtDayLabel(date)}
                  </h4>
                  <span className="text-[11px] font-mono font-semibold text-ink/60">
                    {fmtCurrencyTotals(total)} · {items.length} spes
                    {items.length === 1 ? "a" : "e"}
                  </span>
                </div>
                {items.map((e) => {
                  if (editingExpenseId === e.id) {
                    const isReanalyzing = reanalyzingId === e.id;
                    return (
                      <div key={e.id}>
                        <EditableReceiptCard
                          item={{
                            id: e.id,
                            status: isReanalyzing ? "processing" : "done",
                            thumb: e.thumb,
                            full: e.full,
                            fullRef: e.fullRef,
                            extraImages: e.extraImages,
                            data: e,
                          }}
                          onChange={(it) => onUpdateExpense(e.id, it.data)}
                          onConfirm={() => {
                            manualNewIdRef.current = null;
                            setEditingExpenseId(null);
                          }}
                          onDiscard={() => {
                            if (manualNewIdRef.current === e.id && onRemoveExpense) {
                              onRemoveExpense(e.id);
                            }
                            manualNewIdRef.current = null;
                            setEditingExpenseId(null);
                          }}
                          onRetry={() => {}}
                          onReanalyze={
                            onReanalyzeExpense ? () => onReanalyzeExpense(e.id) : undefined
                          }
                          onAddAttachment={
                            onAddAttachment ? (mode) => onAddAttachment(e.id, mode) : undefined
                          }
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
                  const hasImage = !!(previewUrl || e.fullRef);
                  return (
                    <div
                      key={e.id}
                      className={`bg-surface rounded-2xl shadow-soft p-3 flex items-center gap-3 active:scale-[0.99] transition hover:shadow-md ${
                        warns.length > 0 ? "ring-1 ring-warn-line" : ""
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (hasImage && onViewImage) {
                            onViewImage({
                              url: previewUrl,
                              fullRef: e.full ? null : e.fullRef,
                              pdf: !!e.pdf,
                              caption: e.esercente,
                              filename:
                                e.fileName || `${e.esercente || "scontrino"}_${e.data || ""}`,
                            });
                          } else {
                            setEditingExpenseId(e.id);
                          }
                        }}
                        className="shrink-0 w-12 h-12 rounded-xl overflow-hidden grid place-items-center relative transition-transform hover:scale-105 cat-tint"
                        style={{ "--cat": c.color }}
                        aria-label="Vedi immagine"
                        title="Tocca per ingrandire"
                      >
                        {e.thumb ? (
                          <img src={e.thumb} alt="" className="w-full h-full object-cover" />
                        ) : e.pdf ? (
                          <Icon name="fileText" className="w-5 h-5" />
                        ) : (
                          <span className="text-xl">{c.icon}</span>
                        )}
                        {e.extraImages && e.extraImages.length > 0 && (
                          <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1 font-bold rounded-tl-lg backdrop-blur-sm">
                            +{e.extraImages.length}
                          </span>
                        )}
                        {warns.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warn-solid text-white text-[11px] grid place-items-center shadow">
                            !
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setEditingExpenseId(e.id)}
                        className="flex-1 min-w-0 text-left hover:opacity-80 transition"
                      >
                        <div className="flex items-center gap-2">
                          <CategoryBadge id={e.categoria} size="sm" />
                          {e.ora && (
                            <span className="text-[11px] text-ink/50 font-mono font-semibold">
                              {e.ora}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-ink truncate mt-1 text-sm">{e.esercente}</p>
                        {e.descrizione && (
                          <p className="text-xs text-ink/60 truncate mt-0.5">{e.descrizione}</p>
                        )}
                        {warns.length > 0 && (
                          <p className="text-[11px] text-warn mt-1 font-semibold flex items-center gap-1">
                            <Icon name="warning" className="w-3.5 h-3.5 inline shrink-0" />
                            <span className="truncate">
                              {warns.map((w) => w.message).join(" · ")}
                            </span>
                          </p>
                        )}
                      </button>
                      <div className="text-right shrink-0 flex flex-col justify-between items-end h-full py-0.5">
                        <p className="font-mono text-base font-extrabold text-ink">
                          {fmtMoney(e.importo, e.valuta)}
                        </p>
                        <button
                          onClick={() => onDeleteExpense(e.id)}
                          className="text-[11px] font-bold text-danger hover:text-danger mt-2 px-2 py-1 bg-danger-soft rounded-md"
                        >
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
