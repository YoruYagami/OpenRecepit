import { downloadFile } from './export.js';

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_MAGIC = "scontrini-trasferta-backup";

const SETTINGS_EXCLUDE = new Set([
  "apiKey",
  "pinHash",
  "pinSalt",
  "pinAlgo",
  "pinFails",
  "pinLockUntil",
  "biometricCredId",
  "biometricEnabled",
  "pinEnabled",
]);

function sanitizeSettings(settings) {
  if (!settings || typeof settings !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(settings)) {
    if (SETTINGS_EXCLUDE.has(k)) continue;
    out[k] = v;
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

export function exportBackup({ trips, settings }) {
  const payload = buildBackup({ trips, settings });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `scontrini-backup-${ts}.json`;
  downloadFile(filename, "application/json;charset=utf-8", JSON.stringify(payload, null, 2));
  return { filename, count: payload.trips.length };
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File non valido: non è un JSON ben formato");
  }
  if (!data || typeof data !== "object") throw new Error("File non valido: contenuto non riconosciuto");
  if (data.magic !== BACKUP_MAGIC) throw new Error("File non riconosciuto come backup di Scontrini Trasferta");
  if (typeof data.schemaVersion !== "number" || data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(`Versione backup non supportata (${data.schemaVersion})`);
  }
  if (!Array.isArray(data.trips)) throw new Error("File non valido: campo 'trips' mancante");
  return {
    schemaVersion: data.schemaVersion,
    exportedAt: data.exportedAt || null,
    trips: data.trips,
    settings: data.settings && typeof data.settings === "object" ? sanitizeSettings(data.settings) : {},
  };
}

export async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("Lettura file fallita"));
    r.readAsText(file);
  });
}

export function summarizeBackup(parsed) {
  const expenseCount = (parsed.trips || []).reduce((sum, t) => sum + (t.expenses?.length || 0), 0);
  return { tripCount: parsed.trips.length, expenseCount, exportedAt: parsed.exportedAt };
}
