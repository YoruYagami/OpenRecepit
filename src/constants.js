// Keep in sync with package.json "version" (shown in Settings).
export const APP_VERSION = "2.0.0";

export const STORAGE_TRIPS = "receipt-tracker-trips";
export const STORAGE_SETTINGS = "receipt-tracker-settings";
export const STORAGE_MODELS = "receipt-tracker-models";
// Sibling IndexedDB keys: the schema version the persisted trips were written
// with (drives forward migration) and a one-slot rescue snapshot taken before a
// destructive backup restore.
export const STORAGE_DATA_VERSION = "receipt-tracker-data-version";
export const STORAGE_TRIPS_RESCUE = "receipt-tracker-trips-rescue";

export const MODELS = [
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "qwen/qwen-2.5-vl-72b-instruct", label: "Qwen 2.5 VL 72B" },
  { id: "meta-llama/llama-4-scout", label: "Llama 4 Scout" },
];

export const CATEGORIES = {
  colazione: { label: "Colazione", icon: "☕", color: "#D4915E" },
  pranzo: { label: "Pranzo", icon: "🍝", color: "#2A9D8F" },
  cena: { label: "Cena", icon: "🍷", color: "#9B2226" },
  taxi: { label: "Taxi", icon: "🚕", color: "#E9C46A" },
  metro: { label: "Metro/Bus", icon: "🚇", color: "#264653" },
  treno: { label: "Treno", icon: "🚆", color: "#6C5B7B" },
  aereo: { label: "Aereo", icon: "✈️", color: "#355C7D" },
  hotel: { label: "Hotel", icon: "🏨", color: "#C06C84" },
  parcheggio: { label: "Parcheggio", icon: "🅿️", color: "#588157" },
  carburante: { label: "Carburante", icon: "⛽", color: "#E76F51" },
  altro: { label: "Altro", icon: "📎", color: "#8B8687" },
};
export const CATEGORY_IDS = Object.keys(CATEGORIES);

export const DEFAULT_LIMITS = {
  colazione: 15,
  pranzo: 35,
  cena: 50,
  taxi: 50,
  metro: 0,
  treno: 200,
  aereo: 500,
  hotel: 200,
  parcheggio: 30,
  carburante: 100,
  altro: 0,
};

export const DEFAULT_SETTINGS = {
  apiKey: "",
  model: MODELS[0].id,
  theme: "auto", // "auto" | "light" | "dark"
  pinEnabled: false,
  pinHash: null,
  pinSalt: null,
  pinLength: 6,
  biometricEnabled: false,
  biometricCredId: null,
  expenseLimits: { ...DEFAULT_LIMITS },
  onboardingDone: false,
};

export const RECEIPT_PROMPT = `Analizza questo scontrino/ricevuta e rispondi ESCLUSIVAMENTE con un JSON valido. Nessun testo prima o dopo, nessun backtick markdown, SOLO il JSON.

Struttura richiesta:
{
  "esercente": "nome dell'esercente o negozio",
  "importo": 12.50,
  "data": "YYYY-MM-DD",
  "ora": "HH:MM",
  "categoria": "una tra: colazione|pranzo|cena|taxi|metro|treno|aereo|hotel|parcheggio|carburante|altro",
  "descrizione": "breve descrizione della spesa in 5-10 parole",
  "valuta": "EUR",
  "iva": [
    { "aliquota": 22, "imponibile": 10.25, "imposta": 2.25 }
  ]
}

Regole di classificazione categoria:
- bar, caffè, pasticceria, cornetto, cappuccino → "colazione"
- ristorante/trattoria/pizzeria con orario 11:30-15:30 → "pranzo"
- ristorante/trattoria/pizzeria con orario 18:30-23:30 → "cena"
- se l'orario non è determinabile, classifica come "pranzo" se importo < 20€, "cena" se >= 20€
- taxi, uber, Lyft, NCC, noleggio con conducente → "taxi"
- metropolitana, bus urbano, tram, biglietto ATM/ATAC → "metro"
- Trenitalia, Italo, Frecciarossa, regionale → "treno"
- volo, compagnia aerea, aeroporto, fee aeroportuale → "aereo"
- hotel, B&B, albergo, Airbnb, affittacamere → "hotel"
- parcheggio, sosta, strisce blu, garage → "parcheggio"
- benzina, diesel, GPL, metano, ricarica elettrica, colonnina → "carburante"
- tutto ciò che non rientra nelle categorie sopra → "altro"

IVA (campo "iva"): se il documento riporta il dettaglio IVA (aliquote %, imponibile, imposta — comune su scontrini e fatture italiani), estrai una voce per ogni aliquota presente. "aliquota" è la percentuale (es. 4, 5, 10, 22), "imponibile" e "imposta" sono numeri float. Se il dettaglio IVA NON è visibile sul documento, ometti il campo o usa un array vuoto — NON inventare o calcolare aliquote non stampate.

IMPORTANTE:
- "importo" DEVE essere un numero (float), MAI una stringa. Esempio: 12.50 non "12.50€"
- "data" in formato ISO YYYY-MM-DD. Se non leggibile, usa la data di oggi.
- "ora" in formato HH:MM 24h (es. "13:45", "20:10"). Se sullo scontrino non c'è un orario leggibile, ometti il campo o imposta null — non inventarlo.
- Se un campo non è determinabile, fai la migliore stima possibile.`;
