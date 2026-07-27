import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // We register the service worker manually in main.jsx so we control the
      // update flow; injectRegister:null disables the plugin's auto-injection.
      injectRegister: null,
      includeAssets: ["favicon.svg", "pwa-icon.svg"],
      manifest: {
        name: "OpenRecepit",
        short_name: "OpenRecepit",
        description: "Scansiona e organizza gli scontrini delle trasferte di lavoro.",
        lang: "it",
        theme_color: "#faf9f7",
        background_color: "#faf9f7",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,mjs,css,html,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  server: { host: true, port: 5173 },
  build: {
    outDir: "dist",
    // No source maps in production so original source isn't shipped to the
    // browser. Add an out-of-band symbolication upload before re-enabling.
    sourcemap: false,
    target: "es2020",
  },
});
