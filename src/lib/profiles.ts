// Saved identity profiles (nick + full user details + which networks they suit).
// Persisted in localStorage so they're editable offline and survive restarts.

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

export function loadProfiles(): NickProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as NickProfile[];
      // Backfill any fields missing from profiles saved before they existed.
      return list.map((p) => ({ ...newProfile(), ...p }));
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveProfiles(list: NickProfile[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
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
