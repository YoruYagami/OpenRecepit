import { getImage } from "./imageStore.js";
import { tripToCSV } from "./export.js";
import { saveOrShareFile } from "./download.js";
import { expenseTimeMinutes } from "./formatters.js";

/*
 * "Pacchetto rimborso": one ZIP per trip with the receipts organized by day
 * and renamed so that re-entering them into a company tool (e.g. Zucchetti)
 * needs no guesswork — index, category, amount and merchant are in the
 * filename, attachments (POS slip / bank statement) sit next to their receipt.
 *
 *   Cliente_Milano/riepilogo.csv
 *   Cliente_Milano/2026-07-21/01_pranzo_23.50EUR_Trattoria-Roma.jpg
 *   Cliente_Milano/2026-07-21/01_pranzo_23.50EUR_Trattoria-Roma_allegato1.pdf
 *
 * Filenames are filesystem-safe: no commas, no spaces, no accents — amounts
 * use the dot as decimal separator.
 */

/** Alnum/dash-only fragment (drops commas, spaces, accents). */
export function sanitizeName(s, max = 40) {
  return (
    String(s || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip accents (combining marks after NFKD)
      .replace(/[^A-Za-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, max) || "spesa"
  );
}

/** Base filename for an expense: "01_pranzo_23.50EUR_Trattoria-Roma". */
export function packFileBase(expense, index) {
  const idx = String(index).padStart(2, "0");
  const amount = (typeof expense.importo === "number" ? expense.importo : 0).toFixed(2);
  const cur = sanitizeName(expense.valuta || "EUR", 6);
  return `${idx}_${sanitizeName(expense.categoria || "altro", 15)}_${amount}${cur}_${sanitizeName(expense.esercente)}`;
}

function extFromDataUrl(dataUrl) {
  const mime = (String(dataUrl).match(/^data:([^;,]+)/) || [])[1] || "";
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

const b64Of = (dataUrl) => dataUrl.slice(dataUrl.indexOf(",") + 1);

async function resolveFull(entry) {
  if (entry.full) return entry.full;
  if (entry.fullRef) return getImage(entry.fullRef).catch(() => null);
  return null;
}

/** Build the ZIP and hand it to the user (share sheet on native, download on web). */
export async function exportReimbursePack(trip) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const rootName = sanitizeName(trip.name, 50);
  const root = zip.folder(rootName);

  // Excel-friendly CSV recap at the top level.
  root.file("riepilogo.csv", "﻿" + tripToCSV(trip));

  // Group by day, chronological; stable numbering within each day.
  const byDay = new Map();
  for (const e of trip.expenses) {
    const day = e.data || "senza-data";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(e);
  }
  const days = [...byDay.keys()].sort();
  for (const day of days) {
    const folder = root.folder(day);
    const items = byDay
      .get(day)
      .slice()
      .sort((a, b) => expenseTimeMinutes(a) - expenseTimeMinutes(b));
    let idx = 0;
    for (const e of items) {
      idx++;
      const base = packFileBase(e, idx);
      const primary = await resolveFull(e);
      if (primary) {
        folder.file(`${base}.${extFromDataUrl(primary)}`, b64Of(primary), { base64: true });
      }
      let attNum = 0;
      for (const im of e.extraImages || []) {
        const full = await resolveFull(im);
        if (!full) continue;
        attNum++;
        folder.file(`${base}_allegato${attNum}.${extFromDataUrl(full)}`, b64Of(full), {
          base64: true,
        });
      }
    }
  }

  // JPEG/PDF don't compress: STORE keeps generation fast.
  const base64 = await zip.generateAsync({ type: "base64", compression: "STORE" });
  const fileName = `giustificativi_${rootName}${trip.startDate ? `_${trip.startDate}` : ""}.zip`;
  return saveOrShareFile({ fileName, mimeType: "application/zip", base64 });
}
