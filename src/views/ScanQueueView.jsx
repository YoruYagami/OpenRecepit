import React, { useState, useMemo } from 'react';
import { EditableReceiptCard } from '../components/receipts/EditableReceiptCard.jsx';
import { CATEGORIES } from '../constants.js';
import { detectQueueGroups } from '../utils/expenseLogic.js';

export function ScanQueueView({
  queue,
  onChangeItem,
  onConfirmItem,
  onDiscardItem,
  onRetryItem,
  onReanalyzeItem,
  onConfirmAll,
  onDiscardAll,
  onMergeGroup,
  onClose,
  onViewImage,
  settings,
  trip,
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [dismissedGroups, setDismissedGroups] = useState(() => new Set());

  const total = queue.length;
  const done = queue.filter((q) => q.status === "done" || q.status === "confirmed" || q.status === "error").length;
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

  const groups = useMemo(() => detectQueueGroups(queue), [queue]);
  const groupKey = (group) => group.map((g) => g.id).sort().join("|");
  const itemToGroup = useMemo(() => {
    const map = new Map();
    for (const g of groups) {
      const key = groupKey(g);
      if (dismissedGroups.has(key)) continue;
      for (const it of g) map.set(it.id, { group: g, key });
    }
    return map;
  }, [groups, dismissedGroups]);

  const renderedKeys = new Set();
  const renderItems = [];
  for (const item of queue) {
    const meta = itemToGroup.get(item.id);
    if (meta && !renderedKeys.has(meta.key)) {
      renderedKeys.add(meta.key);
      renderItems.push({ kind: "group", group: meta.group, key: meta.key });
    } else if (!meta) {
      renderItems.push({ kind: "item", item });
    }
  }

  return (
    <div className="absolute inset-0 z-30 bg-paper flex flex-col fade-in">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between bg-paper">
        <div>
          <h2 className="text-xl font-extrabold text-ink">
            {allFinished ? "Revisione scontrini" : "Analisi scontrini"}
          </h2>
          <p className="text-sm text-ink/60">
            {allFinished ? `${queue.length} immagine${queue.length === 1 ? "" : "i"} elaborate` : `Analisi ${done}/${total}…`}
          </p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-black/5 grid place-items-center text-ink/60" aria-label="Chiudi">✕</button>
      </div>

      {!allFinished && (
        <div className="px-5">
          <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
            <div className="h-full bg-ink transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          {processing && (
            <p className="mt-2 text-xs text-ink/50">
              In analisi: <span className="font-medium text-ink/70">{processing.fileName}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {renderItems.map((entry) => {
          if (entry.kind === "item") {
            const item = entry.item;
            const isExpanded = expandedIds.has(item.id) || item.status === "pending" || item.status === "processing" || item.status === "error";
            return (
              <EditableReceiptCard
                key={item.id}
                item={item}
                onChange={onChangeItem}
                onConfirm={onConfirmItem}
                onDiscard={onDiscardItem}
                onRetry={onRetryItem}
                onReanalyze={onReanalyzeItem ? () => onReanalyzeItem(item.id) : undefined}
                settings={settings}
                trip={trip}
                compact={!isExpanded}
                onExpand={() => toggleExpand(item.id)}
                onViewImage={onViewImage}
                inQueue
              />
            );
          }
          const group = entry.group;
          const cat = CATEGORIES[group[0].data?.categoria] || CATEGORIES.altro;
          const merchant = group[0].data?.esercente || "";
          return (
            <div key={entry.key} className="rounded-2xl border-2 border-dashed border-ink/15 bg-ink/[0.02] p-2.5 flex flex-col gap-2">
              <div className="flex items-start gap-2 px-1 pt-0.5">
                <span className="text-base mt-0.5" aria-hidden>🔗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-ink">
                    {group.length} scontrini sembrano la stessa {cat.label.toLowerCase()}
                  </p>
                  <p className="text-[11px] text-ink/60 truncate">
                    {merchant} · stessa data, documenti complementari
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setDismissedGroups((prev) => { const next = new Set(prev); next.add(entry.key); return next; })}
                    className="text-[11px] font-semibold text-ink/50 px-2 py-1 rounded-md hover:bg-black/5"
                    title="Mantieni separati"
                  >
                    Separa
                  </button>
                  <button
                    onClick={() => onMergeGroup && onMergeGroup(group.map((g) => g.id))}
                    className="text-[11px] font-bold text-white bg-ink px-2.5 py-1 rounded-md active:scale-95"
                  >
                    Unisci
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {group.map((item) => {
                  const isExpanded = expandedIds.has(item.id);
                  return (
                    <EditableReceiptCard
                      key={item.id}
                      item={item}
                      onChange={onChangeItem}
                      onConfirm={onConfirmItem}
                      onDiscard={onDiscardItem}
                      onRetry={onRetryItem}
                      onReanalyze={onReanalyzeItem ? () => onReanalyzeItem(item.id) : undefined}
                      settings={settings}
                      trip={trip}
                      compact={!isExpanded}
                      onExpand={() => toggleExpand(item.id)}
                      inQueue
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-black/5 bg-white p-4 flex gap-2">
        <button onClick={onDiscardAll} className="flex-1 h-12 rounded-xl bg-black/5 text-ink font-semibold active:scale-[0.98]">
          Scarta tutti
        </button>
        <button onClick={onConfirmAll} disabled={confirmableCount === 0} className="flex-1 h-12 rounded-xl bg-ink text-white font-semibold active:scale-[0.98] disabled:opacity-40">
          Conferma tutti{confirmableCount > 0 ? ` (${confirmableCount})` : ""}
        </button>
      </div>
    </div>
  );
}
