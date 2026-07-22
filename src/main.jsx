import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
// Self-hosted fonts: bundled by Vite (and PWA-precached) so the app renders
// identically offline and in the APK — no CDN dependency.
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./index.css";

// React error boundaries only catch render-time errors. Log async/event-handler
// failures and unhandled rejections so they're diagnosable instead of silent.
window.addEventListener("error", (e) => {
  console.error("Uncaught error:", e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Register the PWA service worker (production builds only; the dev server has no
// virtual module). vite-plugin-pwa runs with injectRegister:null, so we register
// manually here to control the update flow.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  import("virtual:pwa-register")
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}
