import { DEFAULT_SETTINGS, DEFAULT_LIMITS } from "../constants.js";

// Bump this whenever the persisted trip/expense shape changes, and add the
// corresponding step to migrateTrips below. The version is stamped alongside the
// trips in IndexedDB so future loads know where to resume the pipeline.
export const CURRENT_DATA_VERSION = 1;

/**
 * Version-keyed, idempotent migration of persisted trips. The retired
 * "documents" feature's v0 -> v1 step is gone; legacy `documents`/`merged`
 * fields on stored expenses are simply ignored. The pipeline scaffold stays
 * for future shape changes.
 */
export function migrateTrips(loaded, _fromVersion = 0) {
  return Array.isArray(loaded) ? loaded : [];
}

export function normalizeSettings(loaded) {
  const out = {
    ...DEFAULT_SETTINGS,
    ...loaded,
    expenseLimits: { ...DEFAULT_LIMITS, ...(loaded.expenseLimits || {}) },
  };
  // Strip the retired required-documents rules from legacy settings.
  delete out.requiredDocs;
  return out;
}
