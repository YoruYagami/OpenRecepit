import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { safeLoad, safeSave } from "../utils/storage.js";
import { idbGet, idbSet, isQuotaError } from "../utils/idbStorage.js";
import {
  externalizeTripImages,
  collectImageRefs,
  collectGarbageImages,
} from "../utils/imageStore.js";
import { migrateTrips, normalizeSettings, CURRENT_DATA_VERSION } from "../utils/migrate.js";
import { useToasts } from "../hooks/useToasts.jsx";
import {
  STORAGE_TRIPS,
  STORAGE_SETTINGS,
  STORAGE_DATA_VERSION,
  STORAGE_TRIPS_RESCUE,
} from "../constants.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [trips, setTrips] = useState([]);
  const [ready, setReady] = useState(false);

  const [settings, setSettingsState] = useState(() =>
    normalizeSettings(safeLoad(STORAGE_SETTINGS, {}))
  );

  const [locked, setLocked] = useState(() => {
    const loaded = safeLoad(STORAGE_SETTINGS, {});
    return !!(loaded.pinEnabled && loaded.pinHash && loaded.pinSalt);
  });

  const { toasts, push: toast } = useToasts();

  useEffect(() => {
    let cancelled = false;
    // Ask the browser to keep our storage durable so the OS is less likely to
    // evict the only copy of the user's receipts under storage pressure.
    try {
      navigator.storage?.persist?.().catch(() => {});
    } catch {
      /* not supported */
    }
    (async () => {
      let loadedTrips = null;
      let loadFailed = false;
      try {
        const storedVersion = (await idbGet(STORAGE_DATA_VERSION)) ?? 0;
        const fromIdb = await idbGet(STORAGE_TRIPS);
        if (fromIdb && Array.isArray(fromIdb)) {
          loadedTrips = migrateTrips(fromIdb, storedVersion);
        } else {
          const fromLs = safeLoad(STORAGE_TRIPS, null);
          if (fromLs && Array.isArray(fromLs) && fromLs.length > 0) {
            await idbSet(STORAGE_TRIPS, fromLs);
            try {
              localStorage.removeItem(STORAGE_TRIPS);
            } catch {}
            loadedTrips = migrateTrips(fromLs, storedVersion);
          }
        }
        if (loadedTrips) {
          // One-time (idempotent) move of legacy inline full images into the
          // image store, so trips writes stop rewriting every photo. If it is
          // interrupted the next launch redoes it; orphans are GC'd below.
          loadedTrips = await externalizeTripImages(loadedTrips);
          if (!cancelled) setTrips(loadedTrips);
        }
      } catch (e) {
        loadFailed = true;
        console.warn("trips load failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
      // Sweep stored images no longer referenced by the trips or the rescue
      // snapshot (deleted expenses, replaced restores). Best-effort — and never
      // after a failed load, when an empty ref set would wipe every image.
      if (loadFailed) return;
      try {
        const rescue = await idbGet(STORAGE_TRIPS_RESCUE).catch(() => null);
        const keep = collectImageRefs(loadedTrips || []);
        if (rescue && Array.isArray(rescue.trips)) collectImageRefs(rescue.trips, keep);
        await collectGarbageImages(keep);
      } catch {
        /* GC is opportunistic */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tripsRef = useRef(trips);
  tripsRef.current = trips;
  const tripsSaveTimer = useRef(null);
  // Latch so a persistence failure is surfaced once, not on every debounce tick.
  const saveFailedRef = useRef(false);

  const persistTrips = () => {
    const snapshot = tripsRef.current;
    return idbSet(STORAGE_TRIPS, snapshot)
      .then(() => {
        saveFailedRef.current = false;
        return idbSet(STORAGE_DATA_VERSION, CURRENT_DATA_VERSION).catch(() => {});
      })
      .catch((e) => {
        console.warn("idb save failed", e);
        // A local-first app's only copy of the data just failed to persist —
        // the user must know (success toasts fire from in-memory state).
        if (!saveFailedRef.current) {
          saveFailedRef.current = true;
          toast(
            isQuotaError(e)
              ? "Memoria del dispositivo piena: esporta subito un backup, i nuovi scontrini non vengono salvati."
              : "Salvataggio non riuscito. Esporta un backup per sicurezza.",
            "error"
          );
        }
      });
  };

  useEffect(() => {
    if (!ready) return;
    if (tripsSaveTimer.current) clearTimeout(tripsSaveTimer.current);
    tripsSaveTimer.current = setTimeout(persistTrips, 400);
    return () => {
      if (tripsSaveTimer.current) clearTimeout(tripsSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, ready]);

  // Flush pending trip writes when the page is backgrounded/closed so a
  // just-confirmed receipt isn't lost inside the 400ms debounce if the browser
  // discards the tab (best-effort: the IDB transaction may still not complete).
  useEffect(() => {
    const flush = () => {
      if (!ready) return;
      if (tripsSaveTimer.current) {
        clearTimeout(tripsSaveTimer.current);
        tripsSaveTimer.current = null;
      }
      persistTrips();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const settingsSaveTimer = useRef(null);
  useEffect(() => {
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      safeSave(STORAGE_SETTINGS, settings);
    }, 250);
    return () => {
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    };
  }, [settings]);

  // Flush pending settings synchronously when the app is backgrounded or closed,
  // so security-sensitive state (PIN failure count / lockout) survives a kill or
  // reload inside the 250ms debounce window. pagehide/visibilitychange are the
  // reliable mobile lifecycle events (beforeunload is unreliable on mobile).
  useEffect(() => {
    const flush = () => {
      if (settingsSaveTimer.current) {
        clearTimeout(settingsSaveTimer.current);
        settingsSaveTimer.current = null;
      }
      safeSave(STORAGE_SETTINGS, settingsRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.theme || "auto";
    const apply = () => {
      let dark = false;
      if (theme === "dark") dark = true;
      else if (theme === "auto") {
        dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      root.classList.toggle("dark", dark);
      // Keep the browser/OS chrome (status bar on PWA/APK) in sync with the theme.
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#0a0b10" : "#faf9f7");
    };
    apply();
    if (theme === "auto" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  const setSettings = (s) => setSettingsState((prev) => ({ ...prev, ...s }));

  const value = useMemo(
    () => ({
      trips,
      setTrips,
      settings,
      setSettings,
      locked,
      setLocked,
      toasts,
      toast,
      ready,
    }),
    [trips, settings, locked, toasts, toast, ready]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};
