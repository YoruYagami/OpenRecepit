import React, { useState } from "react";
import { useAppContext } from "../../context/AppContext.jsx";
import { Icon } from "../ui/Icon.jsx";
import { PrimaryButton, GhostButton } from "../ui/Button.jsx";

const STEPS = [
  {
    icon: "receipt",
    title: "Benvenuto in Scontrini Trasferta",
    body: "Fotografa gli scontrini delle tue trasferte e lascia che l'app compili esercente, importo, data e categoria. Tutto resta sul tuo dispositivo: niente account, niente cloud.",
  },
  {
    icon: "camera",
    title: "Scansiona o inserisci a mano",
    body: "La scansione usa un modello AI (serve una API key OpenRouter, si configura in un minuto). Senza key puoi comunque registrare ogni spesa manualmente.",
  },
  {
    icon: "download",
    title: "Esporta e proteggi",
    body: "Esporta CSV per i rimborsi, fai backup in JSON e, se vuoi, blocca l'app con PIN o impronta.",
  },
];

/*
 * First-run intro (3 skippable steps). A gate like the LockScreen — not on the
 * nav stack, so it creates no history entries. Shown once: sets
 * settings.onboardingDone on any exit path.
 */
export function Onboarding({ onCreateTrip, onGoToSettings }) {
  const { setSettings } = useAppContext();
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  const finish = (action) => {
    setSettings({ onboardingDone: true });
    action?.();
  };

  return (
    <div className="absolute inset-0 z-[150] bg-paper flex flex-col items-center justify-center px-8 fade-in text-center">
      <div className="w-16 h-16 rounded-2xl bg-ink/5 grid place-items-center mb-5">
        <Icon name={s.icon} className="w-8 h-8 text-ink" />
      </div>
      <h2 className="text-2xl font-extrabold text-ink max-w-sm">{s.title}</h2>
      <p className="text-sm text-ink/60 mt-3 max-w-sm leading-relaxed">{s.body}</p>

      <div className="flex gap-1.5 my-8" aria-hidden>
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-ink" : "w-1.5 bg-ink/20"}`}
          />
        ))}
      </div>

      {last ? (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <PrimaryButton onClick={() => finish(onCreateTrip)}>
            <Icon name="plus" className="w-4 h-4" /> Crea la prima trasferta
          </PrimaryButton>
          <GhostButton onClick={() => finish(onGoToSettings)}>
            <Icon name="key" className="w-4 h-4" /> Configura la API key
          </GhostButton>
          <button
            onClick={() => finish()}
            className="mt-1 text-xs text-ink/55 underline-offset-2 hover:underline py-2"
          >
            Esplora prima l'app
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <PrimaryButton onClick={() => setStep(step + 1)}>Avanti</PrimaryButton>
          <button
            onClick={() => finish()}
            className="mt-1 text-xs text-ink/55 underline-offset-2 hover:underline py-2"
          >
            Salta
          </button>
        </div>
      )}
    </div>
  );
}
