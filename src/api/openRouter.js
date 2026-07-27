import { RECEIPT_PROMPT, CATEGORY_IDS, MODELS } from "../constants.js";
import { todayISO } from "../utils/formatters.js";

const DEFAULT_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
// Cap how long we honor a server-supplied Retry-After so a large value
// (e.g. "Retry-After: 3600") can't freeze the UI for minutes/hours.
const MAX_RETRY_AFTER_MS = 30000;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

class OpenRouterError extends Error {
  constructor(message, { status, code, retryable } = {}) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.code = code;
    this.retryable = !!retryable;
  }
}

export function mapStatusToMessage(status, fallback) {
  switch (status) {
    case 401:
    case 403:
      return "API key non valida o non autorizzata";
    case 402:
      return "Credito OpenRouter esaurito o limite raggiunto";
    case 404:
      return "Modello non disponibile su OpenRouter";
    case 408:
      return "Timeout dal modello — riprova";
    case 413:
      return "Immagine troppo grande per il modello";
    case 429:
      return "Limite di richieste raggiunto — riprova tra poco";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Servizio OpenRouter temporaneamente non disponibile";
    default:
      return fallback || `Errore API ${status}`;
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    signal?.addEventListener("abort", onAbort);
  });
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS, externalSignal) {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", onExternalAbort);
  }
  const t = setTimeout(
    () => controller.abort(new DOMException("Timeout", "TimeoutError")),
    timeoutMs
  );
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

export function parseRetryAfter(res) {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const asInt = parseInt(h, 10);
  if (!isNaN(asInt)) return Math.max(0, asInt * 1000);
  const asDate = Date.parse(h);
  if (!isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

async function callOpenRouter(
  url,
  init,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = {}
) {
  // Fail fast when the device is offline instead of burning the retry budget on
  // requests that cannot possibly succeed.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new OpenRouterError("Sei offline — la scansione richiede una connessione", {
      code: "offline",
      retryable: false,
    });
  }
  let attempt = 0;
  let lastError = null;
  while (attempt <= retries) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs, signal);
      if (res.ok) return res;
      const isRetryable = RETRYABLE_STATUS.has(res.status);
      const errText = await res.text().catch(() => "");
      if (!isRetryable || attempt === retries) {
        throw new OpenRouterError(mapStatusToMessage(res.status, errText.slice(0, 200)), {
          status: res.status,
          retryable: isRetryable,
        });
      }
      const retryAfter = parseRetryAfter(res);
      const backoff =
        retryAfter != null
          ? Math.min(MAX_RETRY_AFTER_MS, retryAfter)
          : Math.min(8000, 500 * Math.pow(2, attempt));
      await sleep(backoff, signal);
    } catch (e) {
      if (e?.name === "TimeoutError" || (e?.name === "AbortError" && !signal?.aborted)) {
        // our timeout fired (modern runtimes reject with the abort reason -> "TimeoutError";
        // legacy runtimes that drop the reason reject with a generic "AbortError")
        lastError = new OpenRouterError("Timeout — il modello non ha risposto in tempo", {
          code: "timeout",
          retryable: true,
        });
      } else if (e?.name === "AbortError") {
        throw e;
      } else if (e instanceof OpenRouterError) {
        throw e;
      } else {
        lastError = new OpenRouterError(e?.message || "Errore di rete", {
          code: "network",
          retryable: true,
        });
      }
      if (attempt === retries) throw lastError;
      const backoff = Math.min(8000, 500 * Math.pow(2, attempt));
      await sleep(backoff, signal);
    }
    attempt++;
  }
  throw lastError || new OpenRouterError("Errore sconosciuto");
}

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": typeof window !== "undefined" ? window.location.href : "",
    "X-Title": "OpenRecepit",
  };
}

export async function analyzeReceipt({ apiKey, model, imageDataUrl, pdfDataUrl, fileName, signal }) {
  if (!apiKey) throw new OpenRouterError("API key mancante", { code: "no_key" });
  if (!model) throw new OpenRouterError("Modello non selezionato", { code: "no_model" });

  // PDFs (e.g. Revolut receipts) go through OpenRouter's file parser with the
  // free pdf-text engine: digital PDFs carry embedded text, no OCR needed.
  const docPart = pdfDataUrl
    ? { type: "file", file: { filename: fileName || "documento.pdf", file_data: pdfDataUrl } }
    : { type: "image_url", image_url: { url: imageDataUrl } };

  const res = await callOpenRouter(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(apiKey) },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        ...(pdfDataUrl
          ? { plugins: [{ id: "file-parser", pdf: { engine: "pdf-text" } }] }
          : {}),
        messages: [
          {
            role: "user",
            content: [docPart, { type: "text", text: RECEIPT_PROMPT }],
          },
        ],
      }),
    },
    { signal }
  );

  const data = await res.json();
  // Some providers return content as an array of parts instead of a string.
  const content = data.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((p) => (typeof p === "string" ? p : p?.text || "")).join("")
    : content;
  if (!text) throw new OpenRouterError("Risposta vuota dal modello");

  return parseReceiptResponse(text);
}

/**
 * Parse a monetary amount that may arrive as a number or as a localized string
 * ("12,50 €", "1.234,56", "1,234.56"). With both separators present the
 * rightmost one is the decimal mark; a repeated single separator is thousands.
 */
export function parseImporto(raw) {
  if (typeof raw === "number") return raw;
  let s = String(raw ?? "").replace(/[^0-9.,-]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(/,/g, ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const commas = s.match(/,/g).length;
    s = commas > 1 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot !== -1 && s.match(/\./g).length > 1) {
    s = s.replace(/\./g, "");
  }
  return parseFloat(s);
}

export function parseReceiptResponse(text) {
  const cleaned = String(text)
    .replace(/```json|```/g, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : cleaned;

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new OpenRouterError("Impossibile interpretare la risposta JSON del modello");
  }

  const importoNum = parseImporto(parsed.importo);

  // VAT breakdown (Italian receipts/invoices): keep only plausible rows the
  // model actually read — never a hallucinated single guess.
  const ivaRaw = Array.isArray(parsed.iva) ? parsed.iva : [];
  const iva = ivaRaw
    .map((r) => ({
      aliquota: Number(r?.aliquota),
      imponibile: Math.round((parseImporto(r?.imponibile) || 0) * 100) / 100,
      imposta: Math.round((parseImporto(r?.imposta) || 0) * 100) / 100,
    }))
    .filter(
      (r) =>
        isFinite(r.aliquota) &&
        r.aliquota > 0 &&
        r.aliquota <= 30 &&
        (r.imposta > 0 || r.imponibile > 0)
    )
    .slice(0, 4);

  const oraRaw = String(parsed.ora || "").trim();
  const oraMatch = oraRaw.match(/^(\d{1,2}):(\d{2})/);
  let ora = null;
  if (oraMatch) {
    const h = Math.min(23, Math.max(0, parseInt(oraMatch[1], 10)));
    const m = Math.min(59, Math.max(0, parseInt(oraMatch[2], 10)));
    ora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return {
    esercente: String(parsed.esercente || "").trim() || "Esercente sconosciuto",
    importo: isFinite(importoNum) ? Math.round(importoNum * 100) / 100 : 0,
    data: /^\d{4}-\d{2}-\d{2}$/.test(parsed.data) ? parsed.data : todayISO(),
    ora,
    categoria: CATEGORY_IDS.includes(parsed.categoria) ? parsed.categoria : "altro",
    descrizione: String(parsed.descrizione || "").trim(),
    valuta:
      String(parsed.valuta || "EUR")
        .toUpperCase()
        .slice(0, 6) || "EUR",
    ...(iva.length > 0 ? { iva } : {}),
  };
}

export async function validateOpenRouterKey(apiKey, { signal } = {}) {
  if (!apiKey) throw new OpenRouterError("API key mancante", { code: "no_key" });
  const res = await callOpenRouter(
    "https://openrouter.ai/api/v1/key",
    { headers: authHeaders(apiKey) },
    { signal, timeoutMs: 15000, retries: 1 }
  );
  const data = await res.json();
  return data?.data || data || {};
}

export async function fetchOpenRouterModels(apiKey, { signal } = {}) {
  const headers = {
    "HTTP-Referer": typeof window !== "undefined" ? window.location.href : "",
    "X-Title": "OpenRecepit",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await callOpenRouter(
    "https://openrouter.ai/api/v1/models",
    { headers },
    { signal, timeoutMs: 15000, retries: 1 }
  );
  const data = await res.json();
  const list = (data?.data || []).map((m) => ({
    id: m.id,
    name: m.name || m.id,
    description: m.description || "",
    context_length: m.context_length || 0,
    pricing: m.pricing || null,
    modality: m.architecture?.modality || "",
    input_modalities: m.architecture?.input_modalities || [],
  }));
  return list;
}

export function isVisionModel(m) {
  if (!m) return false;
  if (Array.isArray(m.input_modalities) && m.input_modalities.length) {
    return m.input_modalities.some((x) => /image/i.test(x));
  }
  if (typeof m.modality === "string") {
    return /image/i.test(m.modality);
  }
  return false;
}

export function modelDisplayName(id, models) {
  const fromList = (models || []).find((m) => m.id === id);
  if (fromList) return fromList.name || fromList.id;
  const fromStatic = MODELS.find((m) => m.id === id);
  if (fromStatic) return fromStatic.label;
  return id;
}

export { OpenRouterError };
