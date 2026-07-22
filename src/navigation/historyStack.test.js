import { describe, it, expect } from "vitest";
import { baseline, parseNavState, wrap, nextEntry, planPop, NAV_VERSION } from "./historyStack.js";

describe("parseNavState", () => {
  it("round-trips a wrapped entry", () => {
    const e = baseline();
    expect(parseNavState(wrap(e))).toEqual(e);
  });

  it("rejects foreign, null, and corrupt states", () => {
    expect(parseNavState(null)).toBeNull();
    expect(parseNavState({})).toBeNull();
    expect(parseNavState({ __nav: { v: 99, i: 0, tab: "trips", o: 0 } })).toBeNull();
    expect(parseNavState({ __nav: { v: NAV_VERSION, i: 0, tab: "bogus", o: 0 } })).toBeNull();
    expect(parseNavState({ __nav: { v: NAV_VERSION, i: NaN, tab: "trips", o: 0 } })).toBeNull();
  });

  it("sanitizes a negative/invalid overlay count to 0", () => {
    const s = { __nav: { v: NAV_VERSION, i: 2, tab: "trips", tripId: null, o: -3 } };
    expect(parseNavState(s).o).toBe(0);
  });
});

describe("nextEntry", () => {
  it("advances the index and applies the patch", () => {
    const a = baseline();
    const b = nextEntry(a, { tripId: "t1" });
    expect(b.i).toBe(a.i + 1);
    expect(b.tripId).toBe("t1");
    expect(b.tab).toBe("trips");
  });

  it("starts from baseline when current is null", () => {
    const b = nextEntry(null, { tab: "settings" });
    expect(b.i).toBe(1);
    expect(b.tab).toBe("settings");
  });
});

describe("planPop", () => {
  const live = (over = {}) => ({
    overlayCount: 0,
    locked: false,
    hasTrip: () => true,
    ...over,
  });

  it("freezes navigation behind the PIN gate", () => {
    const target = wrap(nextEntry(baseline(), { tripId: "t1" }));
    expect(planPop(target, live({ locked: true }))).toEqual({ action: "freeze" });
  });

  it("applies a plain entry", () => {
    const e = nextEntry(baseline(), { tripId: "t1" });
    const plan = planPop(wrap(e), live());
    expect(plan.action).toBe("apply");
    expect(plan.entry).toEqual(e);
    expect(plan.removedOverlays).toBe(0);
    expect(plan.normalized).toBe(false);
  });

  it("treats a foreign state as normalized baseline", () => {
    const plan = planPop(null, live({ overlayCount: 2 }));
    expect(plan.entry.tab).toBe("trips");
    expect(plan.entry.o).toBe(0);
    expect(plan.removedOverlays).toBe(2);
    expect(plan.normalized).toBe(true);
  });

  it("computes removed overlays on a back pop", () => {
    const e = { ...baseline(), i: 3, o: 1 };
    const plan = planPop(wrap(e), live({ overlayCount: 3 }));
    expect(plan.removedOverlays).toBe(2);
    expect(plan.entry.o).toBe(1);
    expect(plan.normalized).toBe(false);
  });

  it("clamps forward-navigation into an unrestorable overlay entry", () => {
    const e = { ...baseline(), i: 5, o: 2 };
    const plan = planPop(wrap(e), live({ overlayCount: 0 }));
    expect(plan.entry.o).toBe(0);
    expect(plan.removedOverlays).toBe(0);
    expect(plan.normalized).toBe(true);
  });

  it("falls back to the list when the entry's trip no longer exists", () => {
    const e = nextEntry(baseline(), { tripId: "deleted" });
    const plan = planPop(wrap(e), live({ hasTrip: () => false }));
    expect(plan.entry.tripId).toBeNull();
    expect(plan.normalized).toBe(true);
  });
});
