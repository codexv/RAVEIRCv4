// Saved identity profiles (nick + full user details + which networks they suit).
// Non-secret fields live in localStorage; the NickServ password is stored in the
// OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret
// Service) via Tauri commands — never written to disk in plaintext.

import { invoke } from "@tauri-apps/api/core";

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
      return list.map((p) => ({ ...newProfile(), ...p, nickservPassword: "" }));
    }
  } catch {
    /* ignore */
  }
  return [];
}

/** Fetch a single profile's NickServ password from the keychain (lazy). */
export async function loadProfilePassword(id: string): Promise<string> {
  try {
    const pw = await invoke<string | null>("secret_get", { key: SECRET_PREFIX + id });
    return pw ?? "";
  } catch {
    return "";
  }
}

/** Fill each profile's NickServ password from the OS keychain (in place). */
export async function hydratePasswords(list: NickProfile[]): Promise<void> {
  await Promise.all(
    list.map(async (p) => {
      try {
        const pw = await invoke<string | null>("secret_get", { key: SECRET_PREFIX + p.id });
        if (pw) p.nickservPassword = pw;
      } catch {
        /* keychain unavailable — leave blank */
      }
    }),
  );
}

/** Persist non-secret fields to localStorage (passwords never written here). */
export function saveProfiles(list: NickProfile[]) {
  const stripped = list.map((p) => ({ ...p, nickservPassword: "" }));
  localStorage.setItem(KEY, JSON.stringify(stripped));
}

/** Write each profile's NickServ password to the OS keychain (or clear it). */
export async function commitPasswords(list: NickProfile[]): Promise<void> {
  await Promise.all(
    list.map(async (p) => {
      try {
        if (p.nickservPassword) {
          await invoke("secret_set", { key: SECRET_PREFIX + p.id, value: p.nickservPassword });
        } else {
          await invoke("secret_delete", { key: SECRET_PREFIX + p.id });
        }
      } catch {
        /* keychain unavailable */
      }
    }),
  );
}

/** One-time: move any plaintext passwords from older localStorage into the keychain. */
export async function migrateLegacyPasswords(): Promise<void> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as NickProfile[];
    let changed = false;
    for (const p of list) {
      if (p.nickservPassword) {
        try {
          await invoke("secret_set", { key: SECRET_PREFIX + p.id, value: p.nickservPassword });
        } catch {
          /* keychain unavailable — leave as is */
          continue;
        }
        p.nickservPassword = "";
        changed = true;
      }
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Remove a profile's stored password from the keychain. */
export async function deleteProfilePassword(id: string): Promise<void> {
  try {
    await invoke("secret_delete", { key: SECRET_PREFIX + id });
  } catch {
    /* ignore */
  }
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
