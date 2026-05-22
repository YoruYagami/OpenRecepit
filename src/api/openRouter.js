import { RECEIPT_PROMPT, CATEGORY_IDS, MODELS } from '../constants.js';

export const todayISO = () => new Date().toISOString().slice(0, 10);

const DEFAULT_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
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

function mapStatusToMessage(status, fallback) {
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
  const t = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

function parseRetryAfter(res) {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const asInt = parseInt(h, 10);
  if (!isNaN(asInt)) return Math.max(0, asInt * 1000);
  const asDate = Date.parse(h);
  if (!isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

async function callOpenRouter(url, init, { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = {}) {
  let attempt = 0;
  let lastError = null;
  while (attempt <= retries) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs, signal);
      if (res.ok) return res;
      const isRetryable = RETRYABLE_STATUS.has(res.status);
      const errText = await res.text().catch(() => "");
      if (!isRetryable || attempt === retries) {
        throw new OpenRouterError(
          mapStatusToMessage(res.status, errText.slice(0, 200)),
          { status: res.status, retryable: isRetryable }
        );
      }
      const retryAfter = parseRetryAfter(res);
      const backoff = retryAfter != null ? retryAfter : Math.min(8000, 500 * Math.pow(2, attempt));
      await sleep(backoff, signal);
    } catch (e) {
      if (e?.name === "AbortError" && !signal?.aborted) {
        // our timeout fired
        lastError = new OpenRouterError("Timeout — il modello non ha risposto in tempo", { code: "timeout", retryable: true });
      } else if (e?.name === "AbortError") {
        throw e;
      } else if (e instanceof OpenRouterError) {
        throw e;
      } else {
        lastError = new OpenRouterError(e?.message || "Errore di rete", { code: "network", retryable: true });
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
    "X-Title": "Scontrini Trasferta",
  };
}

export async function analyzeReceipt({ apiKey, model, imageDataUrl, signal }) {
  if (!apiKey) throw new OpenRouterError("API key mancante", { code: "no_key" });
  if (!model) throw new OpenRouterError("Modello non selezionato", { code: "no_model" });

  const res = await callOpenRouter(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(apiKey) },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl } },
              { type: "text", text: RECEIPT_PROMPT },
            ],
          },
        ],
      }),
    },
    { signal }
  );

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new OpenRouterError("Risposta vuota dal modello");

  return parseReceiptResponse(text);
}

export function parseReceiptResponse(text) {
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : cleaned;

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new OpenRouterError("Impossibile interpretare la risposta JSON del modello");
  }

  const importoNum =
    typeof parsed.importo === "number"
      ? parsed.importo
      : parseFloat(String(parsed.importo ?? "").replace(",", ".").replace(/[^0-9.-]/g, ""));

  const docsRaw = parsed.documenti || parsed.documents || null;
  const detectedDocs = docsRaw
    ? {
        scontrino: !!docsRaw.scontrino,
        pos: !!(docsRaw.pos || docsRaw.ricevuta_pos || docsRaw.ricevutaPos),
        fattura: !!docsRaw.fattura,
        estratto: !!(docsRaw.estratto || docsRaw.estratto_conto || docsRaw.estrattoConto || docsRaw.statement),
      }
    : null;

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
    valuta: String(parsed.valuta || "EUR").toUpperCase().slice(0, 6) || "EUR",
    detectedDocs,
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
    "X-Title": "Scontrini Trasferta",
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
