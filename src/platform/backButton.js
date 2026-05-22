import { Capacitor } from '@capacitor/core';

/**
 * Register an Android hardware back-button handler.
 *
 * @param {() => boolean} handler  Return true if the back press was consumed
 *                                 (e.g., a modal was closed). Return false to
 *                                 let the OS handle it (typically exit app).
 * @returns {() => void}           Unsubscribe function.
 */
export function registerBackButton(handler) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let unsub = () => {};
  let cancelled = false;
  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      if (cancelled) return;
      const listener = await App.addListener('backButton', ({ canGoBack }) => {
        const consumed = !!handler();
        if (!consumed && !canGoBack) {
          App.exitApp();
        }
      });
      unsub = () => listener.remove();
    } catch {
      // Plugin missing or older Capacitor — silently ignore.
    }
  })();
  return () => {
    cancelled = true;
    try { unsub(); } catch { /* noop */ }
  };
}
