# OpenRecepit vs N2F — Piano competitivo

> Obiettivo: competere con N2F sul segmento **individui, freelance/P.IVA e micro-team**
> mantenendo l'anima di OpenRecepit: **local-first, zero abbonamento, zero attriti**.
> N2F vince sulle aziende strutturate (workflow, carte, compliance); noi vinciamo su
> privacy, costo, velocità e proprietà dei dati. Il piano colma i gap funzionali che
> contano per chi la nota spese la *compila e la invia*, non per chi la *approva*.

## Cosa fa N2F (mappa funzionale)

| Area | N2F | OpenRecepit oggi |
| --- | --- | --- |
| OCR scontrini | Importi, **IVA**, valuta, categoria, multi-paese | AI (modello a scelta): esercente, importo, data, ora, categoria — **niente IVA** |
| Nota spese come documento | Ciclo di vita: In corso → In approvazione → Approvata → Rimborsata | Trasferta = contenitore; export CSV/TXT, nessuno stato |
| Rimborsi chilometrici | Calcolo automatico con Google Maps + tariffe | ❌ Assente |
| Per diem / diarie | Indennità forfettarie configurabili | ❌ Assente |
| Valute | Conversione automatica, tassi del giorno, 170+ valute | Totali separati per valuta, nessuna conversione |
| IVA | Estrazione multi-aliquota per recupero IVA | ❌ Assente |
| Policy di spesa | Massimali, alert, rilevazione errori/duplicati | Limiti per categoria (warning), duplicati per hash+contenuto ✅ |
| Carte aziendali | Carte emesse + riconciliazione bancaria automatica | ❌ (fuori scope come emissione) |
| Export contabile | 300+ integrazioni ERP/contabilità | CSV generico |
| Conservazione | A norma, 10 anni | Backup JSON locale |
| Analytics | Dashboard, budget, N2F Intelligence | Totali per categoria/valuta |
| Multi-device | Sync cloud continua, web+mobile | Single-device + backup manuale |
| Offline | Solo cattura offline, poi sync | **Tutto offline** tranne l'analisi AI ✅ |
| Ricezione documenti | — | **Share target Android** (es. PDF da Revolut) ✅ |

## I nostri vantaggi strutturali (da difendere e comunicare)

1. **Privacy totale**: i dati non toccano mai un server nostro (N2F è SaaS cloud).
2. **Zero abbonamento**: N2F costa ~5–7 €/utente/mese; noi solo il costo API della propria key.
3. **AI di frontiera a scelta**: l'utente sceglie il modello (Gemini/GPT/Claude), sempre aggiornato — l'OCR proprietario di N2F no.
4. **Open source** e dati esportabili sempre.
5. **Share target nativo** già oggi (N2F non riceve file da altre app così).

---

## P0 — Parità funzionale essenziale

*(chiude i gap che un freelance/dipendente sente ogni settimana)*

### 1. Estrazione IVA (effort: S) — il gap più redditizio
- Prompt AI esteso: aliquota/e IVA, imponibile, totale imposta (multi-aliquota: 4/5/10/22%).
- Campi `iva` opzionali sulla spesa (editabili, mai bloccanti).
- Colonne IVA nel CSV + sezione "Riepilogo IVA" nel riepilogo → recupero IVA per il commercialista.

### 2. Rimborsi chilometrici (effort: M)
- Nuovo tipo di spesa "Chilometrica": da/a, km, tariffa €/km → importo calcolato.
- Tariffe configurabili con preset (es. tabelle ACI); percorsi frequenti memorizzati (casa→cliente X).
- **Niente Google Maps** (costo + privacy): km manuali + percorsi salvati; eventuale calcolo distanza opzionale via OpenRouteService con key dell'utente.

### 3. Nota spese come documento: stati + PDF professionale (effort: M) — il "killer feature"
- Stato trasferta: Bozza → Inviata → Rimborsata (con date); badge in lista.
- **Export PDF della nota spese**: intestazione (nome, periodo, ditta), tabella spese, totali per categoria/IVA/valuta, righe firma, e **giustificativi in appendice** (foto + PDF allegati, via pdf-lib client-side).
- È il sostituto single-user del workflow di approvazione: generi il documento perfetto da mandare ad azienda/commercialista.

### 4. Conversione valute (effort: S/M)
- Tasso di cambio del giorno della spesa via [frankfurter.app](https://www.frankfurter.app) (BCE, gratuito, senza key) con cache locale + override manuale.
- Totale unificato in EUR ovunque, con dettaglio "di cui X USD @ 1.08".

### 5. Per diem / diarie (effort: S)
- Tipo spesa "Diaria" con importi giornalieri configurabili (Italia/estero), moltiplicatore giorni.

## P1 — Differenzianti e produttività

6. **Dashboard** (effort: M): grafici locali per mese/categoria/trasferta, confronti, top esercenti.
7. **Import estratto conto CSV + riconciliazione** (effort: M): carichi il CSV della carta (Revolut/banca), match automatico con le spese per data+importo, evidenzia mancanti — la versione local-first della riconciliazione carte N2F.
8. **Memoria esercenti** (effort: S): categoria/descrizione proposte in base allo storico dell'esercente.
9. **Multi-foto per scontrino in coda** (effort: S): fronte/retro in un'unica spesa già in fase di scansione.
10. **Sync opzionale senza server nostro** (effort: L): export/import automatico crittografato su cartella cloud dell'utente (Drive/Nextcloud/WebDAV) → multi-device restando local-first.
11. **i18n EN** (effort: M): decisione da riaprire — per competere fuori dall'Italia è necessaria. *(Oggi deliberatamente solo IT.)*
12. **Export tracciati contabili italiani** (effort: S/M): formati CSV specifici (Fatture in Cloud, Danea, TeamSystem) al posto di "300 integrazioni".

## P2 — Ambizioni (cambiano la natura del progetto: decidere prima di investire)

13. **Micro-team / approvazioni**: richiede un backend. Strada coerente: server open-source **self-hosted** opzionale (sync + ruoli invia/approva) → "l'N2F open source". Scope grande, valutare solo con trazione.
14. **Integrità archivio**: niente conservazione a norma certificata (irraggiungibile senza ente certificato), ma export ZIP con hash/firma per dimostrare integrità.
15. **iOS**: Capacitor lo consente già; serve Mac + account developer.

## Cosa NON copiare (fuori scala, snaturano il prodotto)

- Emissione carte aziendali, multi-entità enterprise, marketplace di 300 integrazioni, conservazione certificata 10 anni, SSO/SAML.

## Ordine consigliato

`IVA → PDF nota spese + stati → Chilometrici → Valute → Diarie` (P0, ~2-3 sessioni di lavoro), poi P1 guidato dall'uso reale. Con il P0 completo, per un utente singolo OpenRecepit copre **tutto ciò che N2F fa per lui** — gratis e privato.
