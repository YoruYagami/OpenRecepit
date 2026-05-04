import { RECEIPT_PROMPT, CATEGORY_IDS, MODELS } from '../constants.js';

export const todayISO = () => new Date().toISOString().slice(0, 10);

export async function analyzeReceipt({ apiKey, model, imageDataUrl }) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.href : "",
      "X-Title": "Scontrini Trasferta",
    },
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
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${errText.slice(0, 240) || res.statusText}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Risposta vuota dal modello");

  const cleaned = String(text).replace(/```json|```/g, "").trim();
  const match = cleaned.match(/{[\s\S]*}/);
  const jsonStr = match ? match[0] : cleaned;

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("Impossibile interpretare la risposta JSON del modello");
  }

  // Normalize
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

export async function validateOpenRouterKey(apiKey) {
  const res = await fetch("https://openrouter.ai/api/v1/key", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.href : "",
      "X-Title": "Scontrini Trasferta",
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("API key non valida o non autorizzata");
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${t.slice(0, 200) || res.statusText}`);
  }
  const data = await res.json();
  return data?.data || data || {};
}

export async function fetchOpenRouterModels(apiKey) {
  const headers = {
    "HTTP-Referer": typeof window !== "undefined" ? window.location.href : "",
    "X-Title": "Scontrini Trasferta",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch("https://openrouter.ai/api/v1/models", { headers });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Modelli ${res.status}: ${t.slice(0, 200) || res.statusText}`);
  }
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
