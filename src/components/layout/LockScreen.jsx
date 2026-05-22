import React, { useState } from 'react';
import { hashPin, verifyPin, PIN_ALGO_PBKDF2 } from '../../utils/security.js';
import { verifyBiometric } from '../../platform/biometric.js';
import { useAppContext } from '../../context/AppContext.jsx';
import { Spinner } from '../ui/Spinner.jsx';

export function LockScreen({ settings, onUnlock, onForget }) {
  const { setSettings } = useAppContext();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pinLen = settings.pinLength || 4;
  const bioAvailable = settings.biometricEnabled && !!settings.biometricCredId;

  const tryBiometric = async (fallbackToPin = false) => {
    if (!bioAvailable) return;
    setBusy(true);
    try {
      const ok = await verifyBiometric(settings.biometricCredId);
      if (ok) {
        onUnlock();
      } else {
        if (!fallbackToPin) setError("Biometrico fallito");
      }
    } catch {
      if (!fallbackToPin) setError("Biometrico annullato");
    } finally {
      setBusy(false);
      setTimeout(() => setError(""), 2000);
    }
  };

  React.useEffect(() => {
    if (bioAvailable) {
      tryBiometric(true);
    }
  }, [bioAvailable]);

  const tryPin = async (val) => {
    setBusy(true);
    try {
      const ok = await verifyPin(val, settings.pinSalt, settings.pinHash, settings.pinAlgo);
      if (ok) {
        if (settings.pinAlgo !== PIN_ALGO_PBKDF2) {
          try {
            const upgraded = await hashPin(val, settings.pinSalt);
            setSettings({ pinHash: upgraded, pinAlgo: PIN_ALGO_PBKDF2 });
          } catch {
            // upgrade best-effort; ignore failures
          }
        }
        onUnlock();
      } else {
        setError("PIN errato");
        setTimeout(() => {
          setError("");
          setPin("");
        }, 700);
      }
    } finally {
      setBusy(false);
    }
  };

  const press = (d) => {
    if (busy) return;
    const next = (pin + d).slice(0, pinLen);
    setPin(next);
    if (next.length === pinLen) {
      setTimeout(() => tryPin(next), 80);
    }
  };

  const backspace = () => setPin((p) => p.slice(0, -1));

  const dots = [];
  for (let i = 0; i < pinLen; i++) {
    dots.push(
      <div
        key={i}
        className={`w-3.5 h-3.5 rounded-full transition-colors ${
          error ? "bg-red-500" : i < pin.length ? "bg-ink" : "bg-ink/15"
        }`}
      />
    );
  }

  const Key = ({ d }) => (
    <button
      onClick={() => press(d)}
      disabled={busy}
      className="h-16 rounded-2xl bg-white shadow-soft text-2xl font-semibold text-ink active:scale-95 transition disabled:opacity-50"
    >
      {d}
    </button>
  );

  return (
    <div className="absolute inset-0 z-50 bg-paper flex flex-col items-center justify-center px-6 fade-in">
      <div className="text-5xl mb-3">🔒</div>
      <h2 className="text-xl font-extrabold text-ink">Scontrini Trasferta</h2>
      <p className="text-sm text-ink/60 mt-1">Inserisci il PIN per sbloccare</p>

      <div className="flex gap-3 my-6">{dots}</div>
      {error ? (
        <p className="text-sm text-red-600 -mt-2 mb-4 h-5">{error}</p>
      ) : (
        <div className="h-5 mb-4" />
      )}

      <div className="grid grid-cols-3 gap-3 w-full max-w-[300px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} d={d} />
        ))}
        <button
          onClick={() => tryBiometric(false)}
          disabled={!bioAvailable || busy}
          className="h-16 rounded-2xl text-2xl text-ink/70 active:scale-95 transition disabled:opacity-25"
          aria-label="Sblocca con biometrico"
        >
          👆
        </button>
        <Key d="0" />
        <button
          onClick={backspace}
          disabled={busy || pin.length === 0}
          className="h-16 rounded-2xl text-xl text-ink/60 active:scale-95 transition disabled:opacity-30"
          aria-label="Cancella"
        >
          ⌫
        </button>
      </div>

      {busy && <Spinner className="w-5 h-5 mt-5 text-ink/50" />}

      {onForget && (
        <button onClick={onForget} className="mt-8 text-xs text-ink/40 underline-offset-2 hover:underline">
          PIN dimenticato?
        </button>
      )}
    </div>
  );
}
