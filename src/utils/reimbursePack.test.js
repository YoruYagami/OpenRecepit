import { describe, it, expect } from "vitest";
import { sanitizeName, packFileBase } from "./reimbursePack.js";

describe("sanitizeName", () => {
  it("drops commas, spaces, accents and other unsafe characters", () => {
    expect(sanitizeName("Caffè Rosati, Roma")).toBe("Caffe-Rosati-Roma");
    expect(sanitizeName("A/B\\C:D*E?F")).toBe("A-B-C-D-E-F");
    expect(sanitizeName("  --strano--  ")).toBe("strano");
  });

  it("falls back when everything is stripped", () => {
    expect(sanitizeName("???")).toBe("spesa");
    expect(sanitizeName("")).toBe("spesa");
  });

  it("truncates long names", () => {
    expect(sanitizeName("x".repeat(100)).length).toBeLessThanOrEqual(40);
  });
});

describe("packFileBase", () => {
  it("builds index_categoria_importoVALUTA_esercente with dash decimals", () => {
    const e = { importo: 23.5, valuta: "EUR", categoria: "pranzo", esercente: "Trattoria Roma" };
    expect(packFileBase(e, 1)).toBe("01_pranzo_23-50EUR_Trattoria-Roma");
  });

  it("never contains commas, spaces or dots", () => {
    const e = {
      importo: 1234.56,
      valuta: "USD",
      categoria: "hotel",
      esercente: "Hotel Bella Vista, München",
    };
    const name = packFileBase(e, 12);
    expect(name).not.toMatch(/[,\s.]/);
    expect(name).toContain("1234-56USD");
  });

  it("handles missing fields", () => {
    expect(packFileBase({}, 3)).toBe("03_altro_0-00EUR_spesa");
  });
});
