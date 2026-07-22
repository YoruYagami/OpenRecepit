import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessibility wiring shared by every modal/overlay: when `open`, it moves focus
 * into the dialog, traps Tab within it, closes on Escape, and restores focus to
 * the previously-focused element on close. Attach the returned ref to the dialog
 * container and add role="dialog" aria-modal="true" to it.
 *
 * Must be called unconditionally (before any early `return null`) to respect the
 * rules of hooks — it self-guards on `open`.
 */
export function useModalDialog({ open, onClose }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement;

    const focusables = () =>
      Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);

    const initial = node.querySelector("[autofocus]") || focusables()[0];
    initial?.focus?.();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus?.();
    };
  }, [open]);

  return ref;
}
