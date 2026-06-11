// Saved identity profiles (nick + full user details + which networks they suit).
// Non-secret fields live in localStorage; the NickServ password is encrypted by
// RAVE's self-contained secret store (see secrets.ts) and kept with the app —
// never written in plaintext.

import { secretGet, secretSet, secretDelete } from "./secrets";
import { dedupeById } from "./util";

const SECRET_PREFIX = "profilepw:";

export interface NickProfile {
  id: string;
  label: string;
  nick: string;
  /** Alternate nicks (comma/newline separated) — also the connect auto-fallback. */
  altNicks: string;
  username: string;
  realname: string;
  nickservPassword: string;
  /** Where it applies: "any" | "dalnet" | "undernet" | "libera" | a host substring. */
  network: string;
  /** Login behaviour (mirrors the original RAVE nick manager). */
  autoIdentify: boolean;
  autoGhost: boolean;
  autoRelease: boolean;
}

const KEY = "raveirc.profiles";

export const NETWORK_CHOICES = [
  { value: "any", label: "Any network" },
  { value: "dalnet", label: "DALnet" },
  { value: "undernet", label: "Undernet" },
  { value: "libera", label: "Libera.Chat" },
  { value: "efnet", label: "EFnet" },
];

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "p" + Date.now() + Math.floor(Math.random() * 1e6);
  }
}

/** Load profiles from localStorage (passwords blank — fetch via hydratePasswords). */
export function loadProfiles(): NickProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as NickProfile[];
      // Backfill any fields missing from profiles saved before they existed,
      // and ensure no plaintext password lingers from older versions.
      return dedupeById(
        list.map((p) => ({ ...newProfile(), ...p, nickservPassword: "" })),
        uid,
      );
    }
  } catch {
    /* ignore */
  }
  return [];
}

/** Fetch a single profile's NickServ password from the secret store (lazy). */
export async function loadProfilePassword(id: string): Promise<string> {
  return (await secretGet(SECRET_PREFIX + id)) ?? "";
}

/** Fill each profile's NickServ password from the secret store (in place). */
export async function hydratePasswords(list: NickProfile[]): Promise<void> {
  await Promise.all(
    list.map(async (p) => {
      const pw = await secretGet(SECRET_PREFIX + p.id);
      if (pw) p.nickservPassword = pw;
    }),
  );
}

/** Persist non-secret fields to localStorage (passwords never written here). */
export function saveProfiles(list: NickProfile[]) {
  const stripped = list.map((p) => ({ ...p, nickservPassword: "" }));
  localStorage.setItem(KEY, JSON.stringify(stripped));
}

/** Write each profile's NickServ password to the secret store (or clear it). */
export async function commitPasswords(list: NickProfile[]): Promise<void> {
  await Promise.all(list.map((p) => secretSet(SECRET_PREFIX + p.id, p.nickservPassword)));
}

/** One-time: move any plaintext passwords from older localStorage into the secret store. */
export async function migrateLegacyPasswords(): Promise<void> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as NickProfile[];
    let changed = false;
    for (const p of list) {
      if (p.nickservPassword) {
        await secretSet(SECRET_PREFIX + p.id, p.nickservPassword);
        p.nickservPassword = "";
        changed = true;
      }
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Remove a profile's stored password from the secret store. */
export async function deleteProfilePassword(id: string): Promise<void> {
  await secretDelete(SECRET_PREFIX + id);
}

export function newProfile(): NickProfile {
  return {
    id: uid(),
    label: "New profile",
    nick: "",
    altNicks: "",
    username: "rave",
    realname: "RAVEIRC user",
    nickservPassword: "",
    network: "any",
    autoIdentify: true,
    autoGhost: true,
    autoRelease: false,
  };
}

/** Does a profile suit a given server host? "any"/"" matches everything. */
export function profileMatchesHost(p: NickProfile, host: string): boolean {
  const n = (p.network || "any").toLowerCase();
  if (n === "any" || n === "") return true;
  const h = host.toLowerCase();
  if (n === "dalnet") return h.includes("dal.net");
  if (n === "undernet") return h.includes("undernet");
  if (n === "libera") return h.includes("libera");
  if (n === "efnet") return h.includes("efnet");
  return h.includes(n); // free-text host substring
}
