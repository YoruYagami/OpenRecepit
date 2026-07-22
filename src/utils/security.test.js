import { describe, it, expect } from "vitest";
import {
  hashPin,
  verifyPin,
  randomSalt,
  b64urlEncode,
  b64urlDecode,
  PIN_ALGO_PBKDF2,
} from "./security.js";

describe("base64url helpers", () => {
  it("roundtrip", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const enc = b64urlEncode(bytes);
    expect(enc).not.toMatch(/[+/=]/);
    const dec = b64urlDecode(enc);
    expect([...dec]).toEqual([...bytes]);
  });
});

describe("hashPin (PBKDF2)", () => {
  it("produces deterministic output for same pin+salt", async () => {
    const salt = randomSalt();
    const a = await hashPin("1234", salt);
    const b = await hashPin("1234", salt);
    expect(a).toBe(b);
  });

  it("changes when salt changes", async () => {
    const s1 = randomSalt();
    const s2 = randomSalt();
    expect(await hashPin("1234", s1)).not.toBe(await hashPin("1234", s2));
  });

  it("changes when pin changes", async () => {
    const salt = randomSalt();
    expect(await hashPin("1234", salt)).not.toBe(await hashPin("4321", salt));
  });
});

describe("verifyPin", () => {
  it("verifies a PBKDF2 hash", async () => {
    const salt = randomSalt();
    const hash = await hashPin("5678", salt);
    expect(await verifyPin("5678", salt, hash, PIN_ALGO_PBKDF2)).toBe(true);
    expect(await verifyPin("5679", salt, hash, PIN_ALGO_PBKDF2)).toBe(false);
  });

  it("verifies a legacy SHA-256 hash when algo is missing", async () => {
    const salt = "fixed-salt";
    const legacy = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:9999`));
    const legacyHash = b64urlEncode(legacy);
    expect(await verifyPin("9999", salt, legacyHash, undefined)).toBe(true);
    expect(await verifyPin("1111", salt, legacyHash, undefined)).toBe(false);
  });
});
