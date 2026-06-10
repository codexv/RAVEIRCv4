// RAVE self-contained secret store — replaces the OS keychain.
//
// Credentials (NickServ / server passwords) are encrypted with AES-GCM (Web
// Crypto) under a key derived from a fixed RAVE "pepper" baked into the app plus
// a per-install random device key, then kept in localStorage. This is
// encryption-at-rest: the stored blobs are opaque to casual inspection and
// shared-storage scraping, and it works identically on desktop and the web/PWA.
//
// NOTE: because the decryption key lives with the app, this is obfuscation, not
// keychain-grade isolation — someone with full local access to the app's data
// can recover the passwords. It deliberately trades that for portability.

const PREFIX = "raveirc.sec:"; // localStorage namespace for encrypted secrets
const DK_KEY = "raveirc.dk"; // per-install device key
const PEPPER = "RAVEv4::acronix::self-cipher::v1"; // app-baked secret (the RAVE part)
const SALT = "raveirc-secrets-v1";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Stable per-install random key (created once, kept in localStorage). */
function deviceKey(): string {
  let dk = "";
  try {
    dk = localStorage.getItem(DK_KEY) ?? "";
  } catch {
    /* ignore */
  }
  if (!dk) {
    dk = b64(crypto.getRandomValues(new Uint8Array(32)));
    try {
      localStorage.setItem(DK_KEY, dk);
    } catch {
      /* ignore */
    }
  }
  return dk;
}

async function aesKey(): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(`${PEPPER}:${deviceKey()}`),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(SALT), iterations: 120_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt and store a secret by name. Empty value clears it. */
export async function secretSet(name: string, value: string): Promise<void> {
  if (!value) return secretDelete(name);
  try {
    const key = await aesKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(value)),
    );
    const blob = new Uint8Array(iv.length + ct.length);
    blob.set(iv);
    blob.set(ct, iv.length);
    localStorage.setItem(PREFIX + name, b64(blob));
  } catch {
    /* ignore */
  }
}

/** Decrypt and return a stored secret, or null if absent/undecryptable. */
export async function secretGet(name: string): Promise<string | null> {
  let raw = "";
  try {
    raw = localStorage.getItem(PREFIX + name) ?? "";
  } catch {
    /* ignore */
  }
  if (!raw) return null;
  try {
    const blob = unb64(raw);
    const iv = blob.slice(0, 12);
    const ct = blob.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await aesKey(), ct);
    return dec.decode(pt);
  } catch {
    return null;
  }
}

export async function secretDelete(name: string): Promise<void> {
  try {
    localStorage.removeItem(PREFIX + name);
  } catch {
    /* ignore */
  }
}
