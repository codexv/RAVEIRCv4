// Saved custom servers for the Connect dialog. Non-secret fields (name, host,
// port, tls) live in localStorage; the server password (IRC PASS — used for ZNC
// and other bouncers, format "user/network:password") is encrypted by RAVE's
// self-contained secret store (secrets.ts), mirroring profiles.ts — not plaintext.

import { secretGet, secretSet, secretDelete } from "./secrets";
import { dedupeById } from "./util";

const SECRET_PREFIX = "serverpw:";
const KEY = "raveirc.savedServers";

export interface SavedServer {
  id: string;
  name: string;
  host: string;
  port: number;
  tls: boolean;
  /** IRC server password (PASS). Blank until fetched from the secret store. */
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
        return dedupeById(
          list.map((s) => ({ ...newServer(), ...s, serverPassword: "" })),
          uid,
        );
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

/** Fetch a single saved server's password from the secret store (lazy). */
export async function loadServerPassword(id: string): Promise<string> {
  return (await secretGet(SECRET_PREFIX + id)) ?? "";
}

/** Write (or clear) a saved server's password in the secret store. */
export async function saveServerPassword(id: string, password: string): Promise<void> {
  await secretSet(SECRET_PREFIX + id, password);
}

/** Remove a saved server's stored password from the secret store. */
export async function deleteServerPassword(id: string): Promise<void> {
  await secretDelete(SECRET_PREFIX + id);
}
