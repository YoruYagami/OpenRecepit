import { describe, it, expect } from "vitest";
import { stripTripImages, collectImageRefs } from "./imageStore.js";

// Only the pure helpers are tested here: the IDB-backed functions need a real
// IndexedDB, which jsdom does not provide.

describe("stripTripImages", () => {
  it("removes every image field but keeps data and imageHash", () => {
    const trips = [
      {
        id: "t1",
        name: "Roma",
        expenses: [
          {
            id: "e1",
            esercente: "Bar",
            importo: 3,
            imageHash: "h1",
            thumb: "data:thumb",
            full: "data:full",
            fullRef: "ref1",
            extraImages: [{ thumb: "x", fullRef: "ref2" }],
          },
        ],
      },
    ];
    const out = stripTripImages(trips);
    const e = out[0].expenses[0];
    expect(e.thumb).toBeUndefined();
    expect(e.full).toBeUndefined();
    expect(e.fullRef).toBeUndefined();
    expect(e.extraImages).toBeUndefined();
    expect(e.imageHash).toBe("h1");
    expect(e.esercente).toBe("Bar");
    // original untouched
    expect(trips[0].expenses[0].fullRef).toBe("ref1");
  });
});

describe("collectImageRefs", () => {
  it("gathers refs from expenses and extra images across trips", () => {
    const trips = [
      { expenses: [{ fullRef: "a" }, { extraImages: [{ fullRef: "b" }, { thumb: "t" }] }] },
      { expenses: [{ full: "inline-only" }] },
    ];
    const refs = collectImageRefs(trips);
    expect(refs).toEqual(new Set(["a", "b"]));
  });
});
