import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { safeLoad, safeSave } from '../utils/storage.js';
import { idbGet, idbSet } from '../utils/idbStorage.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { STORAGE_TRIPS, STORAGE_SETTINGS, DEFAULT_SETTINGS, DEFAULT_LIMITS, DOC_TYPE_IDS } from '../constants.js';

const AppContext = createContext(null);

function migrateTrips(loaded) {
  return (loaded || []).map((t) => ({
    ...t,
    expenses: (t.expenses || []).map((e) => {
      if (e.merged) return e;
      const docs = e.documents || {};
      const count = Object.values(docs).filter(Boolean).length;
      return count >= 2 ? { ...e, merged: true } : e;
    }),
  }));
}

function normalizeSettings(loaded) {
  const reqDocs = { ...DEFAULT_SETTINGS.requiredDocs, ...(loaded.requiredDocs || {}) };
  if (!Array.isArray(reqDocs.alternatives)) reqDocs.alternatives = [];
  if (reqDocs.alternatives.length === 0) {
    const legacy = DOC_TYPE_IDS.filter((id) => reqDocs[id] === true);
    if (legacy.length > 0) reqDocs.alternatives = [legacy];
  }
  return {
    ...DEFAULT_SETTINGS,
    ...loaded,
    expenseLimits: { ...DEFAULT_LIMITS, ...(loaded.expenseLimits || {}) },
    requiredDocs: reqDocs,
  };
}

export function AppProvider({ children }) {
  const [trips, setTrips] = useState([]);
  const [ready, setReady] = useState(false);

  const [settings, setSettingsState] = useState(() => normalizeSettings(safeLoad(STORAGE_SETTINGS, {})));

  const [locked, setLocked] = useState(() => {
    const loaded = safeLoad(STORAGE_SETTINGS, {});
    return !!(loaded.pinEnabled && loaded.pinHash && loaded.pinSalt);
  });

  const { toasts, push: toast } = useToasts();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fromIdb = await idbGet(STORAGE_TRIPS);
        if (fromIdb && Array.isArray(fromIdb)) {
          if (!cancelled) setTrips(migrateTrips(fromIdb));
          return;
        }
        const fromLs = safeLoad(STORAGE_TRIPS, null);
        if (fromLs && Array.isArray(fromLs) && fromLs.length > 0) {
          await idbSet(STORAGE_TRIPS, fromLs);
          try { localStorage.removeItem(STORAGE_TRIPS); } catch {}
          if (!cancelled) setTrips(migrateTrips(fromLs));
        }
      } catch (e) {
        console.warn("trips load failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const tripsSaveTimer = useRef(null);
  useEffect(() => {
    if (!ready) return;
    if (tripsSaveTimer.current) clearTimeout(tripsSaveTimer.current);
    tripsSaveTimer.current = setTimeout(() => {
      idbSet(STORAGE_TRIPS, trips).catch((e) => console.warn("idb save failed", e));
    }, 400);
    return () => { if (tripsSaveTimer.current) clearTimeout(tripsSaveTimer.current); };
  }, [trips, ready]);

  const settingsSaveTimer = useRef(null);
  useEffect(() => {
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      safeSave(STORAGE_SETTINGS, settings);
    }, 250);
    return () => { if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current); };
  }, [settings]);

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

  const value = useMemo(() => ({
    trips, setTrips,
    settings, setSettings,
    locked, setLocked,
    toasts, toast,
    ready,
  }), [trips, settings, locked, toasts, toast, ready]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};
