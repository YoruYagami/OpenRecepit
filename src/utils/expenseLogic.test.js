import { describe, it, expect } from "vitest";
import {
  similarMerchant,
  findContentDuplicate,
  expenseWarnings,
  emptyExpenseData,
  totalsByCurrency,
  fmtCurrencyTotals,
} from "./expenseLogic.js";

describe("similarMerchant", () => {
  it("matches identical names", () => {
    expect(similarMerchant("Bar Pippo", "Bar Pippo")).toBe(true);
  });

  it("strips SRL/SPA/SNC legal suffixes", () => {
    expect(similarMerchant("Bar Pippo SRL", "Bar Pippo SPA")).toBe(true);
    expect(similarMerchant("Bar Pippo S.R.L.", "Bar Pippo")).toBe(true);
    expect(similarMerchant("Bar Pippo s.n.c.", "Bar Pippo SNC")).toBe(true);
  });

  it("matches when first word matches and is long enough", () => {
    expect(similarMerchant("Trattoria Roma centro", "Trattoria Roma succursale")).toBe(true);
  });

  it("does not match unrelated merchants", () => {
    expect(similarMerchant("Bar Pippo", "Trattoria Roma")).toBe(false);
  });

  it("handles empty input gracefully", () => {
    expect(similarMerchant("", "something")).toBe(false);
    expect(similarMerchant(null, undefined)).toBe(false);
  });
});

describe("findContentDuplicate", () => {
  const expenses = [
    { id: "a", data: "2026-01-15", importo: 25.5, esercente: "Bar Centro" },
    { id: "b", data: "2026-01-16", importo: 12.0, esercente: "Caffè Roma" },
  ];

  it("finds a duplicate with matching date, amount, merchant", () => {
    const candidate = { data: "2026-01-15", importo: 25.5, esercente: "Bar Centro SRL" };
    const dup = findContentDuplicate(candidate, expenses);
    expect(dup?.id).toBe("a");
  });

  it("returns null when amount differs", () => {
    const candidate = { data: "2026-01-15", importo: 30, esercente: "Bar Centro" };
    expect(findContentDuplicate(candidate, expenses)).toBeNull();
  });

  it("returns null when date differs", () => {
    const candidate = { data: "2026-02-01", importo: 25.5, esercente: "Bar Centro" };
    expect(findContentDuplicate(candidate, expenses)).toBeNull();
  });

  it("ignores zero-importo candidates", () => {
    const candidate = { data: "2026-01-15", importo: 0, esercente: "Bar Centro" };
    expect(findContentDuplicate(candidate, expenses)).toBeNull();
  });
});

describe("expenseWarnings", () => {
  const settings = { expenseLimits: {} };

  it("flags a zero or missing amount", () => {
    const warns = expenseWarnings({ importo: 0, categoria: "altro" }, settings);
    expect(warns.some((w) => w.type === "zero_amount")).toBe(true);
    expect(
      expenseWarnings({ categoria: "altro" }, settings).some((w) => w.type === "zero_amount")
    ).toBe(true);
  });

  it("does not flag a positive amount", () => {
    const warns = expenseWarnings({ importo: 12.5, categoria: "altro" }, settings);
    expect(warns.some((w) => w.type === "zero_amount")).toBe(false);
  });

  it("flags amounts over the category limit", () => {
    const warns = expenseWarnings(
      { importo: 60, categoria: "cena" },
      { expenseLimits: { cena: 50 } }
    );
    expect(warns.some((w) => w.type === "over_limit")).toBe(true);
  });

  it("flags dates outside the trip range", () => {
    const trip = { startDate: "2026-01-10", endDate: "2026-01-12" };
    const before = expenseWarnings({ importo: 5, data: "2026-01-09" }, settings, trip);
    const after = expenseWarnings({ importo: 5, data: "2026-01-13" }, settings, trip);
    const inside = expenseWarnings({ importo: 5, data: "2026-01-11" }, settings, trip);
    expect(before.some((w) => w.type === "out_of_range")).toBe(true);
    expect(after.some((w) => w.type === "out_of_range")).toBe(true);
    expect(inside.some((w) => w.type === "out_of_range")).toBe(false);
  });
});

describe("emptyExpenseData", () => {
  it("produces a valid blank expense payload", () => {
    const e = emptyExpenseData();
    expect(e.importo).toBe(0);
    expect(e.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e.categoria).toBe("altro");
    expect(e.valuta).toBe("EUR");
  });
});

describe("totalsByCurrency / fmtCurrencyTotals", () => {
  it("sums per currency instead of mixing them", () => {
    const totals = totalsByCurrency([
      { importo: 10, valuta: "EUR" },
      { importo: 5 }, // defaults to EUR
      { importo: 20, valuta: "USD" },
    ]);
    expect(totals).toEqual({ EUR: 15, USD: 20 });
  });

  it("formats a single currency plainly and joins mixed ones", () => {
    expect(fmtCurrencyTotals({ EUR: 15 })).not.toContain("+");
    const mixed = fmtCurrencyTotals({ USD: 20, EUR: 15 });
    expect(mixed).toContain("+");
    // EUR is listed first regardless of insertion order
    expect(mixed.indexOf("15")).toBeLessThan(mixed.indexOf("20"));
  });
});
