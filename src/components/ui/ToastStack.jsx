import React from "react";

export function ToastStack({ toasts }) {
  return (
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-24 z-50 flex flex-col gap-2 w-[88%]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-soft-lg border ${
            t.type === "error"
              ? "bg-danger-soft border-danger-line text-danger"
              : t.type === "success"
                ? "bg-ok-soft border-ok-line text-ok"
                : "bg-surface border-line text-ink"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex-1 min-w-0">{t.message}</span>
            {t.actionLabel && t.onAction && (
              <button
                onClick={t.onAction}
                className="shrink-0 font-bold underline underline-offset-2 active:scale-95"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
