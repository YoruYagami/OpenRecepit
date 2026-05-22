export function b64urlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return b64urlEncode(a);
}

const PBKDF2_ITER = 150000;
export const PIN_ALGO_PBKDF2 = "pbkdf2-sha256-v1";

async function pbkdf2(pin, salt) {
  const saltBytes = b64urlDecode(salt);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITER, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return b64urlEncode(new Uint8Array(bits));
}

async function legacySha256(pin, salt) {
  const buf = new TextEncoder().encode(`${salt}:${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return b64urlEncode(hash);
}

export async function hashPin(pin, salt) {
  return pbkdf2(pin, salt);
}

export async function verifyPin(pin, salt, expectedHash, algo) {
  if (algo === PIN_ALGO_PBKDF2) {
    return (await pbkdf2(pin, salt)) === expectedHash;
  }
  return (await legacySha256(pin, salt)) === expectedHash;
}
