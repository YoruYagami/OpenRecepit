import { CATEGORIES } from "../constants.js";
import { fmtDateRange, expenseTimeMinutes } from "./formatters.js";
import { totalsByCurrency, fmtCurrencyTotals } from "./expenseLogic.js";

import { saveOrShareFile } from "./download.js";

// Save a text file: blob download on the web, native share sheet in the APK
// (the WebView ignores anchor downloads). `canceled` is true when the user
// dismisses the share sheet, so callers skip the success toast.
export async function downloadFile(filename, mime, content) {
  return saveOrShareFile({ fileName: filename, mimeType: mime, text: content });
}

export function csvEscape(s) {
  const v = String(s ?? "");
  if (/[",\n;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function tripToCSV(trip) {
  const header = ["Data", "Ora", "Esercente", "Categoria", "Descrizione", "Importo", "Valuta"];
  const rows = [...trip.expenses]
    .sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? -1 : 1;
      return expenseTimeMinutes(a) - expenseTimeMinutes(b);
    })
    .map((e) => [
      e.data,
      e.ora || "",
      e.esercente,
      CATEGORIES[e.categoria]?.label ?? e.categoria,
      e.descrizione,
      e.importo.toFixed(2).replace(".", ","),
      e.valuta,
    ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
}

export function tripToSummary(trip) {
  // Totals are kept per currency: summing EUR and USD as raw numbers would
  // produce a meaningless figure on mixed-currency trips.
  const byCat = {};
  trip.expenses.forEach((e) => {
    (byCat[e.categoria] ||= []).push(e);
  });
  const lines = [];
  lines.push(`Riepilogo Trasferta — ${trip.name}`);
  if (trip.city) lines.push(`Città: ${trip.city}`);
  if (trip.startDate || trip.endDate)
    lines.push(`Periodo: ${fmtDateRange(trip.startDate, trip.endDate)}`);
  lines.push(`Numero scontrini: ${trip.expenses.length}`);
  lines.push(`Totale complessivo: ${fmtCurrencyTotals(totalsByCurrency(trip.expenses))}`);
  lines.push("");
  lines.push("Per categoria:");
  Object.entries(byCat)
    .map(([cat, items]) => [cat, totalsByCurrency(items)])
    .sort((a, b) => {
      const sum = (m) => Object.values(m).reduce((s, v) => s + v, 0);
      return sum(b[1]) - sum(a[1]);
    })
    .forEach(([cat, totals]) => {
      const c = CATEGORIES[cat] || CATEGORIES.altro;
      lines.push(`  ${c.icon}  ${c.label}: ${fmtCurrencyTotals(totals)}`);
    });
  return lines.join("\n");
}
