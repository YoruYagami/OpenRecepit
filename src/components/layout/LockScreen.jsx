import React, { useState, useEffect, useRef } from "react";
import { hashPin, verifyPin, PIN_ALGO_PBKDF2 } from "../../utils/security.js";
import { verifyBiometric } from "../../platform/biometric.js";
import { useAppContext } from "../../context/AppContext.jsx";
import { Spinner } from "../ui/Spinner.jsx";
import { Icon } from "../ui/Icon.jsx";
import { Overlay } from "../ui/Overlay.jsx";
import { ConfirmBody } from "../dialogs/ConfirmDialog.jsx";

const FAILS_PER_TIER = 5;
const BASE_LOCK_MS = 30000;
const MAX_LOCK_MS = 30 * 60 * 1000;

function computeLockMs(totalFails) {
  // Lock only at the end of each group of FAILS_PER_TIER attempts (5, 10, 15, ...),
  // doubling the duration each group. Between group boundaries the caller shows the
  // remaining-attempts hint instead of re-locking on every single wrong PIN.
  if (totalFails < FAILS_PER_TIER || totalFails % FAILS_PER_TIER !== 0) return 0;
  const tier = totalFails / FAILS_PER_TIER - 1;
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
  const [confirmForget, setConfirmForget] = useState(false);
  // Pending "clear the failed attempt from the dots" timer. Tracked so typing a
  // new PIN during the error flash cancels it instead of getting wiped by it.
  const resetTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(resetTimerRef.current), []);

  const pinLen = settings.pinLength || 6;
  const bioAvailable = settings.biometricEnabled && !!settings.biometricCredId;
  const pinFails = settings.pinFails || 0;
  const lockUntil = settings.pinLockUntil || 0;
  const lockRemaining = Math.max(0, lockUntil - now);
  const locked = lockRemaining > 0;

  useEffect(() => {
    if (!locked) return;
    setNow(Date.now()); // refresh immediately so a freshly-engaged lock shows the correct remaining time
    const t = setInterval(() => setNow(Date.now()), 1000);
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
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          resetTimerRef.current = null;
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
    // After a failed attempt the wrong PIN stays displayed during the error
    // flash; a keypress must start a fresh entry, not resubmit the old PIN.
    let base = pin;
    if (resetTimerRef.current || pin.length >= pinLen) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
      setError("");
      base = "";
    }
    const next = (base + d).slice(0, pinLen);
    setPin(next);
    if (next.length === pinLen) {
      setTimeout(() => tryPin(next), 80);
    }
  };

  const backspace = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
      setError("");
      setPin("");
      return;
    }
    setPin((p) => p.slice(0, -1));
  };

  const dots = [];
  for (let i = 0; i < pinLen; i++) {
    dots.push(
      <div
        key={i}
        className={`w-3.5 h-3.5 rounded-full transition-colors ${
          error ? "bg-danger-solid" : i < pin.length ? "bg-ink" : "bg-ink/15"
        }`}
      />
    );
  }

  const Key = ({ d }) => (
    <button
      onClick={() => press(d)}
      disabled={busy || locked}
      className="h-16 rounded-2xl bg-surface shadow-soft text-2xl font-semibold text-ink active:scale-95 transition disabled:opacity-50"
    >
      {d}
    </button>
  );

  return (
    // z-[200]: the PIN gate must sit above every nav overlay (a lightbox at a
    // lower tier could otherwise stay visible over the lock screen).
    <div className="absolute inset-0 z-[200] bg-paper flex flex-col items-center justify-center px-6 fade-in">
      <div className="text-5xl mb-3">{locked ? "⏳" : "🔒"}</div>
      <h2 className="text-xl font-extrabold text-ink">OpenRecepit</h2>
      <p className="text-sm text-ink/60 mt-1">
        {locked
          ? `Riprova fra ${formatRemaining(lockRemaining)}`
          : "Inserisci il PIN per sbloccare"}
      </p>

      <div className="flex gap-3 my-6">{dots}</div>
      {error ? (
        <p className="text-sm text-danger -mt-2 mb-4 h-5 text-center px-4">{error}</p>
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
          className="h-16 rounded-2xl text-ink/70 active:scale-95 transition disabled:opacity-25"
          aria-label="Sblocca con biometrico"
        >
          <Icon name="fingerprint" className="w-6 h-6 mx-auto" />
        </button>
        <Key d="0" />
        <button
          onClick={backspace}
          disabled={busy || locked || pin.length === 0}
          className="h-16 rounded-2xl text-ink/60 active:scale-95 transition disabled:opacity-30"
          aria-label="Cancella"
        >
          <Icon name="backspace" className="w-6 h-6 mx-auto" />
        </button>
      </div>

      {busy && <Spinner className="w-5 h-5 mt-5 text-ink/50" />}

      {onForget && (
        <button
          onClick={() => setConfirmForget(true)}
          className="mt-8 text-xs text-ink/55 underline-offset-2 hover:underline"
        >
          PIN dimenticato?
        </button>
      )}

      {confirmForget && (
        // Local overlay, outside the nav stack: the lock screen sits above
        // navigation and must not create history entries.
        <Overlay variant="sheet" closeOnBackdrop onClose={() => setConfirmForget(false)}>
          <ConfirmBody
            title="Reimpostare il PIN?"
            message="Il PIN (e lo sblocco biometrico) verrà rimosso e l'app verrà sbloccata. I tuoi dati restano sul dispositivo. Potrai impostare un nuovo PIN dalle impostazioni."
            danger
            confirmLabel="Reimposta"
            onConfirm={() => {
              setConfirmForget(false);
              onForget();
            }}
            onCancel={() => setConfirmForget(false)}
          />
        </Overlay>
      )}
    </div>
  );
}
