import React, { useState, useEffect } from 'react';
import { hashPin, verifyPin, PIN_ALGO_PBKDF2 } from '../../utils/security.js';
import { verifyBiometric } from '../../platform/biometric.js';
import { useAppContext } from '../../context/AppContext.jsx';
import { Spinner } from '../ui/Spinner.jsx';

const FAILS_PER_TIER = 5;
const BASE_LOCK_MS = 30000;
const MAX_LOCK_MS = 30 * 60 * 1000;

function computeLockMs(totalFails) {
  if (totalFails < FAILS_PER_TIER) return 0;
  const tier = Math.floor((totalFails - FAILS_PER_TIER) / FAILS_PER_TIER);
  return Math.min(MAX_LOCK_MS, BASE_LOCK_MS * Math.pow(2, tier));
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function LockScreen({ settings, onUnlock, onForget }) {
  const { setSettings } = useAppContext();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const pinLen = settings.pinLength || 4;
  const bioAvailable = settings.biometricEnabled && !!settings.biometricCredId;
  const pinFails = settings.pinFails || 0;
  const lockUntil = settings.pinLockUntil || 0;
  const lockRemaining = Math.max(0, lockUntil - now);
  const locked = lockRemaining > 0;

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [locked]);

  const tryBiometric = async (fallbackToPin = false) => {
    if (!bioAvailable || locked) return;
    setBusy(true);
    try {
      const ok = await verifyBiometric(settings.biometricCredId);
      if (ok) {
        setSettings({ pinFails: 0, pinLockUntil: 0 });
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

  useEffect(() => {
    if (bioAvailable && !locked) {
      tryBiometric(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioAvailable, locked]);

  const tryPin = async (val) => {
    if (locked) return;
    setBusy(true);
    try {
      const ok = await verifyPin(val, settings.pinSalt, settings.pinHash, settings.pinAlgo);
      if (ok) {
        const update = { pinFails: 0, pinLockUntil: 0 };
        if (settings.pinAlgo !== PIN_ALGO_PBKDF2) {
          try {
            update.pinHash = await hashPin(val, settings.pinSalt);
            update.pinAlgo = PIN_ALGO_PBKDF2;
          } catch {
            /* upgrade best-effort */
          }
        }
        setSettings(update);
        onUnlock();
      } else {
        const nextFails = pinFails + 1;
        const lockMs = computeLockMs(nextFails);
        const updates = { pinFails: nextFails };
        if (lockMs > 0) {
          updates.pinLockUntil = Date.now() + lockMs;
          setError(`PIN errato. App bloccata ${formatRemaining(lockMs)}`);
        } else {
          const remaining = FAILS_PER_TIER - (nextFails % FAILS_PER_TIER);
          setError(`PIN errato. Altri ${remaining} tentativi prima del blocco`);
        }
        setSettings(updates);
        setTimeout(() => {
          setError("");
          setPin("");
        }, 1100);
      }
    } finally {
      setBusy(false);
    }
  };

  const press = (d) => {
    if (busy || locked) return;
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
      disabled={busy || locked}
      className="h-16 rounded-2xl bg-white shadow-soft text-2xl font-semibold text-ink active:scale-95 transition disabled:opacity-50"
    >
      {d}
    </button>
  );

  return (
    <div className="absolute inset-0 z-50 bg-paper flex flex-col items-center justify-center px-6 fade-in">
      <div className="text-5xl mb-3">{locked ? "⏳" : "🔒"}</div>
      <h2 className="text-xl font-extrabold text-ink">Scontrini Trasferta</h2>
      <p className="text-sm text-ink/60 mt-1">
        {locked ? `Riprova fra ${formatRemaining(lockRemaining)}` : "Inserisci il PIN per sbloccare"}
      </p>

      <div className="flex gap-3 my-6">{dots}</div>
      {error ? (
        <p className="text-sm text-red-600 -mt-2 mb-4 h-5 text-center px-4">{error}</p>
      ) : (
        <div className="h-5 mb-4" />
      )}

      <div className="grid grid-cols-3 gap-3 w-full max-w-[300px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} d={d} />
        ))}
        <button
          onClick={() => tryBiometric(false)}
          disabled={!bioAvailable || busy || locked}
          className="h-16 rounded-2xl text-2xl text-ink/70 active:scale-95 transition disabled:opacity-25"
          aria-label="Sblocca con biometrico"
        >
          👆
        </button>
        <Key d="0" />
        <button
          onClick={backspace}
          disabled={busy || locked || pin.length === 0}
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
