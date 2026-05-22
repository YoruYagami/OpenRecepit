import { CATEGORIES } from '../constants.js';
import { fmtDateRange, expenseTimeMinutes, fmtMoney } from './formatters.js';

export function downloadFile(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const totals = {};
  let grand = 0;
  trip.expenses.forEach((e) => {
    totals[e.categoria] = (totals[e.categoria] || 0) + e.importo;
    grand += e.importo;
  });
  const lines = [];
  lines.push(`Riepilogo Trasferta — ${trip.name}`);
  if (trip.city) lines.push(`Città: ${trip.city}`);
  if (trip.startDate || trip.endDate) lines.push(`Periodo: ${fmtDateRange(trip.startDate, trip.endDate)}`);
  lines.push(`Numero scontrini: ${trip.expenses.length}`);
  lines.push(`Totale complessivo: ${fmtMoney(grand)}`);
  lines.push("");
  lines.push("Per categoria:");
  Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amt]) => {
      const c = CATEGORIES[cat] || CATEGORIES.altro;
      lines.push(`  ${c.icon}  ${c.label}: ${fmtMoney(amt)}`);
    });
  return lines.join("\n");
}
