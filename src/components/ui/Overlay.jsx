import React from "react";
import { useModalDialog } from "../../hooks/useModalDialog.js";

/*
 * Shared modal shell: one owner for backdrop, positioning, entry animation and
 * the focus-trap/Escape wiring (useModalDialog). Escape and backdrop click are
 * routed to `onClose` — under the nav stack that is history.back(), so every
 * dismissal path is the same code as the hardware back button.
 *
 * variants:
 *   sheet      — dim+blur backdrop, bottom sheet on mobile / centered on sm:
 *   fullscreen — opaque bg-paper page (scan queue)
 *   lightbox   — near-black photo viewer (deliberately dark in both themes)
 */
export function Overlay({ variant = "sheet", onClose, closeOnBackdrop = false, className = "", children }) {
  const dialogRef = useModalDialog({ open: true, onClose });

  if (variant === "fullscreen") {
    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`absolute inset-0 bg-paper flex flex-col fade-in ${className}`}
      >
        {children}
      </div>
    );
  }

  if (variant === "lightbox") {
    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`absolute inset-0 bg-black/95 flex flex-col fade-in ${className}`}
        onClick={closeOnBackdrop ? onClose : undefined}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-end sm:items-center justify-center bg-overlay backdrop-blur-sm p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={
        closeOnBackdrop
          ? (e) => {
              if (e.target === e.currentTarget) onClose?.();
            }
          : undefined
      }
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-sm bg-surface shadow-soft-lg fade-in rounded-2xl ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
