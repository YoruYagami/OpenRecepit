import React, { useState } from "react";
import { EditableReceiptCard } from "../components/receipts/EditableReceiptCard.jsx";
import { Icon } from "../components/ui/Icon.jsx";

/*
 * Scan queue body — rendered inside <Overlay variant="fullscreen"> by the
 * OverlayHost (backdrop, focus trap and Escape live in the shell).
 */
export function ScanQueueView({
  queue,
  onChangeItem,
  onConfirmItem,
  onDiscardItem,
  onRetryItem,
  onSaveRawItem,
  onReanalyzeItem,
  onConfirmAll,
  onDiscardAll,
  onAddPhotos,
  onClose,
  onViewImage,
  settings,
  trip,
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const total = queue.length;
  const done = queue.filter(
    (q) => q.status === "done" || q.status === "confirmed" || q.status === "error"
  ).length;
  const processing = queue.find((q) => q.status === "processing");
  const allFinished = queue.every((q) => q.status !== "pending" && q.status !== "processing");
  const confirmableCount = queue.filter((q) => q.status === "done").length;

  const toggleExpand = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between bg-paper">
        <div>
          <h2 className="text-xl font-extrabold text-ink">
            {allFinished ? "Revisione scontrini" : "Analisi scontrini"}
          </h2>
          <p className="text-sm text-ink/60">
            {allFinished
              ? `${queue.length} immagin${queue.length === 1 ? "e" : "i"} elaborat${queue.length === 1 ? "a" : "e"}`
              : `Analisi ${done}/${total}…`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {onAddPhotos && (
            <button
              onClick={onAddPhotos}
              className="h-10 px-3 rounded-full hover:bg-surface-2 inline-flex items-center gap-1.5 text-ink/70 text-xs font-semibold"
              title="Aggiungi altre foto alla coda"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>Foto</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-surface-2 grid place-items-center text-ink/60"
            aria-label="Chiudi"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!allFinished && (
        <div className="px-5">
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-ink transition-all"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
          {processing && (
            <p className="mt-2 text-xs text-ink/50">
              In analisi: <span className="font-medium text-ink/70">{processing.fileName}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {queue.map((item) => {
          const isExpanded =
            expandedIds.has(item.id) ||
            item.status === "pending" ||
            item.status === "processing" ||
            item.status === "error";
          return (
            <EditableReceiptCard
              key={item.id}
              item={item}
              onChange={onChangeItem}
              onConfirm={onConfirmItem}
              onDiscard={onDiscardItem}
              onRetry={onRetryItem}
              onSaveRaw={onSaveRawItem}
              onReanalyze={onReanalyzeItem ? () => onReanalyzeItem(item.id) : undefined}
              settings={settings}
              trip={trip}
              compact={!isExpanded}
              onExpand={() => toggleExpand(item.id)}
              onViewImage={onViewImage}
            />
          );
        })}
      </div>

      <div className="border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2">
        <button
          onClick={onDiscardAll}
          className="flex-1 h-12 rounded-xl bg-surface-2 text-ink font-semibold active:scale-[0.98]"
        >
          Scarta tutti
        </button>
        <button
          onClick={onConfirmAll}
          disabled={confirmableCount === 0}
          className="flex-1 h-12 rounded-xl bg-ink text-paper font-semibold active:scale-[0.98] disabled:opacity-40"
        >
          Conferma tutti{confirmableCount > 0 ? ` (${confirmableCount})` : ""}
        </button>
      </div>
    </>
  );
}
