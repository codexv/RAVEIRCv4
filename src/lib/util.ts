// Small utility features ported from RAVE: acronym expansion, uptime, and
// passphrase encryption (a modern AES-GCM replacement for the old acrypt).

const APP_START = Date.now();

/** Human-readable client uptime, e.g. "2d 3h 14m 09s". */
export function uptime(): string {
  let s = Math.floor((Date.now() - APP_START) / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d ? d + "d " : ""}${h ? h + "h " : ""}${m}m ${p(s)}s`;
}

/** A compact built-in acronym dictionary (RAVE ozacronym style). */
const ACRONYMS: Record<string, string> = {
  afaik: "as far as I know",
  afk: "away from keyboard",
  asl: "age / sex / location",
  bbl: "be back later",
  bbs: "be back soon",
  brb: "be right back",
  btw: "by the way",
  bnc: "bouncer",
  fwiw: "for what it's worth",
  ftw: "for the win",
  gg: "good game",
  gtg: "got to go",
  hth: "hope this helps",
  idk: "I don't know",
  iirc: "if I recall correctly",
  imo: "in my opinion",
  imho: "in my humble opinion",
  irl: "in real life",
  lol: "laughing out loud",
  nm: "never mind",
  np: "no problem",
  ofc: "of course",
  omg: "oh my goodness",
  op: "channel operator",
  rofl: "rolling on the floor laughing",
  rtfm: "read the manual",
  smh: "shaking my head",
  tba: "to be announced",
  tbh: "to be honest",
  tldr: "too long; didn't read",
  ttyl: "talk to you later",
  wb: "welcome back",
  wtf: "what the heck",
  ymmv: "your mileage may vary",
};

/** Look up an acronym, or null if unknown. */
export function acronym(term: string): string | null {
  return ACRONYMS[term.trim().toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

// ---- passphrase encryption (AES-GCM via Web Crypto) ------------------------
//
// Modern replacement for RAVE's acrypt. Messages are tagged with a marker so
// the receiver (who shares the passphrase) auto-decrypts them.

export const ENC_MARKER = "\u{1F512}"; // 🔒

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("raveirc-salt-v1"), iterations: 100_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Encrypt text → `🔒<base64(iv|ciphertext)>`. */
export async function encryptText(passphrase: string, text: string): Promise<string> {
  const key = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text)),
  );
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv);
  blob.set(ct, iv.length);
  return ENC_MARKER + toB64(blob);
}

/** Decrypt a `🔒...` blob, or null if it isn't ours / wrong key. */
export async function decryptText(passphrase: string, payload: string): Promise<string | null> {
  if (!payload.startsWith(ENC_MARKER)) return null;
  try {
    const blob = fromB64(payload.slice(ENC_MARKER.length));
    const iv = blob.slice(0, 12);
    const ct = blob.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await deriveKey(passphrase), ct);
    return dec.decode(pt);
  } catch {
    return null;
  }
}

/** Short beep via Web Audio (no bundled sound files needed). */
export function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable */
  }
}

/** Deep-clone plain JSON-able data. Works on every WebView (structuredClone is
 *  missing on older macOS WebKit, which crashed Settings/Channel Manager). */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
