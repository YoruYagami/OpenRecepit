import React, { useState, useEffect, useRef } from "react";
import { useAppContext } from "../context/AppContext.jsx";
import {
  APP_VERSION,
  DEFAULT_LIMITS,
  CATEGORY_IDS,
  CATEGORIES,
  MODELS,
  STORAGE_TRIPS_RESCUE,
} from "../constants.js";
import {
  fetchOpenRouterModels,
  validateOpenRouterKey,
  isVisionModel,
  modelDisplayName,
} from "../api/openRouter.js";
import { hashPin, randomSalt, PIN_ALGO_PBKDF2 } from "../utils/security.js";
import { isBiometricAvailable, registerBiometric } from "../platform/biometric.js";
import { safeLoad, safeSave } from "../utils/storage.js";
import { exportBackup, parseBackup, readFileAsText, summarizeBackup } from "../utils/backup.js";
import { migrateTrips } from "../utils/migrate.js";
import {
  inlineTripImages,
  externalizeTripImages,
  stripTripImages,
} from "../utils/imageStore.js";
import { idbGet, idbSet, idbDelete } from "../utils/idbStorage.js";
import { useModalDialog } from "../hooks/useModalDialog.js";
import { PrimaryButton, GhostButton } from "../components/ui/Button.jsx";
import { Field, TextInput } from "../components/ui/Input.jsx";
import { Spinner } from "../components/ui/Spinner.jsx";
import { Icon } from "../components/ui/Icon.jsx";

function ValidationDetails({ info }) {
  if (!info) return null;
  const parts = [];
  if (info.label) parts.push(info.label);
  if (typeof info.usage === "number") parts.push(`speso $${info.usage.toFixed(2)}`);
  if (typeof info.limit === "number" && info.limit > 0)
    parts.push(`limite $${info.limit.toFixed(2)}`);
  if (info.is_free_tier) parts.push("free tier");
  if (parts.length === 0) return null;
  return <p className="text-xs text-ok/90">{parts.join(" · ")}</p>;
}

function ModelRow({ model, selected, onSelect }) {
  const ctx = model.context_length
    ? model.context_length >= 1000
      ? `${Math.round(model.context_length / 1000)}K ctx`
      : `${model.context_length} ctx`
    : "";
  const inP = model.pricing?.prompt != null ? parseFloat(model.pricing.prompt) * 1e6 : null;
  const outP =
    model.pricing?.completion != null ? parseFloat(model.pricing.completion) * 1e6 : null;
  let priceText = "";
  if (inP != null && outP != null) {
    if (inP === 0 && outP === 0) priceText = "gratis";
    else priceText = `$${inP.toFixed(2)} / $${outP.toFixed(2)} per M tok`;
  }
  const vision = isVisionModel(model);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-2xl p-3 border transition active:scale-[0.99] ${
        selected ? "border-ink bg-ink/5" : "border-line bg-surface hover:bg-surface-2/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink truncate">{model.name || model.id}</p>
          <p className="text-[11px] font-mono text-ink/50 truncate">{model.id}</p>
        </div>
        {selected && <span className="text-ok shrink-0 mt-0.5">✓</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
        {vision && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink/70 bg-surface-2 rounded-full px-2 py-0.5">
            vision
          </span>
        )}
        {ctx && <span className="text-xs text-ink/50">{ctx}</span>}
        {priceText && <span className="text-xs text-ink/50 font-mono">{priceText}</span>}
      </div>
    </button>
  );
}

function ModelPicker({ open, models, loading, error, selectedId, onSelect, onClose, onRefresh }) {
  const dialogRef = useModalDialog({ open, onClose });
  const [search, setSearch] = useState("");
  const [visionOnly, setVisionOnly] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const list = (models || [])
    .filter((m) => {
      if (visionOnly && !isVisionModel(m)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.id.toLowerCase().includes(q) ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;
      return (a.name || a.id).localeCompare(b.name || b.id);
    });

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      className="absolute inset-0 z-40 bg-paper flex flex-col fade-in"
    >
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="w-9 h-9 rounded-full hover:bg-surface-2 grid place-items-center text-ink/60"
        >
          <Icon name="x" className="w-5 h-5" />
        </button>
        <h3 className="font-extrabold text-lg text-ink">Scegli modello</h3>
      </div>
      <div className="px-5 pb-3 flex flex-col gap-3 border-b border-line">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o ID…"
            className="w-full h-12 pl-10 pr-10 rounded-xl bg-surface border border-line text-ink placeholder:text-ink/45 focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
          <Icon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Cancella ricerca"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-surface-2 grid place-items-center text-ink/50"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setVisionOnly((v) => !v)}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-full text-xs font-semibold border active:scale-95 transition ${visionOnly ? "bg-ink text-paper border-ink" : "bg-surface text-ink/70 border-line-strong"}`}
          >
            <span>{visionOnly ? "✓" : ""}</span>
            <span>Solo modelli vision</span>
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-xs font-semibold text-ink/60 px-2 py-1 rounded-md hover:bg-surface-2 inline-flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? <Spinner className="w-3.5 h-3.5" /> : <Icon name="refresh" className="w-3.5 h-3.5" />}
            <span>{loading ? "Aggiorno…" : "Aggiorna"}</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {error && !models?.length && (
          <div className="rounded-xl bg-danger-soft border border-danger-line px-4 py-3 text-sm text-danger mb-3">
            {error}
          </div>
        )}
        {!loading && list.length === 0 && !error && (
          <div className="text-center py-12 text-ink/50 text-sm">
            <div className="text-3xl mb-2">🔎</div>Nessun modello trovato.
          </div>
        )}
        <div className="flex flex-col gap-2">
          {list.map((m) => (
            <ModelRow
              key={m.id}
              model={m}
              selected={m.id === selectedId}
              onSelect={() => onSelect(m.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeSection() {
  const { settings, setSettings } = useAppContext();
  return (
    <section className="bg-surface rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">Aspetto</h3>
        <p className="text-xs text-ink/50 mt-0.5">Scegli il tema dell'applicazione.</p>
      </div>
      <div className="flex bg-surface-2 p-1 rounded-xl">
        {[
          { id: "light", label: "Chiaro", icon: "sun" },
          { id: "dark", label: "Scuro", icon: "moon" },
          { id: "auto", label: "Sistema", icon: "monitor" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSettings({ theme: t.id })}
            className={`flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${settings.theme === t.id ? "bg-surface text-ink shadow-sm" : "text-ink/60 hover:text-ink/80 hover:bg-surface-2/50"}`}
          >
            <Icon name={t.icon} className="w-4 h-4" /> <span>{t.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// New PINs are always 6 digits; existing 4-digit PINs keep working until reset.
const PIN_LENGTH = 6;

function SecuritySection({ askConfirm }) {
  const { settings, setSettings, toast } = useAppContext();
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const pinLength = PIN_LENGTH;
  const [bioAvailable, setBioAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  const pinValid = (s) => /^\d+$/.test(s) && s.length === pinLength;

  const enablePin = async () => {
    if (!pinValid(pin1)) return toast(`Il PIN deve essere di ${pinLength} cifre`, "error");
    if (pin1 !== pin2) return toast("I due PIN non coincidono", "error");
    setBusy(true);
    try {
      const salt = randomSalt();
      const hash = await hashPin(pin1, salt);
      setSettings({
        pinEnabled: true,
        pinSalt: salt,
        pinHash: hash,
        pinAlgo: PIN_ALGO_PBKDF2,
        pinLength,
      });
      setPin1("");
      setPin2("");
      toast("PIN attivato", "success");
    } finally {
      setBusy(false);
    }
  };

  const disablePin = () => {
    askConfirm({
      title: "Disabilitare il PIN?",
      message: "L'app non sarà più protetta da PIN o biometrico.",
      danger: true,
      confirmLabel: "Disabilita",
      onConfirm: () => {
        setSettings({
          pinEnabled: false,
          pinHash: null,
          pinSalt: null,
          pinAlgo: null,
          biometricEnabled: false,
          biometricCredId: null,
        });
        askConfirm(null);
        toast("PIN disabilitato");
      },
    });
  };

  const enableBiometric = async () => {
    setBusy(true);
    try {
      const credId = await registerBiometric();
      setSettings({ biometricEnabled: true, biometricCredId: credId });
      toast("Sblocco biometrico attivato", "success");
    } catch (e) {
      toast(e?.message || "Impossibile registrare il biometrico", "error");
    } finally {
      setBusy(false);
    }
  };

  const disableBiometric = () => {
    setSettings({ biometricEnabled: false, biometricCredId: null });
    toast("Biometrico disattivato");
  };

  return (
    <section className="bg-surface rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">Sicurezza</h3>
        <p className="text-xs text-ink/50 mt-0.5">Proteggi l'app con PIN e sblocco biometrico.</p>
      </div>
      {settings.pinEnabled ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ok-soft border border-ok-line px-4 py-3">
            <div>
              <p className="font-bold text-ok text-sm flex items-center gap-1.5">
                <Icon name="lock" className="w-4 h-4" /> PIN attivo
              </p>
              <p className="text-xs text-ok/80">
                Lunghezza: {settings.pinLength || 6} cifre
              </p>
            </div>
            <button
              onClick={disablePin}
              className="h-9 px-3 rounded-lg bg-surface text-danger border border-danger-line text-xs font-semibold active:scale-95"
            >
              Disabilita
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2/50 px-4 py-3">
            <div className="min-w-0">
              <p className="font-bold text-ink text-sm flex items-center gap-1.5">
                <Icon name="fingerprint" className="w-4 h-4" /> Sblocco biometrico
              </p>
              <p className="text-xs text-ink/60">
                {!bioAvailable
                  ? "Non disponibile"
                  : settings.biometricEnabled
                    ? "Attivo"
                    : "Attiva per sbloccare"}
              </p>
            </div>
            <button
              disabled={!bioAvailable || busy}
              onClick={settings.biometricEnabled ? disableBiometric : enableBiometric}
              className={`h-9 px-3 rounded-lg text-xs font-semibold active:scale-95 disabled:opacity-30 ${settings.biometricEnabled ? "bg-surface text-ink border border-line-strong" : "bg-ink text-paper"}`}
            >
              {settings.biometricEnabled ? "Disattiva" : "Attiva"}
            </button>
          </div>
        </>
      ) : (
        <>
          <Field label="Nuovo PIN (6 cifre)">
            <TextInput
              type="password"
              inputMode="numeric"
              maxLength={pinLength}
              value={pin1}
              onChange={(e) => setPin1(e.target.value.replace(/\D/g, "").slice(0, pinLength))}
            />
          </Field>
          <Field label="Conferma PIN">
            <TextInput
              type="password"
              inputMode="numeric"
              maxLength={pinLength}
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, pinLength))}
            />
          </Field>
          <PrimaryButton onClick={enablePin} disabled={busy || !pinValid(pin1) || pin1 !== pin2}>
            Attiva PIN
          </PrimaryButton>
        </>
      )}
    </section>
  );
}

function LimitsSection() {
  const { settings, setSettings, toast } = useAppContext();
  const limits = settings.expenseLimits || DEFAULT_LIMITS;

  const setLimit = (cat, value) => {
    const num = Math.max(0, parseFloat(String(value).replace(",", ".")) || 0);
    setSettings({ expenseLimits: { ...limits, [cat]: num } });
  };

  const reset = () => {
    setSettings({ expenseLimits: { ...DEFAULT_LIMITS } });
    toast("Limiti ripristinati");
  };

  return (
    <section className="bg-surface rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">
            Limiti di rimborso
          </h3>
          <p className="text-xs text-ink/50 mt-0.5">Soglie per categoria.</p>
        </div>
        <button
          onClick={reset}
          className="text-xs font-semibold text-ink/60 px-2 py-1 rounded-md hover:bg-surface-2 shrink-0"
        >
          Ripristina
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {CATEGORY_IDS.map((cat) => {
          const c = CATEGORIES[cat];
          const value = limits[cat] ?? 0;
          return (
            <div key={cat} className="flex items-center gap-3">
              <div
                className="cat-tint shrink-0 w-9 h-9 rounded-lg grid place-items-center text-base"
                style={{ "--cat": c.color }}
              >
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{c.label}</p>
                {!value && <p className="text-[11px] text-ink/55 italic">Nessun limite</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="relative w-24">
                  <TextInput
                    type="number"
                    step="1"
                    min="0"
                    inputMode="decimal"
                    value={value || ""}
                    placeholder="—"
                    onChange={(e) => setLimit(cat, e.target.value)}
                    className={`w-full font-mono text-right pr-7 h-10 ${!value ? "text-ink/40 placeholder:text-ink/30" : "text-ink"}`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40 font-mono">
                    €
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLimit(cat, 0)}
                  disabled={!value}
                  aria-label="Azzera limite"
                  className="w-8 h-8 rounded-full grid place-items-center text-ink/40 hover:bg-surface-2 active:scale-90 transition disabled:opacity-0 disabled:pointer-events-none"
                >
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BackupSection({ askConfirm }) {
  const { trips, setTrips, settings, setSettings, toast } = useAppContext();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  // Snapshot taken before the last destructive restore, so an accidental import
  // can be undone from the UI (not just via devtools).
  const [rescue, setRescue] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);

  useEffect(() => {
    idbGet(STORAGE_TRIPS_RESCUE)
      .then((snap) => {
        if (snap && Array.isArray(snap.trips)) setRescue(snap);
      })
      .catch(() => {});
    try {
      navigator.storage
        ?.estimate?.()
        .then(setStorageInfo)
        .catch(() => {});
    } catch {
      /* not supported */
    }
  }, []);

  const onRestoreRescue = () => {
    if (!rescue) return;
    askConfirm({
      title: "Annullare l'ultimo ripristino?",
      message: `Ripristina le ${rescue.trips.length} trasfert${rescue.trips.length === 1 ? "a" : "e"} presenti prima dell'ultimo import${rescue.savedAt ? ` (salvate il ${new Date(rescue.savedAt).toLocaleString("it-IT")})` : ""}. I dati attuali verranno sostituiti.`,
      danger: true,
      confirmLabel: "Annulla ripristino",
      onConfirm: async () => {
        setTrips(await externalizeTripImages(migrateTrips(rescue.trips)));
        try {
          await idbDelete(STORAGE_TRIPS_RESCUE);
        } catch {
          /* best-effort */
        }
        setRescue(null);
        askConfirm(null);
        toast("Dati precedenti ripristinati", "success");
      },
    });
  };

  const onExport = async () => {
    setBusy(true);
    try {
      // Re-inline stored images so the backup file is self-contained.
      const inlined = await inlineTripImages(trips);
      const { filename, count, canceled } = await exportBackup({ trips: inlined, settings });
      if (!canceled) toast(`Backup esportato (${count} trasferte) → ${filename}`, "success");
    } catch (e) {
      toast(e?.message || "Export fallito", "error");
    } finally {
      setBusy(false);
    }
  };

  // Small, durable data-only backup (no photos) — handy for email/cloud sync.
  const onExportLight = async () => {
    setBusy(true);
    try {
      const { filename, count, canceled } = await exportBackup({
        trips: stripTripImages(trips),
        settings,
        filenameSuffix: "-dati",
      });
      if (!canceled)
        toast(`Backup dati esportato (${count} trasferte) → ${filename}`, "success");
    } catch (e) {
      toast(e?.message || "Export fallito", "error");
    } finally {
      setBusy(false);
    }
  };

  const onImportClick = () => fileRef.current?.click();

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const text = await readFileAsText(file);
      const parsed = parseBackup(text);
      const { tripCount, expenseCount, exportedAt } = summarizeBackup(parsed);
      askConfirm({
        title: "Ripristinare il backup?",
        message: `Trovate ${tripCount} trasfert${tripCount === 1 ? "a" : "e"} con ${expenseCount} spes${expenseCount === 1 ? "a" : "e"}${exportedAt ? ` (esportato il ${new Date(exportedAt).toLocaleDateString("it-IT")})` : ""}. Le tue trasferte attuali verranno sostituite. Continuare?`,
        danger: true,
        confirmLabel: "Ripristina",
        onConfirm: async () => {
          // Rescue snapshot so a wrong/older backup isn't irrecoverable.
          if (trips.length > 0) {
            const snap = { savedAt: new Date().toISOString(), trips };
            try {
              await idbSet(STORAGE_TRIPS_RESCUE, snap);
              setRescue(snap); // surface the in-app "undo restore" affordance
            } catch {
              /* snapshot is best-effort */
            }
          }
          // migrateTrips normalizes the (already shape-validated) imported
          // trips; embedded images move straight into the image store.
          setTrips(await externalizeTripImages(migrateTrips(parsed.trips)));
          if (parsed.settings && Object.keys(parsed.settings).length > 0) {
            // Deep-merge per-category limits so a sparse backup doesn't wipe
            // categories the user had configured; everything else replaces.
            const next = { ...parsed.settings };
            if (next.expenseLimits) {
              next.expenseLimits = { ...settings.expenseLimits, ...next.expenseLimits };
            }
            setSettings(next);
          }
          askConfirm(null);
          toast(`Backup ripristinato: ${tripCount} trasferte`, "success");
        },
      });
    } catch (err) {
      toast(err?.message || "Import fallito", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-surface rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">Backup</h3>
        <p className="text-xs text-ink/50 mt-0.5">
          Esporta o ripristina trasferte e preferenze. La API key e i dati di sicurezza non vengono
          inclusi.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={onExport}
          disabled={busy || trips.length === 0}
          className="h-11 rounded-xl bg-surface border border-line-strong shadow-soft text-sm font-semibold text-ink active:scale-[0.98] disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          <Icon name="download" className="w-4 h-4" /> Esporta backup
        </button>
        <button
          onClick={onImportClick}
          disabled={busy}
          className="h-11 rounded-xl bg-surface border border-line-strong shadow-soft text-sm font-semibold text-ink active:scale-[0.98] disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          <Icon name="upload" className="w-4 h-4" /> Ripristina backup
        </button>
      </div>
      <button
        onClick={onExportLight}
        disabled={busy || trips.length === 0}
        className="h-10 rounded-xl bg-surface border border-line-strong shadow-soft text-xs font-semibold text-ink/70 active:scale-[0.98] disabled:opacity-40 inline-flex items-center justify-center gap-2"
      >
        <Icon name="fileText" className="w-4 h-4" /> Esporta solo dati (senza foto, file leggero)
      </button>
      {storageInfo?.usage != null && (
        <p className="text-[11px] text-ink/50">
          Spazio usato dall'app: {(storageInfo.usage / 1048576).toFixed(1)} MB
          {storageInfo.quota
            ? ` su ~${(storageInfo.quota / 1073741824).toFixed(1)} GB disponibili`
            : ""}
        </p>
      )}
      {rescue && (
        <button
          onClick={onRestoreRescue}
          disabled={busy}
          className="h-10 rounded-xl bg-warn-soft border border-warn-line text-xs font-semibold text-warn active:scale-[0.98] disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          <Icon name="undo" className="w-4 h-4" /> Annulla ultimo ripristino ({rescue.trips.length} trasfert
          {rescue.trips.length === 1 ? "a" : "e"})
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFileChosen}
      />
    </section>
  );
}

export function SettingsView({ askConfirm }) {
  const { settings, setSettings, toast } = useAppContext();
  const [apiKey, setApiKey] = useState(settings.apiKey || "");
  const [model, setModel] = useState(settings.model || MODELS[0].id);
  const [showKey, setShowKey] = useState(false);
  const [validation, setValidation] = useState({ status: "idle", error: "", info: null });
  const [models, setModels] = useState(
    () => safeLoad("receipt-tracker-models", null)?.list || null
  );
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setApiKey(settings.apiKey || "");
    setModel(settings.model || MODELS[0].id);
  }, [settings.apiKey, settings.model]);
  useEffect(() => {
    if (!models) loadModels(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadModels(force) {
    setModelsLoading(true);
    setModelsError("");
    try {
      const list = await fetchOpenRouterModels(apiKey || "");
      setModels(list);
      safeSave("receipt-tracker-models", { list, fetchedAt: Date.now() });
      if (force) toast(`${list.length} modelli caricati`, "success");
    } catch (e) {
      setModelsError(e?.message || "Impossibile caricare i modelli");
    } finally {
      setModelsLoading(false);
    }
  }

  async function checkApiKey() {
    const key = apiKey.trim();
    if (!key) return toast("Inserisci prima la API key", "error");
    setValidation({ status: "checking", error: "", info: null });
    try {
      const info = await validateOpenRouterKey(key);
      setValidation({ status: "valid", error: "", info });
      loadModels(false);
    } catch (e) {
      setValidation({ status: "invalid", error: e?.message || "Verifica fallita", info: null });
    }
  }

  const onSaveApi = () => {
    setSettings({ apiKey: apiKey.trim(), model });
    toast("Impostazioni salvate", "success");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const onClearKey = () => {
    setApiKey("");
    setSettings({ apiKey: "", model });
    setValidation({ status: "idle", error: "", info: null });
    toast("API key rimossa");
  };

  const sections = [
    ["api", "OpenRouter"],
    ["aspetto", "Aspetto"],
    ["sicurezza", "Sicurezza"],
    ["limiti", "Limiti"],
    ["backup", "Backup"],
  ];
  const scrollToSection = (key) =>
    document.getElementById(`settings-${key}`)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="px-5 pb-6 pt-2 fade-in flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-extrabold text-ink mb-1">Impostazioni</h2>
        <p className="text-sm text-ink/60">Configura l'app, la sicurezza e le regole.</p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 -mt-1">
        {sections.map(([key, label]) => (
          <button
            key={key}
            onClick={() => scrollToSection(key)}
            className="shrink-0 h-8 px-3 rounded-full bg-surface-2 text-xs font-semibold text-ink/70 hover:text-ink active:scale-95 transition"
          >
            {label}
          </button>
        ))}
      </div>
      <section
        id="settings-api"
        className="bg-surface rounded-2xl shadow-soft p-5 flex flex-col gap-5 scroll-mt-6"
      >
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">OpenRouter</h3>
        <div className="rounded-xl bg-warn-soft border border-warn-line px-4 py-3 text-xs text-warn leading-relaxed">
          ⓘ Le immagini degli scontrini vengono inviate a OpenRouter e al provider del modello
          scelto per l'analisi. Possono contenere dati personali e di pagamento (esercente, importi,
          ultime cifre della carta). Sul dispositivo restano solo i dati salvati.{" "}
          <a
            href="https://openrouter.ai/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
          >
            Informativa privacy OpenRouter
          </a>
          .
        </div>
        <Field label="API key">
          <div className="relative">
            <TextInput
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-or-v1-…"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setValidation({ status: "idle", error: "", info: null });
              }}
              className="w-full pr-20"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink/60 px-2 py-1 rounded-md hover:bg-surface-2"
            >
              {showKey ? "Nascondi" : "Mostra"}
            </button>
          </div>
        </Field>
        <button
          onClick={checkApiKey}
          disabled={!apiKey.trim() || validation.status === "checking"}
          className="h-11 rounded-xl bg-surface border border-line-strong shadow-soft text-sm font-semibold text-ink active:scale-[0.98] disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {validation.status === "checking" ? (
            <>
              <Spinner className="w-4 h-4" /> Verifica in corso…
            </>
          ) : (
            <>
              <Icon name="key" className="w-4 h-4" /> Verifica API key
            </>
          )}
        </button>
        {validation.status === "valid" && (
          <div className="rounded-xl bg-ok-soft border border-ok-line px-4 py-3 text-sm text-ok flex items-start gap-2">
            <span className="shrink-0">✓</span>
            <div className="min-w-0">
              <p className="font-semibold">API key valida</p>
              <ValidationDetails info={validation.info} />
            </div>
          </div>
        )}
        {validation.status === "invalid" && (
          <div className="rounded-xl bg-danger-soft border border-danger-line px-4 py-3 text-sm text-danger flex items-start gap-2">
            <span className="shrink-0">✗</span>
            <div className="min-w-0">
              <p className="font-semibold">Verifica fallita</p>
              <p className="text-xs text-danger/90 break-words">{validation.error}</p>
            </div>
          </div>
        )}
        <Field
          label="Modello vision"
          hint={models ? `${models.length} modelli disponibili` : "Caricamento modelli…"}
        >
          <button
            onClick={() => setPickerOpen(true)}
            className="h-12 px-4 rounded-xl bg-surface border border-line-strong text-left flex items-center justify-between gap-2 hover:bg-surface-2/50 active:scale-[0.99] transition"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink truncate">{modelDisplayName(model, models)}</p>
              <p className="text-[11px] text-ink/50 font-mono truncate">{model}</p>
            </div>
            <span className="text-ink/40 shrink-0">›</span>
          </button>
          {modelsError && !models && <p className="text-xs text-danger mt-1">{modelsError}</p>}
        </Field>
        <div className="flex gap-2 pt-1">
          <PrimaryButton
            className={`flex-1 transition-colors ${savedFlash ? "!bg-ok-solid" : ""}`}
            onClick={onSaveApi}
          >
            {savedFlash ? "✓ Salvato" : "Salva"}
          </PrimaryButton>
          {apiKey && <GhostButton onClick={onClearKey}>Rimuovi key</GhostButton>}
        </div>
      </section>
      <ModelPicker
        open={pickerOpen}
        models={models}
        loading={modelsLoading}
        error={modelsError}
        selectedId={model}
        onSelect={(id) => {
          setModel(id);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
        onRefresh={() => loadModels(true)}
      />
      <div id="settings-aspetto" className="scroll-mt-6">
        <ThemeSection />
      </div>
      <div id="settings-sicurezza" className="scroll-mt-6">
        <SecuritySection askConfirm={askConfirm} />
      </div>
      <div id="settings-limiti" className="scroll-mt-6">
        <LimitsSection />
      </div>
      <div id="settings-backup" className="scroll-mt-6">
        <BackupSection askConfirm={askConfirm} />
      </div>
      <p className="text-center text-[11px] text-ink/40 pb-1">
        Scontrini Trasferta v{APP_VERSION} · dati salvati solo sul dispositivo
      </p>
    </div>
  );
}
