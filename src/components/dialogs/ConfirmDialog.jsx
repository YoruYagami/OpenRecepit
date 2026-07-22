import React from "react";

/*
 * Confirm dialog body — rendered inside an <Overlay variant="sheet"> by the
 * OverlayHost (or locally by the LockScreen, which lives outside the nav
 * stack). Dismissal is the caller's concern: both buttons only invoke the
 * callbacks they were given.
 */
export function ConfirmBody({
  title,
  message,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  danger,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="p-5">
      <h3 className="font-bold text-lg text-ink">{title}</h3>
      {message && <p className="text-sm text-ink/70 mt-1.5">{message}</p>}
      <div className="mt-5 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 h-11 rounded-xl bg-surface-2 text-ink font-semibold active:scale-[0.98]"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 h-11 rounded-xl font-semibold active:scale-[0.98] ${
            danger ? "bg-danger-solid text-white" : "bg-ink text-paper"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
