export const STORAGE_TRIPS = "receipt-tracker-trips";
export const STORAGE_SETTINGS = "receipt-tracker-settings";
export const STORAGE_MODELS = "receipt-tracker-models";

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
  colazione:  { label: "Colazione",  icon: "☕",  color: "#D4915E" },
  pranzo:     { label: "Pranzo",     icon: "🍝", color: "#2A9D8F" },
  cena:       { label: "Cena",       icon: "🍷", color: "#9B2226" },
  taxi:       { label: "Taxi",       icon: "🚕", color: "#E9C46A" },
  metro:      { label: "Metro/Bus",  icon: "🚇", color: "#264653" },
  treno:      { label: "Treno",      icon: "🚆", color: "#6C5B7B" },
  aereo:      { label: "Aereo",      icon: "✈️", color: "#355C7D" },
  hotel:      { label: "Hotel",      icon: "🏨", color: "#C06C84" },
  parcheggio: { label: "Parcheggio", icon: "🅿️", color: "#588157" },
  carburante: { label: "Carburante", icon: "⛽", color: "#E76F51" },
  altro:      { label: "Altro",      icon: "📎", color: "#8B8687" },
};
export const CATEGORY_IDS = Object.keys(CATEGORIES);

export const DOC_TYPES = [
  { id: "scontrino", label: "Scontrino", icon: "🧾" },
  { id: "pos",       label: "Ricevuta POS", icon: "💳" },
  { id: "fattura",   label: "Fattura", icon: "📄" },
  { id: "estratto",  label: "Estratto conto", icon: "🏦" },
];
export const DOC_TYPE_IDS = DOC_TYPES.map((d) => d.id);

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
  pinLength: 4,
  biometricEnabled: false,
  biometricCredId: null,
  expenseLimits: { ...DEFAULT_LIMITS },
  requiredDocs: { alternatives: [] },
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
  "documenti": {
    "scontrino": true,
    "pos": false,
    "fattura": false,
    "estratto": false
  }
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

Riconoscimento tipo documento (campo "documenti"). Imposta a TRUE ogni tipo presente nell'immagine. Più tipi possono essere TRUE contemporaneamente se l'immagine ne contiene più di uno (es. fattura con ricevuta POS allegata, oppure estratto conto con scontrino accanto).
- "scontrino": ricevuta/scontrino fiscale emesso da registratore di cassa. Indizi: dicitura "SCONTRINO FISCALE" / "DOCUMENTO COMMERCIALE" / "RT" / "RCH", numero progressivo, partita IVA SOLO dell'esercente (non del cliente), totale e data/ora emissione, talvolta righe articoli con IVA. NON ha dati del cliente.
- "pos": ricevuta di pagamento elettronico (terminale POS/carta). Indizi: "POS", "CONTACTLESS", "CARTA DI CREDITO/BANCOMAT/DEBITO", "APPROVATO" / "AUTORIZZATO" / "AUTH", "TRANSAZIONE", "ID TERMINALE" / "TID", "STAN", numero ATM/AID, ultime 4 cifre carta tipo ****1234, "COPIA ESERCENTE" / "COPIA CLIENTE", riga firma. È tipicamente un foglietto piccolo e secondario.
- "fattura": fattura/invoice formale. Indizi: dicitura "FATTURA" o "INVOICE" o "FATTURA ELETTRONICA", numero fattura, IVA E codice fiscale del CLIENTE / destinatario stampati, eventuale IBAN, termini/scadenza di pagamento, indirizzo cliente. Documento più strutturato di uno scontrino.
- "estratto": estratto conto bancario o di carta di credito. Indizi: lista MULTI-RIGA di transazioni con date, descrizioni e importi (tabellare); intestazioni "ESTRATTO CONTO" / "MOVIMENTI" / "STATEMENT" / "TRANSACTIONS"; numero conto/IBAN parziale; logo/nome banca o circuito (Visa, Mastercard, Amex). NON è una singola transazione ma un riepilogo di più operazioni.

IMPORTANTE:
- "importo" DEVE essere un numero (float), MAI una stringa. Esempio: 12.50 non "12.50€"
- "data" in formato ISO YYYY-MM-DD. Se non leggibile, usa la data di oggi.
- "ora" in formato HH:MM 24h (es. "13:45", "20:10"). Se sullo scontrino non c'è un orario leggibile, ometti il campo o imposta null — non inventarlo.
- "documenti" deve sempre essere presente con tutti e quattro i campi booleani.
- Se l'immagine non sembra nessuno dei tipi sopra, imposta tutti e quattro a false.
- Se un campo non è determinabile, fai la migliore stima possibile.`;
