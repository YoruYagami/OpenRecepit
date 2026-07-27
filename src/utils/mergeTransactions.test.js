import { describe, it, expect } from "vitest";
import { looksLikeSameTransaction, mergeQueueItems } from "./expenseLogic.js";

const cena = (over = {}) => ({
  data: "2026-07-21",
  importo: 48.5,
  esercente: "Trattoria Roma",
  categoria: "cena",
  ...over,
});

describe("looksLikeSameTransaction", () => {
  it("matches receipt + POS slip of the same dinner", () => {
    expect(looksLikeSameTransaction(cena(), cena({ importo: 48.5 }))).toBe(true);
  });

  it("tolerates small amount differences (tip/rounding)", () => {
    expect(looksLikeSameTransaction(cena(), cena({ importo: 48.9 }))).toBe(true);
    expect(looksLikeSameTransaction(cena({ importo: 100 }), cena({ importo: 104 }))).toBe(true);
  });

  it("matches when one document has no readable merchant (statement/POS)", () => {
    expect(looksLikeSameTransaction(cena(), cena({ esercente: "Esercente sconosciuto" }))).toBe(
      true
    );
    expect(looksLikeSameTransaction(cena(), cena({ esercente: "" }))).toBe(true);
  });

  it("does not match different days, amounts or merchants", () => {
    expect(looksLikeSameTransaction(cena(), cena({ data: "2026-07-22" }))).toBe(false);
    expect(looksLikeSameTransaction(cena(), cena({ importo: 12 }))).toBe(false);
    expect(looksLikeSameTransaction(cena(), cena({ esercente: "Hotel Bella Vista" }))).toBe(false);
  });

  it("ignores zero-amount candidates", () => {
    expect(looksLikeSameTransaction(cena({ importo: 0 }), cena())).toBe(false);
  });
});

describe("mergeQueueItems", () => {
  it("keeps the richest data and attaches the other documents", () => {
    const scontrino = {
      id: "a",
      thumb: "t-a",
      full: "f-a",
      data: cena({ iva: [{ aliquota: 10, imponibile: 44.09, imposta: 4.41 }], ora: "20:30" }),
    };
    const pos = {
      id: "b",
      thumb: "t-b",
      full: "f-b",
      data: cena({ esercente: "Esercente sconosciuto", importo: 48.5 }),
    };
    const merged = mergeQueueItems([pos, scontrino]);

    expect(merged.id).toBe("a"); // the receipt (VAT + time) wins
    expect(merged.data.esercente).toBe("Trattoria Roma");
    expect(merged.data.iva).toHaveLength(1);
    expect(merged.data.ora).toBe("20:30");
    expect(merged.mergedCount).toBe(2);
    expect(merged.extraImages).toHaveLength(1);
    expect(merged.extraImages[0].full).toBe("f-b");
  });

  it("fills missing fields from the other document and keeps the higher amount", () => {
    const a = { id: "a", data: cena({ esercente: "Esercente sconosciuto", ora: null }) };
    const b = { id: "b", data: cena({ importo: 49.9, ora: "21:00" }) };
    const merged = mergeQueueItems([a, b]);
    expect(merged.data.esercente).toBe("Trattoria Roma");
    expect(merged.data.ora).toBe("21:00");
    expect(merged.data.importo).toBe(49.9);
  });

  it("carries PDF metadata into the attachment list", () => {
    const a = { id: "a", data: cena() };
    const b = { id: "b", isPdf: true, fileName: "revolut.pdf", full: "f-b", data: cena() };
    const merged = mergeQueueItems([a, b]);
    expect(merged.extraImages[0]).toMatchObject({ pdf: true, fileName: "revolut.pdf" });
  });
});
