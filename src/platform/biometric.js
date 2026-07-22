// Biometric unlock via the WebAuthn platform authenticator (Face ID / Touch ID /
// fingerprint / Windows Hello). Requires a secure context (HTTPS or localhost).
import { b64urlEncode, b64urlDecode } from "../utils/security.js";

/* ---------- platform availability ---------- */
export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/* ---------- registration ---------- */
export async function registerBiometric() {
  if (!window.PublicKeyCredential) throw new Error("WebAuthn non supportato");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Scontrini Trasferta" },
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
