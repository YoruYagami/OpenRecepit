import React, { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { Spinner } from "../ui/Spinner.jsx";

/** Sheet shown when another app shares a PDF/image with us. */
export function SharedFileSheet({
  fileName,
  isPdf,
  canAnalyze,
  hasTrips,
  onAnalyze,
  onAttachExisting,
  onClose,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const runAnalyze = async () => {
    setBusy(true);
    setError("");
    try {
      await onAnalyze();
    } catch (e) {
      setError(e?.message || "Analisi fallita");
      setBusy(false);
    }
  };

  return (
    <div className="p-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-surface-2 grid place-items-center shrink-0 text-ink/60">
          <Icon name={isPdf ? "fileText" : "image"} className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-ink">Documento ricevuto</h3>
          <p className="text-xs text-ink/60 truncate">{fileName}</p>
        </div>
      </div>

      {!hasTrips && (
        <p className="mt-4 text-sm text-warn bg-warn-soft border border-warn-line rounded-xl px-3 py-2">
          Crea prima una trasferta, poi ricondividi il documento.
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm text-danger bg-danger-soft border border-danger-line rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <button
          onClick={runAnalyze}
          disabled={busy || !canAnalyze}
          className="h-12 rounded-xl bg-ink text-paper font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? (
            <>
              <Spinner className="w-4 h-4" /> Analisi in corso…
            </>
          ) : (
            <>
              <Icon name="scan" className="w-4 h-4" /> Analizza con AI
            </>
          )}
        </button>
        {!canAnalyze && hasTrips && (
          <p className="text-[11px] text-ink/50 text-center -mt-1">
            L'analisi richiede la API key OpenRouter (Impostazioni).
          </p>
        )}
        <button
          onClick={onAttachExisting}
          disabled={busy || !hasTrips}
          className="h-12 rounded-xl bg-surface border border-line-strong text-ink font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
        >
          <Icon name="plus" className="w-4 h-4" /> Allega a una spesa esistente
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="h-11 rounded-xl bg-surface-2 text-ink/70 font-semibold active:scale-[0.98] disabled:opacity-40"
        >
          Annulla
        </button>
      </div>
      <p className="mt-3 text-[11px] text-ink/45 leading-relaxed">
        Con l'analisi AI, se esiste già una spesa con stessa data e importo il documento viene
        allegato a quella; altrimenti viene creata una nuova spesa nell'ultima trasferta.
      </p>
    </div>
  );
}
