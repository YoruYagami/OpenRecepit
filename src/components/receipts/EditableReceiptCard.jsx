import React, { useState } from "react";
import { fmtDate, fmtMoney } from "../../utils/formatters.js";
import { CATEGORIES, CATEGORY_IDS } from "../../constants.js";
import { expenseWarnings } from "../../utils/expenseLogic.js";
import { CategoryBadge } from "../ui/CategoryBadge.jsx";
import { Spinner } from "../ui/Spinner.jsx";
import { Field, TextInput, SelectInput } from "../ui/Input.jsx";
import { Icon } from "../ui/Icon.jsx";

const PRESET_CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

export function EditableReceiptCard({
  item,
  onChange,
  onConfirm,
  onDiscard,
  onRetry,
  onSaveRaw,
  onSplit,
  onAttach,
  onReanalyze,
  onAddAttachment,
  onViewImage,
  confirmLabel = "Conferma",
  showActions = true,
  settings,
  trip,
  compact,
  onExpand,
}) {
  const previewUrl = item?.full || item?.thumb || null;
  const hasPreview = !!(previewUrl || item?.fullRef);
  const extraImages = item?.extraImages || [];
  const openViewer = (ev, override) => {
    if (ev) ev.stopPropagation();
    const url = override ? override.url : previewUrl;
    const fullRef = override ? override.fullRef : item?.full ? null : item?.fullRef;
    const pdf = override ? !!override.pdf : !!(item?.isPdf || item?.data?.pdf);
    if ((!url && !fullRef) || !onViewImage) return;
    onViewImage({
      url,
      fullRef,
      pdf,
      caption: item?.data?.esercente || item?.fileName || "Scontrino",
      filename:
        (override && override.fileName) ||
        (pdf && (item?.fileName || item?.data?.fileName)) ||
        `${item?.data?.esercente || item?.fileName || "scontrino"}_${item?.data?.data || ""}`,
    });
  };
  const status = item.status;
  const data = item.data || {};

  const update = (patch) => onChange({ ...item, data: { ...item.data, ...patch } });

  // Free-text currency only when the value isn't one of the common presets.
  const [customCurrency, setCustomCurrency] = useState(
    () => !!data.valuta && !PRESET_CURRENCIES.includes(data.valuta)
  );

  const warnings =
    settings && (status === "done" || status === "confirmed")
      ? expenseWarnings(data, settings, trip)
      : [];

  if (compact && (status === "done" || status === "confirmed")) {
    const c = CATEGORIES[data.categoria] || CATEGORIES.altro;
    const isDup = !!data.duplicateOf;
    return (
      <div
        className={`bg-surface rounded-2xl shadow-soft overflow-hidden transition ${
          isDup ? "ring-2 ring-danger-line" : warnings.length > 0 ? "ring-1 ring-warn-line" : ""
        } ${status === "confirmed" ? "opacity-60" : "hover:bg-surface-2/40"}`}
      >
        <div className="flex items-stretch gap-3 p-3">
          <button
            type="button"
            onClick={(ev) => openViewer(ev)}
            disabled={!hasPreview || !onViewImage}
            className="shrink-0 w-14 h-14 rounded-xl overflow-hidden grid place-items-center relative active:scale-95 transition cat-tint"
            style={{ "--cat": c.color }}
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
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger-solid text-white text-[10px] grid place-items-center shadow">
                <Icon name="ban" className="w-3 h-3" />
              </span>
            ) : warnings.length > 0 ? (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warn-solid text-white text-[11px] grid place-items-center shadow">
                !
              </span>
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
                  <span className="text-[10px] font-bold text-ok">✓</span>
                )}
              </div>
              <p className="font-bold text-ink truncate mt-0.5">{data.esercente}</p>
              {item.mergedCount > 1 ? (
                <p className="text-[11px] text-ok font-semibold truncate mt-0.5">
                  {item.mergedCount} documenti uniti
                </p>
              ) : data.attachToId ? (
                <p className="text-[11px] text-ink/60 truncate mt-0.5">
                  Documento di: {data.attachToLabel}
                </p>
              ) : (
                data.descrizione && (
                  <p className="text-xs text-ink/55 truncate mt-0.5">{data.descrizione}</p>
                )
              )}
            </div>
            <div className="text-right shrink-0 flex flex-col items-end justify-between">
              <p className="font-mono text-base font-extrabold text-ink leading-tight">
                {fmtMoney(data.importo, data.valuta)}
              </p>
              <span className="text-[10px] text-ink/55">tocca per espandere</span>
            </div>
          </button>
        </div>
        {isDup && (
          <div className="px-3 pb-2 -mt-1 flex items-center justify-between gap-2">
            <p className="text-[11px] text-danger font-semibold flex items-center gap-1 min-w-0">
              <Icon name="ban" className="w-4 h-4 shrink-0" />
              <span className="truncate">
                Duplicato di: {data.duplicateLabel || "spesa già presente"}
              </span>
            </p>
            {onDiscard && (
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  onDiscard(item.id);
                }}
                className="text-[11px] font-bold text-danger px-2 py-0.5 rounded-md hover:bg-danger-line/40 shrink-0"
              >
                Scarta
              </button>
            )}
          </div>
        )}
        {!isDup && warnings.length > 0 && (
          <div className="px-3 pb-2 -mt-1">
            <p className="text-[11px] text-warn flex items-center gap-1">
              <Icon name="warning" className="w-3.5 h-3.5 inline shrink-0" />
              <span className="truncate">{warnings.map((w) => w.message).join(" · ")}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  // Expanded/editing layout: single column — image strip on top, then full-width
  // labeled fields (the old two-column squeeze clipped labels and values).
  return (
    <div className="bg-surface rounded-2xl shadow-soft overflow-hidden">
      <div className="p-3 flex flex-col gap-3">
        {status === "processing" && (
          <div className="flex items-center gap-2 text-sm text-ink/70">
            <Spinner className="w-4 h-4" />
            <span>Analisi in corso…</span>
          </div>
        )}
        {status === "pending" && <div className="text-sm text-ink/50">In coda</div>}
        {status === "error" && (
          <div className="text-sm text-danger">
            <div className="font-semibold flex items-center gap-1.5">
              <Icon name="warning" className="w-4 h-4" /> Errore
            </div>
            <div className="text-xs mt-0.5 break-words">{item.error}</div>
          </div>
        )}
        {item.mergedCount > 1 && (status === "done" || status === "confirmed") && (
          <div className="rounded-xl bg-ok-soft border border-ok-line px-3 py-2 flex items-center gap-2">
            <Icon name="check" className="w-4 h-4 text-ok shrink-0" />
            <p className="text-xs text-ok flex-1 min-w-0">
              <span className="font-bold">{item.mergedCount} documenti uniti</span> in questa
              spesa (scontrino, POS, estratto…)
            </p>
            {onSplit && status === "done" && (
              <button
                onClick={() => onSplit(item.id)}
                className="text-[11px] font-bold text-ok px-2 py-1 rounded-md hover:bg-ok-line/30 shrink-0"
              >
                Separa
              </button>
            )}
          </div>
        )}

        {data.attachToId && status === "done" && (
          <div className="rounded-xl bg-surface-2 border border-line px-3 py-2 flex items-center gap-2">
            <Icon name="plus" className="w-4 h-4 text-ink/60 shrink-0" />
            <p className="text-xs text-ink/70 flex-1 min-w-0">
              Sembra un documento di:{" "}
              <span className="font-bold text-ink">{data.attachToLabel}</span>
            </p>
          </div>
        )}

        {(status === "done" || status === "confirmed") && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CategoryBadge id={data.categoria} size="sm" />
            <div className="flex items-center gap-1.5 shrink-0">
              {onReanalyze && (item.full || item.fullRef) && (
                <button
                  type="button"
                  onClick={() => onReanalyze(item.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink/60 hover:text-ink px-2 py-1 rounded-md hover:bg-surface-2 active:scale-95"
                >
                  <Icon name="refresh" className="w-3 h-3" />
                  <span>Rianalizza</span>
                </button>
              )}
              <span className="text-[11px] font-semibold text-ok inline-flex items-center gap-1">
                <Icon name="check" className="w-3.5 h-3.5" />
                {status === "confirmed" ? "Confermato" : "Pronto"}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
          <button
            type="button"
            onClick={(ev) => openViewer(ev)}
            disabled={!hasPreview || !onViewImage}
            className="w-16 h-20 rounded-xl bg-surface-2 overflow-hidden grid place-items-center active:scale-95 transition relative shrink-0"
          >
            {item.thumb ? (
              <img src={item.thumb} alt="" className="w-full h-full object-cover" />
            ) : item.isPdf || item.data?.pdf ? (
              <span className="flex flex-col items-center gap-0.5 text-ink/50">
                <Icon name="fileText" className="w-6 h-6" />
                <span className="text-[8px] font-bold uppercase">PDF</span>
              </span>
            ) : (
              <Icon name="receipt" className="w-6 h-6 text-ink/40" />
            )}
            {hasPreview && onViewImage && (
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white grid place-items-center backdrop-blur-sm">
                <Icon name="zoomIn" className="w-3 h-3" />
              </span>
            )}
          </button>

          {extraImages.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={(ev) =>
                openViewer(ev, {
                  url: img.full || img.thumb,
                  fullRef: img.full ? null : img.fullRef,
                  pdf: !!img.pdf,
                  fileName: img.fileName,
                })
              }
              className="w-16 h-20 rounded-xl bg-surface-2 overflow-hidden grid place-items-center active:scale-95 transition relative shrink-0"
            >
              {img.pdf ? (
                <span className="flex flex-col items-center gap-1 px-1 text-ink/60">
                  <Icon name="fileText" className="w-5 h-5" />
                  <span className="text-[8px] font-semibold truncate max-w-[52px]">
                    {img.fileName || "PDF"}
                  </span>
                </span>
              ) : (
                <img src={img.thumb} alt="" className="w-full h-full object-cover" />
              )}
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white grid place-items-center backdrop-blur-sm">
                <Icon name="zoomIn" className="w-3 h-3" />
              </span>
            </button>
          ))}

          {onAddAttachment && (
            <>
              <button
                type="button"
                onClick={() => onAddAttachment("camera")}
                className="w-14 h-20 rounded-xl border border-dashed border-line-strong flex flex-col items-center justify-center gap-1 text-ink/50 hover:bg-surface-2 transition active:scale-95 shrink-0"
                title="Scatta foto allegato"
                aria-label="Scatta foto allegato"
              >
                <Icon name="camera" className="w-5 h-5" />
                <span className="text-[9px] font-semibold">Scatta</span>
              </button>
              <button
                type="button"
                onClick={() => onAddAttachment("gallery")}
                className="w-14 h-20 rounded-xl border border-dashed border-line-strong flex flex-col items-center justify-center gap-1 text-ink/50 hover:bg-surface-2 transition active:scale-95 shrink-0"
                title="Allega file (foto o PDF)"
                aria-label="Allega file (foto o PDF)"
              >
                <Icon name="plus" className="w-5 h-5" />
                <span className="text-[9px] font-semibold">Allega</span>
              </button>
            </>
          )}
        </div>

        {(status === "done" || status === "confirmed") && (
          <div className="flex flex-col gap-3">
            <Field label="Esercente">
              <TextInput
                value={data.esercente ?? ""}
                onChange={(e) => update({ esercente: e.target.value })}
                placeholder="Es. Trattoria Roma"
                className="font-semibold"
              />
            </Field>
            <Field label="Descrizione">
              <TextInput
                value={data.descrizione ?? ""}
                onChange={(e) => update({ descrizione: e.target.value })}
                placeholder="Breve descrizione"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Importo">
                <div className="relative">
                  <TextInput
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={data.importo ?? ""}
                    onChange={(e) => update({ importo: parseFloat(e.target.value) || 0 })}
                    className="w-full font-mono pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/50 font-mono">
                    {data.valuta || "EUR"}
                  </span>
                </div>
              </Field>
              <Field label="Valuta">
                {customCurrency ? (
                  <div className="relative">
                    <TextInput
                      value={data.valuta || ""}
                      onChange={(e) =>
                        update({ valuta: e.target.value.toUpperCase().slice(0, 6) })
                      }
                      className="w-full pr-9"
                      placeholder="Es. SEK"
                    />
                    <button
                      type="button"
                      aria-label="Torna alle valute comuni"
                      onClick={() => {
                        setCustomCurrency(false);
                        update({ valuta: "EUR" });
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-surface-2 grid place-items-center text-ink/50"
                    >
                      <Icon name="x" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <SelectInput
                    value={PRESET_CURRENCIES.includes(data.valuta) ? data.valuta : "EUR"}
                    onChange={(e) => {
                      if (e.target.value === "__other") setCustomCurrency(true);
                      else update({ valuta: e.target.value });
                    }}
                  >
                    {PRESET_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__other">Altra…</option>
                  </SelectInput>
                )}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Data">
                <TextInput
                  type="date"
                  value={data.data || ""}
                  onChange={(e) => update({ data: e.target.value })}
                />
              </Field>
              <Field label="Ora">
                <TextInput
                  type="time"
                  value={data.ora || ""}
                  onChange={(e) => update({ ora: e.target.value || null })}
                />
              </Field>
            </div>
            <Field label="Categoria">
              <SelectInput
                value={data.categoria || "altro"}
                onChange={(e) => update({ categoria: e.target.value })}
              >
                {CATEGORY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CATEGORIES[id].icon} {CATEGORIES[id].label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {Array.isArray(data.iva) && data.iva.length > 0 && (
              <div className="rounded-xl bg-surface-2/60 px-3 py-2 text-xs text-ink/70 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold uppercase tracking-wide text-[10px] text-ink/50">
                  IVA rilevata
                </span>
                {data.iva.map((r, i) => (
                  <span key={i}>
                    {r.aliquota}%:{" "}
                    <span className="font-mono font-bold text-ink">
                      {fmtMoney(r.imposta, data.valuta)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {data.duplicateOf && (status === "done" || status === "confirmed") && (
        <div className="mx-3 mb-2 rounded-xl bg-danger-soft border border-danger-line px-3 py-2 flex items-start gap-2">
          <Icon name="ban" className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-xs text-danger">
            <p className="font-bold">Possibile duplicato</p>
            <p className="opacity-90 truncate">
              Spesa già presente: {data.duplicateLabel || "stessa spesa"}
            </p>
          </div>
          {onDiscard && (
            <button
              onClick={() => onDiscard(item.id)}
              className="text-[11px] font-bold text-danger hover:text-danger px-2 py-1 rounded-md hover:bg-danger-line/40 shrink-0"
            >
              Scarta
            </button>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mx-3 mb-3 rounded-xl bg-warn-soft border border-warn-line px-3 py-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-warn">
              <Icon name="warning" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="font-semibold">{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {showActions && (
        <div className="border-t border-line p-2 flex flex-wrap gap-2">
          {status === "error" && (
            <>
              <button
                onClick={() => onDiscard(item.id)}
                className="flex-1 h-10 rounded-xl bg-surface-2 text-ink/70 font-semibold text-sm active:scale-[0.98]"
              >
                Scarta
              </button>
              <button
                onClick={() => onRetry(item.id)}
                className="flex-1 h-10 rounded-xl bg-ink text-paper font-semibold text-sm active:scale-[0.98]"
              >
                Riprova
              </button>
              {onSaveRaw && (item.thumb || item.full) && (
                <button
                  onClick={() => onSaveRaw(item.id)}
                  className="basis-full h-10 rounded-xl bg-surface border border-line-strong text-ink font-semibold text-sm active:scale-[0.98] inline-flex items-center justify-center gap-1.5"
                >
                  <Icon name="save" className="w-4 h-4" /> Salva senza analisi
                </button>
              )}
            </>
          )}
          {status === "done" && (
            <>
              <button
                onClick={() => onDiscard(item.id)}
                className="flex-1 h-10 rounded-xl bg-surface-2 text-ink/70 font-semibold text-sm active:scale-[0.98]"
              >
                Scarta
              </button>
              {data.attachToId && onAttach ? (
                <>
                  <button
                    onClick={() => onAttach(item.id)}
                    className="flex-1 h-10 rounded-xl bg-ink text-paper font-semibold text-sm active:scale-[0.98] inline-flex items-center justify-center gap-1.5"
                  >
                    <Icon name="plus" className="w-4 h-4" /> Allega
                  </button>
                  <button
                    onClick={() => onConfirm(item.id)}
                    className="basis-full h-10 rounded-xl bg-surface border border-line-strong text-ink font-semibold text-sm active:scale-[0.98]"
                  >
                    Aggiungi come spesa separata
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onConfirm(item.id)}
                  className="flex-1 h-10 rounded-xl bg-ink text-paper font-semibold text-sm active:scale-[0.98]"
                >
                  {confirmLabel}
                </button>
              )}
            </>
          )}
          {status === "processing" && (
            <button
              disabled
              className="flex-1 h-10 rounded-xl bg-surface-2 text-ink/40 font-semibold text-sm"
            >
              Attendere…
            </button>
          )}
          {status === "confirmed" && (
            <button
              disabled
              className="flex-1 h-10 rounded-xl bg-ok-soft text-ok font-semibold text-sm"
            >
              Aggiunto
            </button>
          )}
        </div>
      )}
    </div>
  );
}
