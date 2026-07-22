import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseReceiptResponse,
  parseRetryAfter,
  mapStatusToMessage,
  analyzeReceipt,
  parseImporto,
} from "./openRouter.js";

// Minimal fetch Response stand-in matching what callOpenRouter consumes.
function mockRes({ ok = true, status = 200, body = {}, headers = {} }) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok,
    status,
    headers: { get: (k) => lower[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

function chatBody(obj) {
  return { choices: [{ message: { content: JSON.stringify(obj) } }] };
}

const VALID = { esercente: "X", importo: 1, data: "2026-01-01", categoria: "altro" };

describe("parseReceiptResponse", () => {
  it("parses a clean JSON response", () => {
    const text = JSON.stringify({
      esercente: "Bar Centro",
      importo: 12.5,
      data: "2026-01-15",
      ora: "08:30",
      categoria: "colazione",
      descrizione: "Cappuccino e cornetto",
      valuta: "EUR",
    });
    const out = parseReceiptResponse(text);
    expect(out.esercente).toBe("Bar Centro");
    expect(out.importo).toBe(12.5);
    expect(out.data).toBe("2026-01-15");
    expect(out.ora).toBe("08:30");
    expect(out.categoria).toBe("colazione");
  });

  it("strips markdown code fences", () => {
    const text =
      "```json\n" +
      JSON.stringify({ esercente: "X", importo: 1, data: "2026-01-01", categoria: "altro" }) +
      "\n```";
    const out = parseReceiptResponse(text);
    expect(out.esercente).toBe("X");
  });

  it("coerces stringy importo with comma and currency symbol", () => {
    const text = JSON.stringify({
      esercente: "X",
      importo: "12,50 €",
      data: "2026-01-01",
      categoria: "altro",
    });
    const out = parseReceiptResponse(text);
    expect(out.importo).toBe(12.5);
  });

  it("defaults today when data is invalid", () => {
    const text = JSON.stringify({
      esercente: "X",
      importo: 1,
      data: "not-a-date",
      categoria: "altro",
    });
    const out = parseReceiptResponse(text);
    expect(out.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns null ora when missing or unparseable", () => {
    const text = JSON.stringify({
      esercente: "X",
      importo: 1,
      data: "2026-01-01",
      categoria: "altro",
    });
    expect(parseReceiptResponse(text).ora).toBeNull();
  });

  it("clamps invalid categoria to altro", () => {
    const text = JSON.stringify({
      esercente: "X",
      importo: 1,
      data: "2026-01-01",
      categoria: "space-travel",
    });
    expect(parseReceiptResponse(text).categoria).toBe("altro");
  });

  it("throws on non-JSON content", () => {
    expect(() => parseReceiptResponse("just some text with no braces")).toThrow();
  });

  it("parses amounts with thousands separators", () => {
    expect(parseImporto("1.234,56")).toBe(1234.56);
    expect(parseImporto("1,234.56")).toBe(1234.56);
    expect(parseImporto("1.234.567,89")).toBe(1234567.89);
    expect(parseImporto("1,234,567")).toBe(1234567);
    expect(parseImporto("12,50 €")).toBe(12.5);
    expect(parseImporto("12.50")).toBe(12.5);
    expect(parseImporto(12.5)).toBe(12.5);
  });

});

describe("parseRetryAfter", () => {
  const res = (h) => ({ headers: { get: () => h } });
  it("parses integer seconds into ms", () => {
    expect(parseRetryAfter(res("5"))).toBe(5000);
    expect(parseRetryAfter(res("0"))).toBe(0);
  });
  it("returns null when header absent", () => {
    expect(parseRetryAfter(res(null))).toBeNull();
  });
  it("parses an HTTP date in the future to a positive delay", () => {
    const future = new Date(Date.now() + 10000).toUTCString();
    const ms = parseRetryAfter(res(future));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(11000);
  });
});

describe("mapStatusToMessage", () => {
  it("maps auth/credit/not-found/rate-limit to Italian messages", () => {
    expect(mapStatusToMessage(401)).toMatch(/non valida|non autorizzata/i);
    expect(mapStatusToMessage(402)).toMatch(/credito/i);
    expect(mapStatusToMessage(404)).toMatch(/non disponibile/i);
    expect(mapStatusToMessage(429)).toMatch(/limite/i);
    expect(mapStatusToMessage(503)).toMatch(/non disponibile/i);
  });
  it("falls back for unknown status", () => {
    expect(mapStatusToMessage(418, "boom")).toBe("boom");
    expect(mapStatusToMessage(418)).toMatch(/418/);
  });
});

describe("callOpenRouter (via analyzeReceipt)", () => {
  const args = { apiKey: "k", model: "m", imageDataUrl: "data:image/jpeg;base64,AAAA" };

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries on 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRes({ ok: false, status: 429, body: "rate" }))
      .mockResolvedValueOnce(mockRes({ body: chatBody(VALID) }));
    vi.stubGlobal("fetch", fetchMock);

    const p = analyzeReceipt(args);
    await vi.runAllTimersAsync();
    const out = await p;
    expect(out.esercente).toBe("X");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRes({ ok: false, status: 401, body: "nope" }));
    vi.stubGlobal("fetch", fetchMock);

    const p = analyzeReceipt(args);
    const assertion = expect(p).rejects.toThrow(/non valida|non autorizzata/i);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caps an oversized Retry-After at 30s", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockRes({ ok: false, status: 503, body: "busy", headers: { "retry-after": "3600" } })
      )
      .mockResolvedValueOnce(mockRes({ body: chatBody(VALID) }));
    vi.stubGlobal("fetch", fetchMock);

    const p = analyzeReceipt(args);
    await vi.runAllTimersAsync();
    await p;
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1]);
    expect(delays).toContain(30000); // 3600s clamped to MAX_RETRY_AFTER_MS
    expect(delays).not.toContain(3600000);
  });

  it("fails fast when offline without calling fetch", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const p = analyzeReceipt(args);
    const assertion = expect(p).rejects.toThrow(/offline/i);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
