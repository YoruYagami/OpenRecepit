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

/**
 * Same-transaction heuristic for auto-grouping scanned documents (receipt +
 * POS slip + bank statement of the same dinner): same date, amounts equal or
 * within 5%, and merchants similar — or one merchant unreadable, common on
 * bank statements and POS slips.
 */
export function looksLikeSameTransaction(a, b) {
  if (!a || !b) return false;
  if (!a.data || !b.data || a.data !== b.data) return false;
  const ai = a.importo || 0;
  const bi = b.importo || 0;
  if (!(ai > 0) || !(bi > 0)) return false;
  const amountClose = Math.abs(ai - bi) < 0.5 || Math.abs(ai - bi) / Math.max(ai, bi) < 0.05;
  if (!amountClose) return false;
  const unknown = (s) => !String(s || "").trim() || /sconosciut/i.test(String(s || ""));
  if (unknown(a.esercente) || unknown(b.esercente)) return true;
  return similarMerchant(a.esercente, b.esercente);
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

/**
 * Merge queue items that look like the same transaction into one: the richest
 * item (most complete data, highest amount) becomes the expense, the others
 * ride along as attachments. Returns the merged item.
 */
export function mergeQueueItems(items) {
  const score = (it) => {
    const d = it.data || {};
    return (
      (d.esercente && !/sconosciut/i.test(d.esercente) ? 2 : 0) +
      (Array.isArray(d.iva) && d.iva.length > 0 ? 2 : 0) +
      (d.descrizione ? 1 : 0) +
      (d.ora ? 1 : 0)
    );
  };
  const sorted = [...items].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return (b.data?.importo || 0) - (a.data?.importo || 0);
  });
  const [base, ...rest] = sorted;

  // Keep the best value for each field across the group.
  const merged = { ...base.data };
  for (const it of rest) {
    const d = it.data || {};
    if (!merged.esercente || /sconosciut/i.test(merged.esercente)) {
      if (d.esercente && !/sconosciut/i.test(d.esercente)) merged.esercente = d.esercente;
    }
    if (!merged.descrizione && d.descrizione) merged.descrizione = d.descrizione;
    if (!merged.ora && d.ora) merged.ora = d.ora;
    if ((!merged.iva || merged.iva.length === 0) && Array.isArray(d.iva) && d.iva.length > 0) {
      merged.iva = d.iva;
    }
    if ((d.importo || 0) > (merged.importo || 0)) merged.importo = d.importo;
  }

  // The other documents become attachments of the surviving item.
  const extraImages = [
    ...(base.extraImages || []),
    ...rest.flatMap((it) => [
      {
        thumb: it.thumb,
        full: it.full,
        imageHash: it.imageHash,
        ...(it.isPdf ? { pdf: true, fileName: it.fileName } : {}),
      },
      ...(it.extraImages || []),
    ]),
  ];

  return {
    ...base,
    data: merged,
    extraImages,
    mergedFrom: rest.map((it) => it.id),
    mergedCount: items.length,
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
