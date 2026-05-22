import { fmtMoney, fmtDate } from './formatters.js';
import { DOC_TYPES, DOC_TYPE_IDS } from '../constants.js';

export function expenseDocs(expense) {
  return expense.documents || {};
}

export function expenseWarnings(expense, settings, trip, opts) {
  const out = [];
  const limit = settings.expenseLimits?.[expense.categoria] || 0;
  if (limit > 0 && expense.importo > limit) {
    out.push({
      type: "over_limit",
      message: `Sopra limite (max ${fmtMoney(limit, expense.valuta)})`,
    });
  }
  const skipMissingIfSingle = !!opts?.skipMissingIfSingle;
  const checkMissing = expense.merged || !skipMissingIfSingle;
  if (checkMissing) {
    const check = expenseDocCheck(expense, settings);
    if (!check.ok && check.missing && check.missing.length > 0) {
      const labels = check.missing.map(
        (d) => DOC_TYPES.find((t) => t.id === d)?.label || d
      );
      out.push({
        type: "missing_docs",
        message: `Manca: ${labels.join(", ")}`,
      });
    }
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

export function looksLikeSameTransaction(a, b) {
  if (!a || !b) return false;
  if (!a.data || !b.data || a.data !== b.data) return false;
  if (a.categoria !== b.categoria) return false;
  if (!similarMerchant(a.esercente, b.esercente)) return false;
  const da = a.documents || {};
  const db = b.documents || {};
  const complementary =
    (da.scontrino && db.pos) ||
    (da.pos && db.scontrino) ||
    (da.scontrino && db.fattura) ||
    (da.fattura && db.scontrino) ||
    (da.pos && db.fattura) ||
    (da.fattura && db.pos);
  const ai = a.importo || 0;
  const bi = b.importo || 0;
  const amountClose = Math.abs(ai - bi) < 0.5 || (ai > 0 && bi > 0 && Math.abs(ai - bi) / Math.max(ai, bi) < 0.05);
  return complementary || amountClose;
}

export function detectQueueGroups(items) {
  const groups = [];
  const used = new Set();
  for (let i = 0; i < items.length; i++) {
    if (used.has(items[i].id)) continue;
    if (items[i].status !== "done") continue;
    const group = [items[i]];
    used.add(items[i].id);
    for (let j = i + 1; j < items.length; j++) {
      if (used.has(items[j].id)) continue;
      if (items[j].status !== "done") continue;
      if (looksLikeSameTransaction(items[i].data, items[j].data)) {
        group.push(items[j]);
        used.add(items[j].id);
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}

export function mergeQueueItems(items) {
  const sorted = [...items].sort((a, b) => {
    const da = a.data?.documents || {};
    const db = b.data?.documents || {};
    const docCountA = Object.values(da).filter(Boolean).length;
    const docCountB = Object.values(db).filter(Boolean).length;
    if (docCountA !== docCountB) return docCountB - docCountA;
    return (b.data?.importo || 0) - (a.data?.importo || 0);
  });
  const base = sorted[0];
  const mergedDocs = { scontrino: false, pos: false, fattura: false };
  let bestImporto = 0;
  let bestDescr = "";
  let bestEsercente = "";
  for (const it of items) {
    const d = it.data?.documents || {};
    if (d.scontrino) mergedDocs.scontrino = true;
    if (d.pos) mergedDocs.pos = true;
    if (d.fattura) mergedDocs.fattura = true;
    if ((it.data?.importo || 0) > bestImporto) bestImporto = it.data.importo;
    if ((it.data?.descrizione || "").length > bestDescr.length)
      bestDescr = it.data.descrizione;
    if ((it.data?.esercente || "").length > bestEsercente.length)
      bestEsercente = it.data.esercente;
  }
  return {
    ...base,
    data: {
      ...base.data,
      esercente: bestEsercente || base.data.esercente,
      descrizione: bestDescr || base.data.descrizione,
      importo: bestImporto || base.data.importo,
      documents: mergedDocs,
      merged: true,
    },
  };
}

export function defaultDocsForNewExpense() {
  return { scontrino: false, pos: false, fattura: false, estratto: false };
}

export function requiredDocsList(settings) {
  const r = settings?.requiredDocs || {};
  if (Array.isArray(r.alternatives) && r.alternatives.length > 0) {
    return [...new Set(r.alternatives.flat())].filter((id) => DOC_TYPE_IDS.includes(id));
  }
  return DOC_TYPE_IDS.filter((id) => r[id] === true);
}

export function expenseDocCheck(expense, settings) {
  const docs = expense.documents || {};
  const r = settings?.requiredDocs || {};
  let alts = Array.isArray(r.alternatives) ? r.alternatives : null;
  if (!alts || alts.length === 0) {
    const legacy = DOC_TYPE_IDS.filter((id) => r[id] === true);
    alts = legacy.length > 0 ? [legacy] : [];
  }
  const nonEmpty = alts.filter((a) => Array.isArray(a) && a.length > 0);
  if (nonEmpty.length === 0) return { ok: true };

  let bestMissing = null;
  let bestAlt = null;
  for (const alt of nonEmpty) {
    const missing = alt.filter((d) => !docs[d]);
    if (missing.length === 0) return { ok: true, satisfiedAlt: alt };
    if (bestMissing === null || missing.length < bestMissing.length) {
      bestMissing = missing;
      bestAlt = alt;
    }
  }
  return { ok: false, missing: bestMissing || [], closestAlt: bestAlt };
}
