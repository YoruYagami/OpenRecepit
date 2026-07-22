import { useState, useCallback } from "react";
import { uid } from "../utils/formatters.js";

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "info", opts = {}) => {
    const id = uid();
    const { actionLabel, onAction, duration } = opts;
    const dismiss = () => setToasts((t) => t.filter((x) => x.id !== id));
    setToasts((t) => [
      ...t,
      {
        id,
        message,
        type,
        actionLabel,
        // Running the action dismisses the toast so "Annulla" can't be
        // double-tapped into a duplicate undo.
        onAction: onAction
          ? () => {
              dismiss();
              onAction();
            }
          : undefined,
      },
    ]);
    // Toasts with an action linger longer: they're an undo window, not a notice.
    setTimeout(dismiss, duration || (actionLabel ? 6000 : 3200));
  }, []);
  return { toasts, push };
}
