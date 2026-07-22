import { downloadFile } from "./export.js";
import { readFile } from "./file.js";

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_MAGIC = "scontrini-trasferta-backup";

function coerceLimits(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const n = Number(val);
    if (isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

// Allowlist: only known, type-checked preferences are exported/imported. This
// both keeps secrets (apiKey, PIN hash, biometric) out of backups and prevents a
// crafted backup from injecting arbitrary-shaped values into live settings.
// (requiredDocs from old backups is simply ignored — the feature was removed.)
const SETTINGS_ALLOW = {
  theme: (v) => (["light", "dark", "auto"].includes(v) ? v : undefined),
  model: (v) => (typeof v === "string" ? v.slice(0, 200) : undefined),
  pinLength: (v) => (v === 4 || v === 6 ? v : undefined),
  expenseLimits: coerceLimits,
};

function sanitizeSettings(settings) {
  if (!settings || typeof settings !== "object") return {};
  const out = {};
  for (const [key, coerce] of Object.entries(SETTINGS_ALLOW)) {
    if (!(key in settings)) continue;
    const value = coerce(settings[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// A non-numeric importo (hand-edited or foreign backup) would string-concat in
// totals and crash CSV export (`importo.toFixed`), so coerce it on the way in.
function coerceImporto(v) {
  if (typeof v === "number" && isFinite(v)) return v;
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isFinite(n) ? n : 0;
}

// Keep only entries that look like a trip; guarantee id/name/expenses so the UI
// can render imported data without crashing (and without bypassing migration).
function validateTrips(rawTrips) {
  const out = [];
  for (const t of rawTrips) {
    if (!t || typeof t !== "object" || Array.isArray(t)) continue;
    if (typeof t.id !== "string" && typeof t.id !== "number") continue;
    out.push({
      ...t,
      id: String(t.id),
      name: typeof t.name === "string" && t.name.trim() ? t.name : "Trasferta",
      expenses: Array.isArray(t.expenses)
        ? t.expenses
            .filter((e) => e && typeof e === "object" && !Array.isArray(e))
            .map((e) => ({ ...e, importo: coerceImporto(e.importo) }))
        : [],
    });
  }
  return out;
}

export function buildBackup({ trips, settings }) {
  return {
    magic: BACKUP_MAGIC,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    trips: trips || [],
    settings: sanitizeSettings(settings),
  };
}

export async function exportBackup({ trips, settings, filenameSuffix = "" }) {
  const payload = buildBackup({ trips, settings });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `scontrini-backup${filenameSuffix}-${ts}.json`;
  const res = await downloadFile(
    filename,
    "application/json;charset=utf-8",
    JSON.stringify(payload, null, 2)
  );
  return { filename, count: payload.trips.length, canceled: !!res?.canceled };
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File non valido: non è un JSON ben formato");
  }
  if (!data || typeof data !== "object")
    throw new Error("File non valido: contenuto non riconosciuto");
  if (data.magic !== BACKUP_MAGIC)
    throw new Error("File non riconosciuto come backup di Scontrini Trasferta");
  if (typeof data.schemaVersion !== "number" || data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(`Versione backup non supportata (${data.schemaVersion})`);
  }
  if (!Array.isArray(data.trips)) throw new Error("File non valido: campo 'trips' mancante");
  const trips = validateTrips(data.trips);
  if (data.trips.length > 0 && trips.length === 0) {
    throw new Error("File non valido: nessuna trasferta riconosciuta");
  }
  return {
    schemaVersion: data.schemaVersion,
    exportedAt: data.exportedAt || null,
    trips,
    settings:
      data.settings && typeof data.settings === "object" ? sanitizeSettings(data.settings) : {},
  };
}

export async function readFileAsText(file) {
  return readFile(file, { as: "text" });
}

export function summarizeBackup(parsed) {
  const expenseCount = (parsed.trips || []).reduce((sum, t) => sum + (t.expenses?.length || 0), 0);
  return { tripCount: parsed.trips.length, expenseCount, exportedAt: parsed.exportedAt };
}
