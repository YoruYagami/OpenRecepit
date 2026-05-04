// Cross-platform biometric: Capacitor native on Android, WebAuthn on browser.
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/* ---------- shared helpers (also used by the web path) ---------- */
function b64urlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- platform availability ---------- */
export async function isBiometricAvailable() {
  if (isNative()) {
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      const info = await BiometricAuth.checkBiometry();
      return !!info.isAvailable;
    } catch {
      return false;
    }
  }
  if (!window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/* ---------- registration ---------- */
export async function registerBiometric() {
  if (isNative()) {
    // On native we don't need to bind a credential — we just need user-verification.
    // We sentinel-store a fixed marker; verifyBiometric() re-prompts the OS each time.
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason: 'Conferma per attivare lo sblocco biometrico',
      cancelTitle: 'Annulla',
      androidTitle: 'Sblocco biometrico',
      androidSubtitle: 'Conferma identità per registrare',
    });
    return 'native:enrolled';
  }

  // Web: WebAuthn platform authenticator
  if (!window.PublicKeyCredential) throw new Error('WebAuthn non supportato');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Scontrini Trasferta' },
      user: { id: userId, name: 'utente@locale', displayName: 'Utente' },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });
  if (!cred) throw new Error('Registrazione biometrica annullata');
  return b64urlEncode(cred.rawId);
}

/* ---------- verification ---------- */
export async function verifyBiometric(credIdB64) {
  if (isNative()) {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    try {
      await BiometricAuth.authenticate({
        reason: 'Sblocca Scontrini Trasferta',
        cancelTitle: 'Annulla',
        androidTitle: 'Sblocco biometrico',
        androidSubtitle: 'Conferma identità',
      });
      return true;
    } catch {
      return false;
    }
  }

  if (!window.PublicKeyCredential) throw new Error('WebAuthn non supportato');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const id = b64urlDecode(credIdB64);
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id, type: 'public-key', transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return !!assertion;
}
