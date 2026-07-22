import { useCallback } from "react";
import { useNav } from "../navigation/NavProvider.jsx";

/*
 * Promise-based confirmation on top of the overlay stack:
 *   if (await confirm({ title, message, danger, confirmLabel })) { ... }
 * Dismissal by hardware back / Escape / backdrop resolves false via the
 * overlay's onDismiss (Promise.resolve is idempotent, so the button paths and
 * the dismiss path can't double-fire).
 */
export function useConfirm() {
  const { pushOverlay, closeTopOverlay } = useNav();

  return useCallback(
    (cfg) =>
      new Promise((resolve) => {
        pushOverlay({
          kind: "confirm",
          onDismiss: () => resolve(false),
          props: {
            ...cfg,
            onConfirm: () => {
              resolve(true);
              closeTopOverlay();
            },
            onCancel: () => {
              resolve(false);
              closeTopOverlay();
            },
          },
        });
      }),
    [pushOverlay, closeTopOverlay]
  );
}
