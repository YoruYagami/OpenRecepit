import React from 'react';
import { fmtDate, fmtMoney } from '../../utils/formatters.js';
import { CATEGORIES, CATEGORY_IDS, DOC_TYPES } from '../../constants.js';
import { expenseWarnings, requiredDocsList } from '../../utils/expenseLogic.js';
import { CategoryBadge } from '../ui/CategoryBadge.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { Field, TextInput, SelectInput } from '../ui/Input.jsx';

export function EditableReceiptCard({
  item,
  onChange,
  onConfirm,
  onDiscard,
  onRetry,
  onReanalyze,
  onAddAttachment,
  onViewImage,
  confirmLabel = "Conferma",
  showActions = true,
  settings,
  trip,
  compact,
  onExpand,
  inQueue,
}) {
  const previewUrl = item?.full || item?.thumb || null;
  const extraImages = item?.extraImages || [];
  const openViewer = (ev, urlOverride) => {
    if (ev) ev.stopPropagation();
    const url = urlOverride || previewUrl;
    if (!url || !onViewImage) return;
    onViewImage({
      url: url,
      caption: item?.data?.esercente || item?.fileName || "Scontrino",
      filename: `${item?.data?.esercente || item?.fileName || "scontrino"}_${item?.data?.data || ""}`,
    });
  };
  const status = item.status;
  const data = item.data || {};

  const update = (patch) => onChange({ ...item, data: { ...item.data, ...patch } });

  const updateDoc = (id, value) => {
    const docs = { ...(data.documents || {}), [id]: value };
    update({ documents: docs });
  };

  const requiredIds = settings ? requiredDocsList(settings) : [];
  const warnings =
    settings && (status === "done" || status === "confirmed")
      ? expenseWarnings(data, settings, trip, { skipMissingIfSingle: !!inQueue })
      : [];

  if (compact && (status === "done" || status === "confirmed")) {
    const c = CATEGORIES[data.categoria] || CATEGORIES.altro;
    const docs = data.documents || {};
    const isMerged = !!data.merged;
    const detectionOnly = inQueue && !isMerged;
    const visibleDocs = detectionOnly
      ? DOC_TYPES.filter((d) => docs[d.id])
      : DOC_TYPES.filter((d) => requiredIds.includes(d.id) || docs[d.id]);
    const isDup = !!data.duplicateOf;
    return (
      <div
        className={`bg-white rounded-2xl shadow-soft overflow-hidden transition ${
          isDup
            ? "ring-2 ring-red-300"
            : warnings.length > 0
            ? "ring-1 ring-amber-300"
            : ""
        } ${status === "confirmed" ? "opacity-60" : "hover:bg-black/[0.01]"}`}
      >
        <div className="flex items-stretch gap-3 p-3">
          <button
            type="button"
            onClick={(ev) => openViewer(ev)}
            disabled={!previewUrl || !onViewImage}
            className="shrink-0 w-14 h-14 rounded-xl overflow-hidden grid place-items-center relative active:scale-95 transition"
            style={{ backgroundColor: c.color + "1a" }}
            aria-label="Vedi immagine"
          >
            {item.thumb ? (
              <img src={item.thumb} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">{c.icon}</span>
            )}
            {extraImages.length > 0 && (
              <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1 font-bold rounded-tl-lg backdrop-blur-sm">
                +{extraImages.length}
              </span>
            )}
            {isDup ? (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] grid place-items-center shadow">⛔</span>
            ) : warnings.length > 0 ? (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] grid place-items-center shadow">!</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onExpand}
            className="flex-1 min-w-0 flex items-stretch gap-3 text-left active:scale-[0.99] transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CategoryBadge id={data.categoria} size="sm" />
                <span className="text-[11px] text-ink/50">{fmtDate(data.data)}</span>
                {status === "confirmed" && (
                  <span className="text-[10px] font-bold text-emerald-600">✓</span>
                )}
              </div>
              <p className="font-bold text-ink truncate mt-0.5">{data.esercente}</p>
              {visibleDocs.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {visibleDocs.map((d) => {
                    const on = !!docs[d.id];
                    const showRed = !on && !detectionOnly;
                    return (
                      <span
                        key={d.id}
                        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                          on
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : showRed
                            ? "bg-red-50 text-red-700 border-red-300"
                            : "bg-black/[0.04] text-ink/50 border-black/10"
                        }`}
                      >
                        <span aria-hidden>{on ? "✓" : showRed ? "✕" : ""}</span>
                        <span aria-hidden>{d.icon}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="text-right shrink-0 flex flex-col items-end justify-between">
              <p className="font-mono text-base font-extrabold text-ink leading-tight">
                {fmtMoney(data.importo, data.valuta)}
              </p>
              <span className="text-[10px] text-ink/40">tocca per espandere</span>
            </div>
          </button>
        </div>
        {isDup && (
          <div className="px-3 pb-2 -mt-1 flex items-center justify-between gap-2">
            <p className="text-[11px] text-red-700 truncate font-semibold">
              ⛔ Duplicato di: {data.duplicateLabel || "spesa già presente"}
            </p>
            {onDiscard && (
              <button
                onClick={(ev) => { ev.stopPropagation(); onDiscard(item.id); }}
                className="text-[11px] font-bold text-red-700 px-2 py-0.5 rounded-md hover:bg-red-100 shrink-0"
              >
                Scarta
              </button>
            )}
          </div>
        )}
        {!isDup && warnings.length > 0 && (
          <div className="px-3 pb-2 -mt-1">
            <p className="text-[11px] text-amber-700 truncate">
              ⚠️ {warnings.map((w) => w.message).join(" · ")}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="shrink-0 flex gap-2 overflow-x-auto pb-1 max-w-[50%] scrollbar-hide">
          <button
            type="button"
            onClick={(ev) => openViewer(ev)}
            disabled={!previewUrl || !onViewImage}
            className="w-20 h-24 rounded-xl bg-black/5 overflow-hidden grid place-items-center active:scale-95 transition relative group shrink-0"
          >
            {item.thumb ? (
              <img src={item.thumb} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🧾</span>
            )}
            {previewUrl && onViewImage && (
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] grid place-items-center backdrop-blur-sm">
                🔍
              </span>
            )}
          </button>
          
          {extraImages.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={(ev) => openViewer(ev, img.full || img.thumb)}
              className="w-20 h-24 rounded-xl bg-black/5 overflow-hidden grid place-items-center active:scale-95 transition relative shrink-0"
            >
              <img src={img.thumb} alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] grid place-items-center backdrop-blur-sm">
                🔍
              </span>
            </button>
          ))}

          {onAddAttachment && (
            <div className="w-20 h-24 flex flex-col gap-1 shrink-0">
              <button 
                type="button" 
                onClick={() => onAddAttachment("camera")} 
                className="flex-1 rounded-xl bg-black/5 flex items-center justify-center text-ink/50 hover:bg-black/10 transition active:scale-95 text-xl"
                title="Scatta foto allegato"
              >
                📷
              </button>
              <button 
                type="button" 
                onClick={() => onAddAttachment("gallery")} 
                className="flex-1 rounded-xl bg-black/5 flex items-center justify-center text-ink/50 hover:bg-black/10 transition active:scale-95 text-xl"
                title="Carica foto allegato"
              >
                🖼️
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-ink/70">
              <Spinner className="w-4 h-4" />
              <span>Analisi in corso…</span>
            </div>
          )}
          {status === "pending" && <div className="text-sm text-ink/50">In coda</div>}
          {status === "error" && (
            <div className="text-sm text-red-700">
              <div className="font-semibold flex items-center gap-1.5">❌ Errore</div>
              <div className="text-xs mt-0.5 break-words">{item.error}</div>
            </div>
          )}
          {(status === "done" || status === "confirmed") && (
            <>
              <div className="flex items-center justify-between gap-2">
                <CategoryBadge id={data.categoria} size="sm" />
                <div className="flex items-center gap-1.5">
                  {onReanalyze && item.full && (
                    <button
                      type="button"
                      onClick={() => onReanalyze(item.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink/60 hover:text-ink px-2 py-1 rounded-md hover:bg-black/5 active:scale-95"
                    >
                      <span aria-hidden>↻</span>
                      <span>Rianalizza</span>
                    </button>
                  )}
                  <span className="text-[11px] text-ink/50">{status === "confirmed" ? "✅ Confermato" : "✅ Pronto"}</span>
                </div>
              </div>
              <input
                value={data.esercente ?? ""}
                onChange={(e) => update({ esercente: e.target.value })}
                className="mt-1.5 w-full font-bold text-ink bg-transparent focus:outline-none border-b border-transparent focus:border-black/10 py-0.5"
                placeholder="Esercente"
              />
              <input
                value={data.descrizione ?? ""}
                onChange={(e) => update({ descrizione: e.target.value })}
                className="mt-0.5 w-full text-sm text-ink/70 bg-transparent focus:outline-none border-b border-transparent focus:border-black/10 py-0.5"
                placeholder="Descrizione"
              />
            </>
          )}
        </div>
      </div>

      {(status === "done" || status === "confirmed") && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          <Field label="Data">
            <TextInput type="date" value={data.data || ""} onChange={(e) => update({ data: e.target.value })} />
          </Field>
          <Field label="Ora">
            <TextInput type="time" value={data.ora || ""} onChange={(e) => update({ ora: e.target.value || null })} />
          </Field>
          <Field label="Importo">
            <div className="relative">
              <TextInput type="number" step="0.01" inputMode="decimal" value={data.importo ?? ""} onChange={(e) => update({ importo: parseFloat(e.target.value) || 0 })} className="w-full font-mono pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/50 font-mono">{data.valuta || "EUR"}</span>
            </div>
          </Field>
          <Field label="Valuta">
            <TextInput value={data.valuta || "EUR"} onChange={(e) => update({ valuta: e.target.value.toUpperCase().slice(0, 6) })} />
          </Field>
          <div className="col-span-2">
            <Field label="Categoria">
              <SelectInput value={data.categoria || "altro"} onChange={(e) => update({ categoria: e.target.value })}>
                {CATEGORY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CATEGORIES[id].icon}  {CATEGORIES[id].label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </div>
      )}

      {(status === "done" || status === "confirmed") && (() => {
        const isMerged = !!data.merged;
        const docs = data.documents || {};
        const detectionOnly = inQueue && !isMerged;
        const chips = detectionOnly ? DOC_TYPES.filter((d) => docs[d.id]) : DOC_TYPES;
        if (chips.length === 0) return null;
        return (
          <div className="px-3 pb-3">
            <p className="text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1.5">
              {detectionOnly ? "Documento rilevato" : "Documenti allegati"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((d) => {
                const isRequired = requiredIds.includes(d.id);
                const isOn = !!docs[d.id];
                const showRed = !isOn && !detectionOnly && isRequired;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => updateDoc(d.id, !isOn)}
                    className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
                      isOn
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : showRed
                        ? "bg-red-50 text-red-700 border-red-300"
                        : "bg-white text-ink/60 border-black/10"
                    }`}
                  >
                    <span aria-hidden>{isOn ? "✓" : showRed ? "✕" : "○"}</span>
                    <span aria-hidden>{d.icon}</span>
                    <span>{d.label}</span>
                    {!detectionOnly && isRequired && <span aria-hidden className="opacity-70">*</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {data.duplicateOf && (status === "done" || status === "confirmed") && (
        <div className="mx-3 mb-2 rounded-xl bg-red-50 border border-red-300 px-3 py-2 flex items-start gap-2">
          <span aria-hidden className="text-red-600 mt-0.5">⛔</span>
          <div className="flex-1 min-w-0 text-xs text-red-800">
            <p className="font-bold">Possibile duplicato</p>
            <p className="opacity-90 truncate">Spesa già presente: {data.duplicateLabel || "stessa spesa"}</p>
          </div>
          {onDiscard && (
            <button onClick={() => onDiscard(item.id)} className="text-[11px] font-bold text-red-700 hover:text-red-900 px-2 py-1 rounded-md hover:bg-red-100 shrink-0">Scarta</button>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mx-3 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-800">
              <span aria-hidden className="mt-0.5">⚠️</span>
              <span className="font-semibold">{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {showActions && (
        <div className="border-t border-black/5 p-2 flex gap-2">
          {status === "error" && (
            <>
              <button onClick={() => onDiscard(item.id)} className="flex-1 h-10 rounded-xl bg-black/5 text-ink/70 font-semibold text-sm active:scale-[0.98]">Scarta</button>
              <button onClick={() => onRetry(item.id)} className="flex-1 h-10 rounded-xl bg-ink text-white font-semibold text-sm active:scale-[0.98]">Riprova</button>
            </>
          )}
          {(status === "done") && (
            <>
              <button onClick={() => onDiscard(item.id)} className="flex-1 h-10 rounded-xl bg-black/5 text-ink/70 font-semibold text-sm active:scale-[0.98]">Scarta</button>
              <button onClick={() => onConfirm(item.id)} className="flex-1 h-10 rounded-xl bg-ink text-white font-semibold text-sm active:scale-[0.98]">{confirmLabel}</button>
            </>
          )}
          {status === "processing" && (
            <button disabled className="flex-1 h-10 rounded-xl bg-black/5 text-ink/40 font-semibold text-sm">Attendere…</button>
          )}
          {status === "confirmed" && (
            <button disabled className="flex-1 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-sm">Aggiunto</button>
          )}
        </div>
      )}
    </div>
  );
}
