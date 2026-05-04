import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { safeLoad, safeSave } from '../utils/storage.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { STORAGE_TRIPS, STORAGE_SETTINGS, DEFAULT_SETTINGS, DEFAULT_LIMITS, DOC_TYPE_IDS } from '../constants.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [trips, setTrips] = useState(() => {
    const loaded = safeLoad(STORAGE_TRIPS, []);
    return loaded.map((t) => ({
      ...t,
      expenses: (t.expenses || []).map((e) => {
        if (e.merged) return e;
        const docs = e.documents || {};
        const count = Object.values(docs).filter(Boolean).length;
        return count >= 2 ? { ...e, merged: true } : e;
      }),
    }));
  });

  const [settings, setSettingsState] = useState(() => {
    const loaded = safeLoad(STORAGE_SETTINGS, {});
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
  });

  const [locked, setLocked] = useState(() => {
    const loaded = safeLoad(STORAGE_SETTINGS, {});
    return !!(loaded.pinEnabled && loaded.pinHash && loaded.pinSalt);
  });

  const { toasts, push: toast } = useToasts();

  useEffect(() => { safeSave(STORAGE_TRIPS, trips); }, [trips]);
  useEffect(() => { safeSave(STORAGE_SETTINGS, settings); }, [settings]);

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
    toasts, toast
  }), [trips, settings, locked, toasts, toast]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};
