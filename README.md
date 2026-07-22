# OpenRecepit

App **local-first** per registrare gli scontrini delle trasferte di lavoro: fotografi lo scontrino, l'AI compila esercente, importo, data e categoria, tu confermi. Tutto resta sul dispositivo — niente account, niente backend, niente sync.

**Unica eccezione:** la scansione invia l'immagine a [OpenRouter](https://openrouter.ai) (e al provider del modello vision scelto) per l'analisi — vedi [Privacy](#privacy). Senza API key l'app funziona comunque con l'inserimento manuale.

Disponibile come **PWA installabile** (browser desktop e mobile) e come **APK Android** (wrapper Capacitor).

---

## Funzionalità

**Spese**
- Trasferte multiple con totali per valuta (es. `120,50 € + 45,00 USD`)
- Scansione da fotocamera o galleria con riconoscimento automatico (esercente, importo, data, ora, categoria); analisi in parallelo per i batch
- Inserimento manuale senza foto e senza API key
- Rilevamento duplicati per hash immagine e per contenuto (stessa data/importo/esercente)
- Allegati extra per spesa: foto e **PDF** (es. ricevuta Revolut), analizzabili con l'AI
- **Share target Android**: condividi un PDF/immagine da un'altra app → analisi AI con aggancio automatico alla spesa corrispondente, oppure allega a una spesa esistente
- Filtri per categoria e ricerca testuale nel dettaglio trasferta
- Avvisi non bloccanti: sopra il limite di rimborso, data fuori trasferta, importo a zero
- Eliminazione con **Annulla** (undo) invece di dialog di conferma

**Export e backup**
- CSV con BOM UTF-8 (compatibile Excel) e riepilogo testuale per categoria
- Backup JSON completo (con foto) o solo dati; ripristino con snapshot di sicurezza annullabile

**Esperienza**
- Onboarding al primo avvio; skeleton loading; banner offline
- **Navigazione con history**: il tasto back di Android chiude overlay e viste nell'ordine giusto, il refresh ripristina la posizione
- Dark mode nativa (design token semantici), icone SVG, font self-hosted: rendering identico anche offline e nell'APK
- Interfaccia in italiano

**Sicurezza**
- PIN a 6 cifre (PBKDF2-SHA256, 150k iterazioni) con lockout progressivo
- Sblocco biometrico: nativo nell'APK (BiometricPrompt), WebAuthn su web/PWA

---

## Sviluppo

Richiede Node.js 18+ e npm.

```bash
npm install
npm run dev          # dev server su http://localhost:5173

npm run test         # unit test (Vitest)
npm run lint         # ESLint
npm run format       # Prettier

npm run build        # build di produzione in dist/
npm run preview      # serve dist/ per verifica locale
```

---

## Build APK Android (Capacitor)

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug        # APK di test → app/build/outputs/apk/debug/
```

### Release firmata

1. Genera una keystore (una sola volta):
   ```bash
   keytool -genkey -v -keystore android/release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. Copia `android/keystore.properties.example` in `android/keystore.properties` e compila le password (file gitignorato).
3. `cd android && ./gradlew assembleRelease` → APK firmata in `app/build/outputs/apk/release/`.

**Versioni**: aggiorna insieme `package.json` (`version`), `APP_VERSION` in `src/constants.js` e `versionCode`/`versionName` in `android/app/build.gradle`.

---

## Primo utilizzo

1. Al primo avvio l'onboarding guida la configurazione (skippabile).
2. Per la scansione AI: **Impostazioni → OpenRouter**, inserisci una API key (`sk-or-v1-…`, si crea su [openrouter.ai/keys](https://openrouter.ai/keys)), verifica e scegli un modello vision (consigliati: Gemini 2.5 Flash, GPT-4o-mini, Claude Sonnet).
3. Crea una trasferta e aggiungi spese con **Scatta**, **Carica** o **Manuale**.
4. (Opzionale) PIN e biometria in **Impostazioni → Sicurezza**.

---

## Architettura

```text
src/
├── main.jsx                     Entry: fonts, ErrorBoundary, service worker PWA
├── App.jsx                      Composizione: provider, viste, overlay host
├── constants.js                 Categorie, prompt OpenRouter, default, versione
├── api/openRouter.js            Chiamate API (retry/timeout/abort) + parsing risposta
├── context/AppContext.jsx       Stato trips/settings/lock + persistenza (IDB/LS, debounce+flush)
├── navigation/
│   ├── historyStack.js          Modello puro delle entry history (unit-testato)
│   ├── NavProvider.jsx          Reconciler popstate, stack overlay, guardie/veto
│   └── OverlayHost.jsx          Renderizza lo stack overlay (confirm/form/lightbox/coda)
├── hooks/
│   ├── useScanQueue.js          Pipeline scansione: intake → analisi concorrente → conferma
│   ├── useExpenseActions.js     CRUD spese (undo-delete, manuale, allegati)
│   ├── useReanalyze.js          Rianalisi singola/trip con abort su navigazione
│   ├── useTripActions.js        Crea/modifica/elimina trasferta
│   ├── useConfirm.js            confirm() promise-based sullo stack overlay
│   ├── useFilePicker.jsx        Input camera/galleria promise-based
│   ├── useModalDialog.js        Focus trap + Escape per i dialog
│   └── useToasts.jsx            Toast con azione (undo)
├── utils/
│   ├── imageStore.js            Foto full-res in record IDB separati + GC orfani
│   ├── expenseImages.js         Costruzione spese da coda, load/store immagini
│   ├── expenseLogic.js          Duplicati, warning, totali per valuta
│   ├── backup.js                Export/import JSON (allowlist settings)
│   ├── export.js                CSV / riepilogo
│   ├── migrate.js               Migrazioni versionate + normalizzazione settings
│   ├── idbStorage.js            Wrapper IndexedDB
│   ├── security.js              PBKDF2, base64url
│   └── image.js / file.js / formatters.js / storage.js
├── platform/biometric.js        WebAuthn
├── views/                       TripsList, TripDetail, ScanQueue, ScanLauncher, Settings
└── components/                  Overlay/dialog, layout (tab bar, lock, onboarding), UI base
```

### Modello dati

| Cosa | Dove | Note |
| --- | --- | --- |
| Trasferte e spese (metadati + thumbnail) | IndexedDB `receipt-tracker-trips` | Scritture debounced con flush su pagehide |
| Foto full-res | IndexedDB, record separati `img:<id>` | Referenziate via `fullRef`; garbage collection all'avvio |
| Snapshot pre-ripristino | IndexedDB `receipt-tracker-trips-rescue` | Rende annullabile l'import di un backup |
| Settings (API key, PIN hash, preferenze) | localStorage `receipt-tracker-settings` | Lettura sincrona al boot per il lock screen |
| Cache modelli OpenRouter | localStorage `receipt-tracker-models` | Aggiornabile dal picker |

I dati di versioni precedenti (immagini inline, localStorage) vengono migrati automaticamente al primo avvio.

---

## Sicurezza

- **PIN**: PBKDF2-SHA256 a 150.000 iterazioni, salt random 16 byte; i vecchi hash SHA-256 vengono migrati al primo sblocco. Lockout: 30s dopo 5 errori, raddoppia a ogni gruppo.
- **Il PIN è un blocco UI, non cifratura**: protegge dall'accesso occasionale, non da chi ha accesso ai file del profilo. "PIN dimenticato?" sblocca senza perdere dati.
- **API key e immagini** sono salvate in chiaro nello storage del browser/app.
- **Biometria**: BiometricPrompt nativo nell'APK; WebAuthn su web/PWA (richiede HTTPS o localhost).

## Privacy

Le immagini scansionate **lasciano il dispositivo** solo verso OpenRouter e il provider del modello scelto, per l'estrazione dei dati. Uno scontrino può contenere dati personali e di pagamento (esercente, importi, ultime cifre carta, IBAN). L'avviso è mostrato in Impostazioni; vedi l'[informativa OpenRouter](https://openrouter.ai/privacy). Tutto il resto resta locale.

## Limitazioni note

- Nessun sync multi-device (usa Export/Import per migrare)
- La scansione richiede rete (l'inserimento manuale no)
- Interfaccia solo in italiano
