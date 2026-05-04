import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import {
  DEFAULT_SETTINGS,
  DEFAULT_LIMITS,
  CATEGORY_IDS,
  CATEGORIES,
  DOC_TYPES,
} from '../constants.js';
import { fetchOpenRouterModels, validateOpenRouterKey, isVisionModel, modelDisplayName } from '../api/openRouter.js';
import { hashPin, randomSalt } from '../utils/security.js';
import { isBiometricAvailable, registerBiometric } from '../platform/biometric.js';
import { safeLoad, safeSave } from '../utils/storage.js';
import { PrimaryButton, GhostButton } from '../components/ui/Button.jsx';
import { Field, TextInput, SelectInput, ToggleInput } from '../components/ui/Input.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';

function ValidationDetails({ info }) {
  if (!info) return null;
  const parts = [];
  if (info.label) parts.push(info.label);
  if (typeof info.usage === "number") parts.push(`speso $${info.usage.toFixed(2)}`);
  if (typeof info.limit === "number" && info.limit > 0) parts.push(`limite $${info.limit.toFixed(2)}`);
  if (info.is_free_tier) parts.push("free tier");
  if (parts.length === 0) return null;
  return <p className="text-xs text-emerald-700/90">{parts.join(" · ")}</p>;
}

function ModelRow({ model, selected, onSelect }) {
  const ctx = model.context_length
    ? model.context_length >= 1000
      ? `${Math.round(model.context_length / 1000)}K ctx`
      : `${model.context_length} ctx`
    : "";
  const inP = model.pricing?.prompt != null ? parseFloat(model.pricing.prompt) * 1e6 : null;
  const outP = model.pricing?.completion != null ? parseFloat(model.pricing.completion) * 1e6 : null;
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
        selected ? "border-ink bg-ink/5" : "border-black/5 bg-white hover:bg-black/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink truncate">{model.name || model.id}</p>
          <p className="text-[11px] font-mono text-ink/50 truncate">{model.id}</p>
        </div>
        {selected && <span className="text-emerald-600 shrink-0 mt-0.5">✓</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
        {vision && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-purple-700 bg-purple-100 rounded-full px-2 py-0.5">
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
    <div className="absolute inset-0 z-40 bg-paper flex flex-col fade-in">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-black/5 grid place-items-center text-ink/60">✕</button>
        <h3 className="font-extrabold text-lg text-ink">Scegli modello</h3>
      </div>
      <div className="px-5 pb-3 flex flex-col gap-3 border-b border-black/5">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o ID…"
            className="w-full h-12 pl-10 pr-10 rounded-xl bg-white border border-black/5 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40">🔍</span>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-black/5 grid place-items-center text-ink/50">✕</button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setVisionOnly((v) => !v)}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-full text-xs font-semibold border active:scale-95 transition ${visionOnly ? "bg-ink text-white border-ink" : "bg-white text-ink/70 border-black/10"}`}
          >
            <span>{visionOnly ? "✓" : ""}</span>
            <span>Solo modelli vision</span>
          </button>
          <button onClick={onRefresh} disabled={loading} className="text-xs font-semibold text-ink/60 px-2 py-1 rounded-md hover:bg-black/5 inline-flex items-center gap-1 disabled:opacity-50">
            {loading ? <Spinner className="w-3.5 h-3.5" /> : <span>⟳</span>}
            <span>{loading ? "Aggiorno…" : "Aggiorna"}</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {error && !models?.length && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-3">{error}</div>}
        {!loading && list.length === 0 && !error && (
          <div className="text-center py-12 text-ink/50 text-sm"><div className="text-3xl mb-2">🔎</div>Nessun modello trovato.</div>
        )}
        <div className="flex flex-col gap-2">
          {list.map((m) => <ModelRow key={m.id} model={m} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />)}
        </div>
      </div>
    </div>
  );
}

function ThemeSection() {
  const { settings, setSettings } = useAppContext();
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">Aspetto</h3>
        <p className="text-xs text-ink/50 mt-0.5">Scegli il tema dell'applicazione.</p>
      </div>
      <div className="flex bg-black/5 p-1 rounded-xl">
        {[
          { id: "light", label: "Chiaro", icon: "☀️" },
          { id: "dark", label: "Scuro", icon: "🌙" },
          { id: "auto", label: "Sistema", icon: "💻" }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSettings({ theme: t.id })}
            className={`flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${settings.theme === t.id ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink/80 hover:bg-black/[0.02]"}`}
          >
            <span>{t.icon}</span> <span>{t.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SecuritySection({ askConfirm }) {
  const { settings, setSettings, toast } = useAppContext();
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinLength, setPinLength] = useState(settings.pinLength || 4);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  const pinValid = (s) => /^d+$/.test(s) && s.length === pinLength;

  const enablePin = async () => {
    if (!pinValid(pin1)) return toast(`Il PIN deve essere di ${pinLength} cifre`, "error");
    if (pin1 !== pin2) return toast("I due PIN non coincidono", "error");
    setBusy(true);
    try {
      const salt = randomSalt();
      const hash = await hashPin(pin1, salt);
      setSettings({ pinEnabled: true, pinSalt: salt, pinHash: hash, pinLength });
      setPin1(""); setPin2("");
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
        setSettings({ pinEnabled: false, pinHash: null, pinSalt: null, biometricEnabled: false, biometricCredId: null });
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
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">Sicurezza</h3>
        <p className="text-xs text-ink/50 mt-0.5">Proteggi l'app con PIN e sblocco biometrico.</p>
      </div>
      {settings.pinEnabled ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <div>
              <p className="font-bold text-emerald-800 text-sm">🔒 PIN attivo</p>
              <p className="text-xs text-emerald-700/80">Lunghezza: {settings.pinLength || 4} cifre</p>
            </div>
            <button onClick={disablePin} className="h-9 px-3 rounded-lg bg-white text-red-700 border border-red-200 text-xs font-semibold active:scale-95">Disabilita</button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.02] px-4 py-3">
            <div className="min-w-0">
              <p className="font-bold text-ink text-sm">👆 Sblocco biometrico</p>
              <p className="text-xs text-ink/60">{!bioAvailable ? "Non disponibile" : settings.biometricEnabled ? "Attivo" : "Attiva per sbloccare"}</p>
            </div>
            <button disabled={!bioAvailable || busy} onClick={settings.biometricEnabled ? disableBiometric : enableBiometric} className={`h-9 px-3 rounded-lg text-xs font-semibold active:scale-95 disabled:opacity-30 ${settings.biometricEnabled ? "bg-white text-ink border border-black/10" : "bg-ink text-white"}`}>
              {settings.biometricEnabled ? "Disattiva" : "Attiva"}
            </button>
          </div>
        </>
      ) : (
        <>
          <Field label="Lunghezza PIN">
            <div className="flex gap-2">
              {[4, 6].map((n) => (
                <button key={n} onClick={() => { setPinLength(n); setPin1(""); setPin2(""); }} className={`flex-1 h-11 rounded-xl text-sm font-semibold border active:scale-[0.98] ${pinLength === n ? "bg-ink text-white border-ink" : "bg-white text-ink border-black/10"}`}>{n} cifre</button>
              ))}
            </div>
          </Field>
          <Field label="Nuovo PIN">
            <TextInput type="password" inputMode="numeric" maxLength={pinLength} value={pin1} onChange={(e) => setPin1(e.target.value.replace(/D/g, "").slice(0, pinLength))} />
          </Field>
          <Field label="Conferma PIN">
            <TextInput type="password" inputMode="numeric" maxLength={pinLength} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/D/g, "").slice(0, pinLength))} />
          </Field>
          <PrimaryButton onClick={enablePin} disabled={busy || !pinValid(pin1) || pin1 !== pin2}>Attiva PIN</PrimaryButton>
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
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">Limiti di rimborso</h3>
          <p className="text-xs text-ink/50 mt-0.5">Soglie per categoria.</p>
        </div>
        <button onClick={reset} className="text-xs font-semibold text-ink/60 px-2 py-1 rounded-md hover:bg-black/5 shrink-0">Ripristina</button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {CATEGORY_IDS.map((cat) => {
          const c = CATEGORIES[cat];
          const value = limits[cat] ?? 0;
          return (
            <div key={cat} className="flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg grid place-items-center text-base" style={{ backgroundColor: c.color + "1a", color: c.color }}>{c.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{c.label}</p>
                {!value && <p className="text-[11px] text-ink/40 italic">Nessun limite</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="relative w-24">
                  <TextInput type="number" step="1" min="0" inputMode="decimal" value={value || ""} placeholder="—" onChange={(e) => setLimit(cat, e.target.value)} className={`w-full font-mono text-right pr-7 h-10 ${!value ? "text-ink/40 placeholder:text-ink/30" : "text-ink"}`} />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40 font-mono">€</span>
                </div>
                <button type="button" onClick={() => setLimit(cat, 0)} disabled={!value} className="w-8 h-8 rounded-full grid place-items-center text-ink/40 hover:bg-black/5 active:scale-90 transition disabled:opacity-0 disabled:pointer-events-none">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CombinationEditor({ index, combo, isFirst, onAddDoc, onRemoveDoc, onRemove }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm relative group">
      <div className="flex flex-wrap gap-2 mb-2 pr-8">
        {combo.length === 0 && <span className="text-xs text-ink/40 italic py-1">Nessun documento selezionato (spesa sempre valida)</span>}
        {combo.map((d) => {
          const type = DOC_TYPES.find((t) => t.id === d);
          return (
            <span key={d} className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-md bg-ink text-white text-xs font-semibold">
              <span aria-hidden>{type?.icon}</span>
              <span>{type?.label || d}</span>
              <button onClick={() => onRemoveDoc(d)} className="w-5 h-5 rounded hover:bg-white/20 flex items-center justify-center ml-0.5" aria-label="Rimuovi">✕</button>
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[10px] uppercase font-bold text-ink/40 shrink-0">+ AGGIUNGI:</span>
        {DOC_TYPES.filter((t) => !combo.includes(t.id)).map((t) => (
          <button key={t.id} onClick={() => onAddDoc(t.id)} className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-md bg-black/5 hover:bg-black/10 text-ink text-xs font-medium transition whitespace-nowrap">
            <span aria-hidden>{t.icon}</span> <span>{t.label}</span>
          </button>
        ))}
      </div>
      <button onClick={onRemove} className="absolute top-2 right-2 w-8 h-8 rounded-lg text-ink/30 hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center">✕</button>
      {!isFirst && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-paper px-2 text-[10px] font-bold text-ink/40 uppercase tracking-widest rounded-full">OPPURE</div>}
    </div>
  );
}

function DocsSection() {
  const { settings, setSettings, toast } = useAppContext();
  const reqs = settings.requiredDocs || {};
  const alts = Array.isArray(reqs.alternatives) ? reqs.alternatives : [];
  const setAlts = (next) => setSettings({ requiredDocs: { ...reqs, alternatives: next } });

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">Documenti richiesti</h3>
        <p className="text-xs text-ink/50 mt-0.5">Crea combinazioni accettate. La spesa è valida se almeno una combinazione è presente.</p>
      </div>
      {alts.length === 0 ? (
        <div className="rounded-xl bg-black/[0.02] border border-black/5 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-ink/70">Nessun requisito</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {alts.map((combo, i) => (
            <CombinationEditor key={i} index={i} combo={combo} isFirst={i === 0} onAddDoc={(id) => setAlts(alts.map((c, idx) => (idx === i ? [...c, id] : c)))} onRemoveDoc={(id) => setAlts(alts.map((c, idx) => (idx === i ? c.filter((d) => d !== id) : c)))} onRemove={() => setAlts(alts.filter((_, idx) => idx !== i))} />
          ))}
        </div>
      )}
      <button onClick={() => setAlts([...alts, []])} className="h-11 rounded-xl bg-ink/5 border border-dashed border-ink/20 text-sm font-bold text-ink/70 hover:bg-ink/10">
        + Aggiungi combinazione
      </button>
    </section>
  );
}

export function SettingsView({ askConfirm }) {
  const { settings, setSettings, toast } = useAppContext();
  const [apiKey, setApiKey] = useState(settings.apiKey || "");
  const [model, setModel] = useState(settings.model || MODELS[0].id);
  const [showKey, setShowKey] = useState(false);
  const [validation, setValidation] = useState({ status: "idle", error: "", info: null });
  const [models, setModels] = useState(() => safeLoad("receipt-tracker-models", null)?.list || null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => { setApiKey(settings.apiKey || ""); setModel(settings.model || MODELS[0].id); }, [settings.apiKey, settings.model]);
  useEffect(() => { if (!models) loadModels(false); }, []);

  async function loadModels(force) {
    setModelsLoading(true); setModelsError("");
    try {
      const list = await fetchOpenRouterModels(apiKey || "");
      setModels(list);
      safeSave("receipt-tracker-models", { list, fetchedAt: Date.now() });
      if (force) toast(`${list.length} modelli caricati`, "success");
    } catch (e) { setModelsError(e?.message || "Impossibile caricare i modelli"); }
    finally { setModelsLoading(false); }
  }

  async function checkApiKey() {
    const key = apiKey.trim();
    if (!key) return toast("Inserisci prima la API key", "error");
    setValidation({ status: "checking", error: "", info: null });
    try {
      const info = await validateOpenRouterKey(key);
      setValidation({ status: "valid", error: "", info });
      loadModels(false);
    } catch (e) { setValidation({ status: "invalid", error: e?.message || "Verifica fallita", info: null }); }
  }

  const onSaveApi = () => {
    setSettings({ apiKey: apiKey.trim(), model });
    toast("Impostazioni salvate", "success");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const onClearKey = () => { setApiKey(""); setSettings({ apiKey: "", model }); setValidation({ status: "idle", error: "", info: null }); toast("API key rimossa"); };

  return (
    <div className="px-5 pb-6 pt-2 fade-in flex flex-col gap-5">
      <div><h2 className="text-2xl font-extrabold text-ink mb-1">Impostazioni</h2><p className="text-sm text-ink/60">Configura l'app, la sicurezza e le regole.</p></div>
      <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink/60">OpenRouter</h3>
        <Field label="API key">
          <div className="relative">
            <TextInput type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="sk-or-v1-…" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setValidation({ status: "idle", error: "", info: null }); }} className="w-full pr-20" />
            <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink/60 px-2 py-1 rounded-md hover:bg-black/5">{showKey ? "Nascondi" : "Mostra"}</button>
          </div>
        </Field>
        <button onClick={checkApiKey} disabled={!apiKey.trim() || validation.status === "checking"} className="h-11 rounded-xl bg-white border border-black/10 shadow-soft text-sm font-semibold text-ink active:scale-[0.98] disabled:opacity-40 inline-flex items-center justify-center gap-2">
          {validation.status === "checking" ? <><Spinner className="w-4 h-4" /> Verifica in corso…</> : <>🔑 Verifica API key</>}
        </button>
        {validation.status === "valid" && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2"><span className="shrink-0">✓</span><div className="min-w-0"><p className="font-semibold">API key valida</p><ValidationDetails info={validation.info} /></div></div>}
        {validation.status === "invalid" && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex items-start gap-2"><span className="shrink-0">✗</span><div className="min-w-0"><p className="font-semibold">Verifica fallita</p><p className="text-xs text-red-700/90 break-words">{validation.error}</p></div></div>}
        <Field label="Modello vision" hint={models ? `${models.length} modelli disponibili` : "Caricamento modelli…"}>
          <button onClick={() => setPickerOpen(true)} className="h-12 px-4 rounded-xl bg-white border border-black/10 text-left flex items-center justify-between gap-2 hover:bg-black/[0.02] active:scale-[0.99] transition">
            <div className="min-w-0 flex-1"><p className="font-semibold text-ink truncate">{modelDisplayName(model, models)}</p><p className="text-[11px] text-ink/50 font-mono truncate">{model}</p></div><span className="text-ink/40 shrink-0">›</span>
          </button>
          {modelsError && !models && <p className="text-xs text-red-600 mt-1">{modelsError}</p>}
        </Field>
        <div className="flex gap-2 pt-1">
          <PrimaryButton className={`flex-1 transition-colors ${savedFlash ? "!bg-emerald-600" : ""}`} onClick={onSaveApi}>{savedFlash ? "✓ Salvato" : "Salva"}</PrimaryButton>
          {apiKey && <GhostButton onClick={onClearKey}>Rimuovi key</GhostButton>}
        </div>
      </section>
      <ModelPicker open={pickerOpen} models={models} loading={modelsLoading} error={modelsError} selectedId={model} onSelect={(id) => { setModel(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} onRefresh={() => loadModels(true)} />
      <ThemeSection />
      <SecuritySection askConfirm={askConfirm} />
      <LimitsSection />
      <DocsSection />
    </div>
  );
}
