import React from 'react';

export function ToastStack({ toasts }) {
  return (
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-24 z-50 flex flex-col gap-2 w-[88%]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-soft-lg border ${
            t.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : t.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-white border-black/5 text-ink"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
