// mIRC hash tables (/hmake /hadd /hdel /hfree /hinc /hdec, $hget, $hfind).
//
// In-memory, session-scoped (like mIRC before /hsave). Pure and cross-platform;
// plugs into the engine via MslHost.command (the /h* commands) and
// MslHost.ident ($hget/$hfind). /hsave/.hload to disk arrive with file I/O.

import { wildMatch } from "./eval";

export class HashStore {
  private tables = new Map<string, Map<string, string>>();

  private tbl(name: string, create = false): Map<string, string> | undefined {
    const k = name.toLowerCase();
    let t = this.tables.get(k);
    if (!t && create) {
      t = new Map();
      this.tables.set(k, t);
    }
    return t;
  }

  /** Handle a /h* command. Returns true if it was a hash command. */
  command(name: string, rest: string): boolean {
    switch (name) {
      case "hmake": {
        const tbl = rest.trim().split(/\s+/)[0];
        if (tbl) this.tbl(tbl, true);
        return true;
      }
      case "hfree": {
        this.tables.delete(rest.trim().toLowerCase());
        return true;
      }
      case "hadd": {
        // /hadd [-flags] <table> <item> <data...>  (flags like -m/-z ignored)
        const r = rest.replace(/^-\S+\s+/, "").trim();
        const m = /^(\S+)\s+(\S+)\s*([\s\S]*)$/.exec(r);
        if (m) this.tbl(m[1], true)!.set(m[2], m[3]);
        return true;
      }
      case "hdel": {
        const m = /^(\S+)(?:\s+(\S+))?/.exec(rest.trim());
        if (m) {
          const t = this.tbl(m[1]);
          if (t) m[2] ? t.delete(m[2]) : t.clear();
        }
        return true;
      }
      case "hinc":
      case "hdec": {
        const m = /^(?:-\S+\s+)?(\S+)\s+(\S+)\s*(\S*)$/.exec(rest.trim());
        if (m) {
          const t = this.tbl(m[1], true)!;
          const by = parseFloat(m[3] || "1") || 1;
          const cur = parseFloat(t.get(m[2]) ?? "0") || 0;
          t.set(m[2], String(name === "hinc" ? cur + by : cur - by));
        }
        return true;
      }
      default:
        return false;
    }
  }

  /** Handle $hget / $hfind. Returns the value, or null if not a hash identifier. */
  ident(name: string, args: string[], prop?: string): string | null {
    if (name === "hget") return this.hget(args, prop);
    if (name === "hfind") return this.hfind(args, prop);
    return null;
  }

  private hget(args: string[], prop?: string): string {
    const tbl = args[0] ?? "";
    if (args.length < 2) {
      // $hget(N) → Nth table name / count; $hget(name).size → entry count.
      const n = parseInt(tbl, 10);
      if (!isNaN(n) && String(n) === tbl.trim()) {
        const names = [...this.tables.keys()];
        return n === 0 ? String(names.length) : names[n - 1] ?? "";
      }
      const t = this.tbl(tbl);
      if (prop === "size") return String(t?.size ?? 0);
      return t ? tbl : "";
    }
    const t = this.tbl(tbl);
    if (!t) return "";
    // $hget(table, N).item / .data → Nth entry by index.
    if (prop === "item" || prop === "data") {
      const idx = parseInt(args[1], 10) || 0;
      const e = [...t.entries()][idx - 1];
      if (!e) return "";
      return prop === "item" ? e[0] : e[1];
    }
    // $hget(table, item) → data.
    return t.get(args[1]) ?? "";
  }

  private hfind(args: string[], prop?: string): string {
    const t = this.tbl(args[0] ?? "");
    if (!t) return "0";
    const pat = args[1] ?? "";
    const n = parseInt(args[2] ?? "1", 10);
    const opt = (args[3] ?? "").toLowerCase();
    const byData = prop === "data"; // $hfind(...).data searches data, else item names
    let count = 0;
    for (const [item, data] of t.entries()) {
      const hay = byData ? data : item;
      const hit = opt.includes("r") ? tryRe(pat, hay) : wildMatch(pat, hay);
      if (hit) {
        count++;
        if (n !== 0 && count === n) return item;
      }
    }
    return n === 0 ? String(count) : "";
  }
}

function tryRe(pat: string, text: string): boolean {
  try {
    const m = /^\/(.*)\/([a-z]*)$/i.exec(pat);
    return m ? new RegExp(m[1], m[2]).test(text) : new RegExp(pat, "i").test(text);
  } catch {
    return false;
  }
}
