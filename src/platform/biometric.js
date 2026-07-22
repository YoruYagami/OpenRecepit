// Biometric unlock. On the native Android app it uses the system
// BiometricPrompt via the Capacitor plugin (the WebView has no WebAuthn);
// on the web/PWA it uses the WebAuthn platform authenticator (Face ID /
// Touch ID / fingerprint / Windows Hello — requires HTTPS or localhost).
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { b64urlEncode, b64urlDecode } from "../utils/security.js";

const isNative = () => Capacitor.isNativePlatform();
const NATIVE_CRED = "native";

/* ---------- platform availability ---------- */
export async function isBiometricAvailable() {
  if (isNative()) {
    try {
      return !!(await BiometricAuth.checkBiometry()).isAvailable;
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
    // No enrollment needed natively: one successful prompt confirms it works.
    await BiometricAuth.authenticate({
      reason: "Conferma per attivare lo sblocco biometrico",
      cancelTitle: "Annulla",
    });
    return NATIVE_CRED;
  }
  if (!window.PublicKeyCredential) throw new Error("WebAuthn non supportato");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "OpenRecepit" },
      user: { id: userId, name: "utente@locale", displayName: "Utente" },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  });
  if (!cred) throw new Error("Registrazione biometrica annullata");
  return b64urlEncode(cred.rawId);
}

/* ---------- verification ---------- */
export async function verifyBiometric(credIdB64) {
  if (isNative() || credIdB64 === NATIVE_CRED) {
    try {
      await BiometricAuth.authenticate({
        reason: "Sblocca OpenRecepit",
        cancelTitle: "Annulla",
      });
      return true;
    } catch {
      return false;
    }
  }
  if (!window.PublicKeyCredential) throw new Error("WebAuthn non supportato");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const id = b64urlDecode(credIdB64);
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id, type: "public-key", transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!assertion;
}
