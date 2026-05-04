import React from 'react';

export function ConfirmDialog({ open, title, message, confirmLabel = "Conferma", cancelLabel = "Annulla", danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-soft-lg p-5 fade-in">
        <h3 className="font-bold text-lg text-ink">{title}</h3>
        {message && <p className="text-sm text-ink/70 mt-1.5">{message}</p>}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl bg-black/5 text-ink font-semibold active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 h-11 rounded-xl font-semibold text-white active:scale-[0.98] ${
              danger ? "bg-red-600" : "bg-ink"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
