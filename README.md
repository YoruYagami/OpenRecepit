# Scontrini Trasferta (OpenRecepit)

App locale per scansionare e organizzare gli scontrini delle trasferte di lavoro.
La scansione usa un modello vision via [OpenRouter](https://openrouter.ai). I dati restano sul dispositivo: niente account, niente cloud, niente backend.

Disponibile come:

- **Web app** / PWA (browser desktop e mobile)
- **Android APK** via Capacitor

---

## Funzionalità principali

- Trasferte multiple, ognuna con elenco spese e totale
- Scansione scontrini da fotocamera o galleria, con riconoscimento automatico di esercente, importo, data, ora, categoria e tipo di documento (scontrino, ricevuta POS, fattura, estratto)
- Rilevamento duplicati: stesso scontrino già caricato (per hash immagine o per contenuto)
- Merge automatico di scontrino + ricevuta POS della stessa transazione
- Limiti di rimborso per categoria con warning automatici
- Regole "documenti richiesti" (es. *scontrino oppure fattura+POS*)
- Export CSV (con BOM UTF-8, compatibile Excel) e riepilogo testuale
- Backup/restore in JSON
- Protezione locale: PIN (PBKDF2-SHA256, 150k iterazioni) + sblocco biometrico (Android nativo o WebAuthn su browser)
- Dark mode automatica

---

## Setup di sviluppo

Richiede Node.js 18+ e npm.

```bash
npm install
npm run dev        # web dev server su http://localhost:5173
```

Per la build di produzione (web):

```bash
npm run build
npm run preview    # serve dist/ per verifica locale
```

### Build Android (Capacitor)

Richiede JDK 17 e Android SDK installati.

```bash
npm run cap:init-android       # solo la prima volta
npm run android:open           # apre Android Studio
npm run android:apk            # build APK debug
npm run android:apk-release    # build APK release (richiede keystore configurato)
```

### Lint, format, test

```bash
npm run lint
npm run format
npm run test
```

---

## Configurazione iniziale dell'utente

1. Apri la tab **Impostazioni**.
2. Inserisci una API key di OpenRouter (`sk-or-v1-...`) — se non l'hai: <https://openrouter.ai/keys>.
3. Tocca **Verifica API key** per validarla.
4. Scegli un modello con capacità vision (filtro "Solo modelli vision" attivo di default). Default consigliati: Gemini 2.5 Flash (economico), GPT-4o-mini, Claude Sonnet.
5. Salva.
6. (Opzionale) Imposta un PIN e attiva lo sblocco biometrico nella sezione **Sicurezza**.

A questo punto crea una trasferta dalla tab **Trasferte** e usa la tab centrale **Scansiona** per aggiungere scontrini.

---

## Modello dati

I dati vivono in due posti:

| Cosa | Dove | Perché |
| --- | --- | --- |
| `trips` (con immagini base64 inline) | IndexedDB (`receipt-tracker` → `kv` → `receipt-tracker-trips`) | Le immagini possono superare i limiti di localStorage |
| `settings` (API key, PIN hash, preferenze) | localStorage (`receipt-tracker-settings`) | Piccolo, va letto sincrono al boot per il lock screen |
| Cache modelli OpenRouter | localStorage (`receipt-tracker-models`) | Lista invalidabile via "Aggiorna" nel picker |

Migrazione automatica da localStorage→IndexedDB al primo avvio dopo l'update.

---

## Sicurezza

- **PIN**: hashato con PBKDF2-SHA256 a 150.000 iterazioni con salt random a 16 byte. I PIN preesistenti (SHA-256 singolo) vengono migrati a PBKDF2 in modo trasparente al primo sblocco.
- **Lockout**: dopo 5 tentativi falliti il PIN è bloccato per 30 secondi, raddoppiando ad ogni gruppo successivo.
- **Biometria**: WebAuthn (browser) o `@aparajita/capacitor-biometric-auth` (Android). Sul nativo non c'è binding con keystore: chiunque passi il prompt biometrico dell'OS sblocca l'app.
- **API key**: salvata in chiaro in localStorage. Per un irrobustimento serio su mobile, considerare `@capacitor-community/secure-storage-plugin` (Android Keystore / iOS Keychain).
- **Immagini**: salvate in IndexedDB in chiaro. La cifratura at-rest non è implementata di default.

---

## Architettura

```text
src/
├── App.jsx                  Stato top-level, orchestrazione scansione e modali
├── main.jsx                 Entry React + ErrorBoundary
├── constants.js             Categorie, tipi doc, prompt OpenRouter, default
├── api/openRouter.js        Chiamate OpenRouter (con retry + timeout) e parsing
├── context/AppContext.jsx   trips/settings/lock state + persistenza IDB/LS
├── hooks/useToasts.jsx      Toast notifications
├── platform/
│   ├── camera.js            Astrazione picker immagini (web file input vs Capacitor)
│   ├── biometric.js         WebAuthn / Capacitor BiometricAuth
│   └── backButton.js        Hardware back Android
├── utils/
│   ├── backup.js            Export/import JSON dei dati utente
│   ├── expenseLogic.js      Dedup, merge, warning, regole documenti
│   ├── export.js            CSV / riepilogo trasferta
│   ├── formatters.js        Date, moneta, plurali
│   ├── idbStorage.js        Wrapper IndexedDB
│   ├── image.js             Resize + EXIF orientation
│   ├── security.js          PBKDF2, hash PIN, base64-url
│   └── storage.js           localStorage safe wrapper
├── views/                   Schermate principali
└── components/              UI condivisa, modali, layout
```

---

## Limitazioni note

- **Niente sync multi-device**: l'app è single-device. Usa Export/Import per migrare manualmente.
- **Niente offline scan**: la scansione richiede una chiamata a OpenRouter, quindi serve rete.
- **Niente backend**: la API key OpenRouter è dell'utente.
- **Solo italiano**: stringhe hard-coded.

---

## Licenza

Vedi `LICENSE` nel repo (se presente).
