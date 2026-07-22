import { describe, it, expect } from "vitest";
import { csvEscape, tripToCSV, tripToSummary } from "./export.js";

describe("csvEscape", () => {
  it("leaves simple values unquoted", () => {
    expect(csvEscape("plain")).toBe("plain");
  });

  it("quotes values containing newline, comma, semicolon or quote", () => {
    expect(csvEscape("a\nb")).toBe('"a\nb"');
    expect(csvEscape("a;b")).toBe('"a;b"');
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
  });

  it('does not quote literal "n" characters', () => {
    expect(csvEscape("cornetto")).toBe("cornetto");
  });
});

describe("tripToCSV", () => {
  it("outputs header + one row per expense with newline separators", () => {
    const trip = {
      name: "Test",
      expenses: [
        {
          data: "2026-01-15",
          ora: "12:30",
          esercente: "Bar",
          categoria: "pranzo",
          descrizione: "Pranzo veloce",
          importo: 12.5,
          valuta: "EUR",
        },
        {
          data: "2026-01-15",
          ora: "08:00",
          esercente: "Café",
          categoria: "colazione",
          descrizione: "Cappuccino",
          importo: 2.5,
          valuta: "EUR",
        },
      ],
    };
    const csv = tripToCSV(trip);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Data");
    // expenses are sorted by date then time
    expect(lines[1]).toContain("Café");
    expect(lines[2]).toContain("Bar");
    expect(lines[1]).toContain("2,50");
  });
});

describe("tripToSummary", () => {
  it("includes name, totals, and per-category breakdown", () => {
    const trip = {
      name: "Roma",
      city: "Roma",
      startDate: "2026-01-15",
      endDate: "2026-01-17",
      expenses: [
        { categoria: "pranzo", importo: 22, valuta: "EUR" },
        { categoria: "pranzo", importo: 18, valuta: "EUR" },
        { categoria: "taxi", importo: 15, valuta: "EUR" },
      ],
    };
    const summary = tripToSummary(trip);
    expect(summary).toContain("Roma");
    expect(summary).toContain("Pranzo");
    expect(summary).toContain("Taxi");
    expect(summary.split("\n").length).toBeGreaterThan(5);
  });
});
