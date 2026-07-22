// Full-resolution receipt images live as individual IndexedDB records instead
// of inline in the trips array. This keeps the (frequently rewritten) trips
// record small: thumbnails stay inline for cheap list rendering, while the
// heavy `full` images are written once at creation and fetched on demand
// (viewer, reanalysis, backup export).
//
// Expenses reference stored images via `fullRef` (and `extraImages[].fullRef`).
// All read paths keep an `e.full || getImage(e.fullRef)` fallback, so legacy
// inline data keeps working without a versioned migration; externalization is
// shape-driven and idempotent.
import { idbGet, idbSet, idbDelete, idbKeys } from "./idbStorage.js";
import { uid } from "./formatters.js";

const PREFIX = "img:";

export async function putImage(dataUrl) {
  const ref = uid();
  await idbSet(PREFIX + ref, dataUrl);
  return ref;
}

export async function getImage(ref) {
  if (!ref) return null;
  const v = await idbGet(PREFIX + ref);
  return typeof v === "string" ? v : null;
}

/**
 * Move any inline `full` images of the given trips into the image store.
 * Returns a new trips array with `fullRef` references. Safe to re-run: already
 * externalized expenses pass through untouched, and a put failure (e.g. quota)
 * leaves that image inline so no data is lost.
 */
export async function externalizeTripImages(trips) {
  const out = [];
  for (const t of trips || []) {
    const expenses = [];
    for (const e of t.expenses || []) {
      let ne = e;
      if (ne.full && !ne.fullRef) {
        try {
          const ref = await putImage(ne.full);
          ne = { ...ne, fullRef: ref };
          delete ne.full;
        } catch {
          /* keep inline */
        }
      }
      if (Array.isArray(ne.extraImages) && ne.extraImages.some((im) => im?.full && !im.fullRef)) {
        const extra = [];
        for (const im of ne.extraImages) {
          if (im?.full && !im.fullRef) {
            try {
              const ref = await putImage(im.full);
              const ni = { ...im, fullRef: ref };
              delete ni.full;
              extra.push(ni);
              continue;
            } catch {
              /* keep inline */
            }
          }
          extra.push(im);
        }
        ne = { ...ne, extraImages: extra };
      }
      expenses.push(ne);
    }
    out.push({ ...t, expenses });
  }
  return out;
}

/** Re-inline stored images so a backup file is self-contained and portable. */
export async function inlineTripImages(trips) {
  const out = [];
  for (const t of trips || []) {
    const expenses = [];
    for (const e of t.expenses || []) {
      const ne = { ...e };
      if (!ne.full && ne.fullRef) {
        const full = await getImage(ne.fullRef).catch(() => null);
        if (full) ne.full = full;
      }
      delete ne.fullRef;
      if (Array.isArray(ne.extraImages)) {
        const extra = [];
        for (const im of ne.extraImages) {
          const ni = { ...im };
          if (!ni.full && ni.fullRef) {
            const full = await getImage(ni.fullRef).catch(() => null);
            if (full) ni.full = full;
          }
          delete ni.fullRef;
          extra.push(ni);
        }
        ne.extraImages = extra;
      }
      expenses.push(ne);
    }
    out.push({ ...t, expenses });
  }
  return out;
}

/** Data-only copy of the trips (no images) for a small, durable backup. */
export function stripTripImages(trips) {
  return (trips || []).map((t) => ({
    ...t,
    expenses: (t.expenses || []).map((e) => {
      const { thumb: _t, full: _f, fullRef: _r, extraImages: _x, ...rest } = e;
      return rest;
    }),
  }));
}

export function collectImageRefs(trips, into = new Set()) {
  for (const t of trips || []) {
    for (const e of t.expenses || []) {
      if (e.fullRef) into.add(e.fullRef);
      for (const im of e.extraImages || []) {
        if (im?.fullRef) into.add(im.fullRef);
      }
    }
  }
  return into;
}

/**
 * Delete stored images no longer referenced by any expense (deleted expenses,
 * discarded restores). `keepRefs` must include refs from the live trips AND the
 * rescue snapshot, so an "undo restore" still finds its images.
 */
export async function collectGarbageImages(keepRefs) {
  let keys;
  try {
    keys = await idbKeys();
  } catch {
    return;
  }
  for (const k of keys) {
    if (typeof k === "string" && k.startsWith(PREFIX) && !keepRefs.has(k.slice(PREFIX.length))) {
      await idbDelete(k).catch(() => {});
    }
  }
}
