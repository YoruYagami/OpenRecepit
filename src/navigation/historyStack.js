/*
 * Pure, React-free model for history-based navigation.
 *
 * Every UI "layer" (view change, open overlay) is a real history entry whose
 * state carries `__nav = { v, i, tab, tripId, o }`:
 *   i      monotonically increasing entry index (detects multi-step jumps)
 *   tab    "trips" | "scan" | "settings"
 *   tripId open trip id or null
 *   o      number of overlays open AT this entry (overlay descriptors are
 *          never serialized — they live only in React state)
 *
 * With entries mirroring the UI layering, Capacitor's default back handling
 * (webView.canGoBack() → goBack(), else background the app) yields the right
 * semantics with no plugin: back closes the topmost overlay, then the trip
 * detail, then the secondary tab, then exits.
 */

export const TABS = ["trips", "scan", "settings"];
export const NAV_VERSION = 1;

export function baseline() {
  return { v: NAV_VERSION, i: 0, tab: "trips", tripId: null, o: 0 };
}

/** Parse a history.state object; null when missing/foreign/corrupt. */
export function parseNavState(state) {
  const n = state && typeof state === "object" ? state.__nav : null;
  if (!n || n.v !== NAV_VERSION) return null;
  if (!TABS.includes(n.tab)) return null;
  if (typeof n.i !== "number" || !Number.isFinite(n.i)) return null;
  const o = typeof n.o === "number" && n.o >= 0 ? Math.floor(n.o) : 0;
  return { v: NAV_VERSION, i: Math.floor(n.i), tab: n.tab, tripId: n.tripId ?? null, o };
}

/** Wrap a nav entry for history.pushState/replaceState. */
export function wrap(entry) {
  return { __nav: entry };
}

/** Next entry derived from the current one (index advances). */
export function nextEntry(current, patch) {
  const base = current || baseline();
  return { ...base, ...patch, v: NAV_VERSION, i: base.i + 1 };
}

/**
 * Decide how to apply a popstate (or boot) target against the live UI.
 *   live = { overlayCount, locked, hasTrip(id) → bool }
 * Returns:
 *   { action: "freeze" }                        — locked: caller re-pushes, back is a no-op
 *   { action: "apply", entry, removedOverlays, normalized }
 *     entry           — the sanitized entry to adopt (and re-stamp via replaceState
 *                       when `normalized` is true: foreign state, stale trip, or
 *                       an overlay count the live UI cannot satisfy)
 *     removedOverlays — how many topmost overlays this pop closes
 */
export function planPop(targetState, live) {
  let entry = parseNavState(targetState);
  let normalized = false;
  if (!entry) {
    entry = baseline();
    normalized = true;
  }
  if (live.locked) return { action: "freeze" };
  let tripId = entry.tripId;
  if (tripId && !live.hasTrip(tripId)) {
    tripId = null;
    normalized = true;
  }
  const overlayCount = Math.min(entry.o, live.overlayCount);
  if (overlayCount !== entry.o) normalized = true;
  return {
    action: "apply",
    entry: { ...entry, tripId, o: overlayCount },
    removedOverlays: Math.max(0, live.overlayCount - overlayCount),
    normalized,
  };
}
