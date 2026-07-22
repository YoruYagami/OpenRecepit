import { fmtMoney, fmtDate, todayISO } from "./formatters.js";

export function expenseWarnings(expense, settings, trip) {
  const out = [];
  // A zero amount is almost always a failed parse or an unfinished manual
  // entry, not a real free expense — flag it before it lands in a report.
  if (!(Number(expense.importo) > 0)) {
    out.push({ type: "zero_amount", message: "Importo mancante — verifica" });
  }
  const limit = settings.expenseLimits?.[expense.categoria] || 0;
  if (limit > 0 && expense.importo > limit) {
    out.push({
      type: "over_limit",
      message: `Sopra limite (max ${fmtMoney(limit, expense.valuta)})`,
    });
  }
  if (trip && expense.data && /^\d{4}-\d{2}-\d{2}$/.test(expense.data)) {
    const d = expense.data;
    if (trip.startDate && d < trip.startDate) {
      out.push({
        type: "out_of_range",
        message: `Prima dell'inizio trasferta (${fmtDate(trip.startDate)})`,
      });
    } else if (trip.endDate && d > trip.endDate) {
      out.push({
        type: "out_of_range",
        message: `Dopo la fine trasferta (${fmtDate(trip.endDate)})`,
      });
    }
  }
  return out;
}

export function findContentDuplicate(candidate, expenses) {
  if (!candidate || !candidate.data) return null;
  if (Math.abs(candidate.importo || 0) < 0.01) return null;
  for (const e of expenses) {
    if (e.id === candidate.id) continue;
    if (e.data !== candidate.data) continue;
    if (Math.abs((e.importo || 0) - (candidate.importo || 0)) > 0.01) continue;
    if (!similarMerchant(e.esercente, candidate.esercente)) continue;
    return e;
  }
  return null;
}

export function similarMerchant(a, b) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\b(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?n\.?c\.?|srls|spa|srl|snc)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = na.split(" ")[0];
  const tb = nb.split(" ")[0];
  if (ta && tb && ta === tb && ta.length >= 4) return true;
  if (na.length >= 5 && nb.includes(na)) return true;
  if (nb.length >= 5 && na.includes(nb)) return true;
  return false;
}

/** Blank expense payload for manual entry and save-without-analysis. */
export function emptyExpenseData() {
  return {
    esercente: "",
    importo: 0,
    data: todayISO(),
    ora: null,
    categoria: "altro",
    descrizione: "",
    valuta: "EUR",
  };
}

/** Sum expenses grouped by currency: { EUR: 123.4, USD: 50 }. */
export function totalsByCurrency(expenses) {
  const map = {};
  for (const e of expenses || []) {
    const cur = e.valuta || "EUR";
    map[cur] = (map[cur] || 0) + (e.importo || 0);
  }
  return map;
}

/** "€ 123,40" for a single currency, "€ 123,40 + 50,00 USD" for mixed trips. */
export function fmtCurrencyTotals(totals) {
  const entries = Object.entries(totals).sort((a, b) => {
    if (a[0] === "EUR") return -1;
    if (b[0] === "EUR") return 1;
    return a[0].localeCompare(b[0]);
  });
  if (entries.length === 0) return fmtMoney(0);
  return entries.map(([cur, amt]) => fmtMoney(amt, cur)).join(" + ");
}
