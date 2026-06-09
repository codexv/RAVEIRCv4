// Saved custom servers for the Connect dialog. Non-secret fields (name, host,
// port, tls) live in localStorage; the server password (IRC PASS — used for ZNC
// and other bouncers, format "user/network:password") is stored in the OS
// keychain via Tauri commands, mirroring profiles.ts — never in plaintext.

import { invoke } from "@tauri-apps/api/core";

const SECRET_PREFIX = "serverpw:";
const KEY = "raveirc.savedServers";

export interface SavedServer {
  id: string;
  name: string;
  host: string;
  port: number;
  tls: boolean;
  /** IRC server password (PASS). Blank in memory until fetched from the keychain. */
  serverPassword: string;
}

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "s" + Date.now() + Math.floor(Math.random() * 1e6);
  }
}

export function newServer(): SavedServer {
  return { id: uid(), name: "", host: "", port: 6697, tls: true, serverPassword: "" };
}

/** Load saved servers from localStorage (passwords blank — fetch lazily). */
export function loadServers(): SavedServer[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as SavedServer[];
      if (Array.isArray(list)) {
        return list.map((s) => ({ ...newServer(), ...s, serverPassword: "" }));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

/** Persist non-secret fields to localStorage (password never written here). */
export function saveServers(list: SavedServer[]) {
  const stripped = list.map((s) => ({ ...s, serverPassword: "" }));
  localStorage.setItem(KEY, JSON.stringify(stripped));
}

/** Fetch a single saved server's password from the keychain (lazy). */
export async function loadServerPassword(id: string): Promise<string> {
  try {
    const pw = await invoke<string | null>("secret_get", { key: SECRET_PREFIX + id });
    return pw ?? "";
  } catch {
    return "";
  }
}

/** Write (or clear) a saved server's password in the OS keychain. */
export async function saveServerPassword(id: string, password: string): Promise<void> {
  try {
    if (password) await invoke("secret_set", { key: SECRET_PREFIX + id, value: password });
    else await invoke("secret_delete", { key: SECRET_PREFIX + id });
  } catch {
    /* keychain unavailable */
  }
}

/** Remove a saved server's stored password from the keychain. */
export async function deleteServerPassword(id: string): Promise<void> {
  try {
    await invoke("secret_delete", { key: SECRET_PREFIX + id });
  } catch {
    /* ignore */
  }
}
