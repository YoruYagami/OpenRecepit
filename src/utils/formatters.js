export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const fmtMoney = (n, cur = "EUR") => {
  if (typeof n !== "number" || isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: cur || "EUR",
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `€${n.toFixed(2)}`;
  }
};

export const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
};

const CATEGORY_DEFAULT_TIME = {
  colazione: 8 * 60,
  pranzo: 13 * 60,
  cena: 20 * 60,
  taxi: 12 * 60,
  metro: 12 * 60,
  treno: 10 * 60,
  aereo: 10 * 60,
  hotel: 22 * 60,
  parcheggio: 12 * 60,
  carburante: 11 * 60,
  altro: 12 * 60,
};

export function expenseTimeMinutes(expense) {
  if (expense.ora && /^\d{2}:\d{2}$/.test(expense.ora)) {
    const [h, m] = expense.ora.split(":").map(Number);
    return h * 60 + m;
  }
  return CATEGORY_DEFAULT_TIME[expense.categoria] ?? 12 * 60;
}

export const fmtDayLabel = (iso) => {
  if (!iso) return "Senza data";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diffDays = Math.round((that - today) / 86400000);
  const formatted = d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (diffDays === 0) return `Oggi · ${formatted}`;
  if (diffDays === -1) return `Ieri · ${formatted}`;
  return formatted;
};

export const fmtDateRange = (start, end) => {
  if (!start && !end) return "";
  if (start && end) {
    const a = new Date(start), b = new Date(end);
    if (!isNaN(a) && !isNaN(b)) {
      const sameYear = a.getFullYear() === b.getFullYear();
      const sa = a.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: sameYear ? undefined : "numeric" });
      const sb = b.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
      return `${sa} – ${sb}`;
    }
  }
  return [start, end].filter(Boolean).map(fmtDate).join(" – ");
};
