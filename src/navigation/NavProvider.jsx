import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { baseline, parseNavState, wrap, nextEntry, planPop } from "./historyStack.js";
import { useAppContext } from "../context/AppContext.jsx";
import { uid } from "../utils/formatters.js";

/*
 * History-backed navigation. Views (tab / open trip) and overlays are real
 * history entries, so the browser AND the Android hardware back button unwind
 * the UI in layer order with no router dependency (see historyStack.js).
 *
 * The one discipline this enforces: overlays are never closed by setting state
 * directly. Every close path (✕, backdrop, Escape, hardware back) goes through
 * history.back(); the popstate reconciler below is the single place that
 * removes overlay state.
 */
const NavContext = createContext(null);

export function NavProvider({ children }) {
  const { trips, ready, locked } = useAppContext();

  const entryRef = useRef(null);
  const [view, setView] = useState(() => {
    const restored = typeof history !== "undefined" ? parseNavState(history.state) : null;
    return { tab: restored?.tab || "trips", tripId: restored?.tripId || null };
  });
  const [overlays, setOverlays] = useState([]);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  const tripsRef = useRef(trips);
  tripsRef.current = trips;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  // overlayId -> { check: () => "veto"|"ok", onVeto: fn } — lets the scan queue
  // intercept a back that would discard unconfirmed work.
  const guardsRef = useRef(new Map());
  // Skips guard checks for one reconcile (the veto dialog's own "close anyway").
  const bypassGuardRef = useRef(false);
  // Deferred action to run after a programmatic multi-pop (close-then-navigate).
  const afterNavRef = useRef(null);

  // Boot: adopt a restored entry (browser refresh keeps tab + open trip) but
  // never overlays — they hold live component state and can't be rebuilt.
  useEffect(() => {
    try {
      history.scrollRestoration = "manual";
    } catch {
      /* unsupported */
    }
    const restored = parseNavState(history.state);
    const entry = restored ? { ...restored, o: 0 } : baseline();
    entryRef.current = entry;
    history.replaceState(wrap(entry), "");
    setView({ tab: entry.tab, tripId: entry.tripId });
  }, []);

  // Once trips have loaded, a restored trip that no longer exists falls back
  // to the list.
  useEffect(() => {
    if (!ready) return;
    const e = entryRef.current;
    if (e?.tripId && !tripsRef.current.some((t) => t.id === e.tripId)) {
      const fixed = { ...e, tripId: null };
      entryRef.current = fixed;
      history.replaceState(wrap(fixed), "");
      setView((v) => ({ ...v, tripId: null }));
    }
  }, [ready]);

  const removeOverlays = useCallback((count) => {
    if (count <= 0) return;
    const current = overlaysRef.current;
    const removed = current.slice(current.length - count);
    setOverlays(current.slice(0, current.length - count));
    // Topmost first: dismissal order mirrors visual stacking.
    for (const d of [...removed].reverse()) {
      guardsRef.current.delete(d.id);
      try {
        d.onDismiss?.();
      } catch (err) {
        console.error("overlay onDismiss failed", err);
      }
    }
  }, []);

  useEffect(() => {
    const onPop = (ev) => {
      const plan = planPop(ev.state, {
        overlayCount: overlaysRef.current.length,
        locked: lockedRef.current,
        hasTrip: (id) => tripsRef.current.some((t) => t.id === id),
      });
      if (plan.action === "freeze") {
        // Behind the PIN gate back must be a no-op: undo the pop.
        history.pushState(wrap(entryRef.current), "");
        return;
      }
      if (plan.removedOverlays > 0 && !bypassGuardRef.current) {
        const stack = overlaysRef.current;
        const top = stack[stack.length - 1];
        const guard = top && guardsRef.current.get(top.id);
        if (guard && guard.check() === "veto") {
          // Undo the pop: rebuild the popped entries from live state, then let
          // the guard raise its own dialog on top.
          let e = plan.entry;
          for (let k = 1; k <= plan.removedOverlays; k++) {
            e = nextEntry(e, { o: plan.entry.o + k });
            history.pushState(wrap(e), "");
          }
          entryRef.current = e;
          guard.onVeto?.();
          return;
        }
      }
      bypassGuardRef.current = false;
      entryRef.current = plan.entry;
      if (plan.normalized) history.replaceState(wrap(plan.entry), "");
      setView({ tab: plan.entry.tab, tripId: plan.entry.tripId });
      // Dismissals run AFTER the view is applied: an onDismiss that navigates
      // (e.g. scan queue → open target trip) must win over the popped entry.
      removeOverlays(plan.removedOverlays);
      const after = afterNavRef.current;
      afterNavRef.current = null;
      after?.();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [removeOverlays]);

  const openTrip = useCallback((tripId) => {
    const e = nextEntry(entryRef.current, { tab: "trips", tripId, o: 0 });
    entryRef.current = e;
    history.pushState(wrap(e), "");
    setView({ tab: "trips", tripId });
  }, []);

  const closeTrip = useCallback(() => history.back(), []);

  // Android bottom-nav convention: leaving the trips baseline pushes ONE
  // secondary entry; switching between secondary tabs replaces it; tapping
  // trips (or hardware back) returns to the baseline.
  const setTab = useCallback((tab) => {
    const cur = entryRef.current || baseline();
    if (tab === cur.tab && !cur.tripId) return;
    if (tab === "trips") {
      if (cur.tab !== "trips" || cur.tripId) history.back();
      return;
    }
    if (cur.tab !== "trips") {
      const e = { ...cur, tab, tripId: null, o: 0 };
      entryRef.current = e;
      history.replaceState(wrap(e), "");
      setView({ tab, tripId: null });
    } else {
      const e = nextEntry(cur, { tab, tripId: null, o: 0 });
      entryRef.current = e;
      history.pushState(wrap(e), "");
      setView({ tab, tripId: null });
    }
  }, []);

  const pushOverlay = useCallback((desc) => {
    const id = desc.id || uid();
    const cur = entryRef.current || baseline();
    const e = nextEntry(cur, { o: cur.o + 1 });
    entryRef.current = e;
    history.pushState(wrap(e), "");
    setOverlays((prev) => [...prev, { ...desc, id }]);
    return id;
  }, []);

  const closeTopOverlay = useCallback(() => {
    if (overlaysRef.current.length > 0) history.back();
  }, []);

  /** Close N overlays skipping guards (used by a guard's own confirm dialog). */
  const forceCloseOverlays = useCallback((count, after) => {
    const n = Math.min(count, overlaysRef.current.length);
    if (n <= 0) {
      after?.();
      return;
    }
    bypassGuardRef.current = true;
    afterNavRef.current = after || null;
    history.go(-n);
  }, []);

  /** Close every open overlay, then run fn (e.g. close queue → open trip). */
  const closeOverlaysThen = useCallback(
    (fn) => forceCloseOverlays(overlaysRef.current.length, fn),
    [forceCloseOverlays]
  );

  const registerGuard = useCallback((overlayId, guard) => {
    guardsRef.current.set(overlayId, guard);
    return () => guardsRef.current.delete(overlayId);
  }, []);

  const value = React.useMemo(
    () => ({
      tab: view.tab,
      tripId: view.tripId,
      overlays,
      setTab,
      openTrip,
      closeTrip,
      pushOverlay,
      closeTopOverlay,
      forceCloseOverlays,
      closeOverlaysThen,
      registerGuard,
    }),
    [
      view,
      overlays,
      setTab,
      openTrip,
      closeTrip,
      pushOverlay,
      closeTopOverlay,
      forceCloseOverlays,
      closeOverlaysThen,
      registerGuard,
    ]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export const useNav = () => {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
};
