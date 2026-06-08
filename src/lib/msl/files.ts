// mIRC file & INI I/O (/write /writeini /remove, $read $readini $lines $isfile).
//
// mSL file identifiers are synchronous, but disk access in Tauri is async — so
// files live in an in-memory cache served synchronously, with an optional `io`
// hook that persists changes to disk in the background (wired by the store to
// the app-data dir; cross-platform). `preload()` seeds the cache at startup.

import { wildMatch } from "./eval";

export interface FileIO {
  save(name: string, content: string): void;
  remove(name: string): void;
}

/** Normalize any path/filename to a sandbox key (basename, lower-case). */
function baseName(name: string): string {
  return (name.split(/[\\/]/).pop() ?? name).toLowerCase();
}

function splitLines(content: string): string[] {
  return content === "" ? [] : content.split("\n");
}

export class FileStore {
  private files = new Map<string, string>();
  constructor(private io?: FileIO) {}

  /** Seed the cache from persisted storage (called once at startup). */
  preload(entries: [string, string][]) {
    for (const [n, c] of entries) this.files.set(baseName(n), c);
  }

  private persist(key: string) {
    this.io?.save(key, this.files.get(key) ?? "");
  }

  /** Handle /write, /writeini, /remove. Returns true if handled. */
  command(name: string, rest: string): boolean {
    switch (name) {
      case "write":
        this.write(rest);
        return true;
      case "writeini":
        this.writeIni(rest);
        return true;
      case "remove": {
        const key = baseName(rest.trim());
        this.files.delete(key);
        this.io?.remove(key);
        return true;
      }
      default:
        return false;
    }
  }

  /** Handle $read, $readini, $lines, $isfile. Returns value, or null. */
  ident(name: string, args: string[], _prop?: string): string | null {
    switch (name) {
      case "read":
        return this.read(args);
      case "readini":
        return this.readIni(args[0] ?? "", args[1] ?? "", args[2] ?? "");
      case "lines":
        return String(splitLines(this.files.get(baseName(args[0] ?? "")) ?? "").length);
      case "isfile":
      case "exists":
        return this.files.has(baseName(args[0] ?? "")) ? "$true" : "$false";
      default:
        return null;
    }
  }

  // ---- /write -------------------------------------------------------------
  private write(rest: string) {
    let r = rest.trim();
    let mode = "a";
    let lineNo = 0;
    // leading switches: -c clear, -l<N> overwrite, -i<N> insert, -d<N> delete
    const fm = /^-([a-z]+)(\d*)\s+/.exec(r);
    if (fm) {
      const f = fm[1];
      if (fm[2]) lineNo = parseInt(fm[2], 10);
      if (f.includes("c")) mode = "c";
      else if (f.includes("l")) mode = "l";
      else if (f.includes("i")) mode = "i";
      else if (f.includes("d")) mode = "d";
      r = r.slice(fm[0].length);
    }
    const sp = r.indexOf(" ");
    const file = sp === -1 ? r : r.slice(0, sp);
    const text = sp === -1 ? "" : r.slice(sp + 1);
    const key = baseName(file);
    const lines = splitLines(this.files.get(key) ?? "");

    switch (mode) {
      case "c":
        this.files.set(key, text);
        this.persist(key);
        return;
      case "l":
        while (lines.length < lineNo) lines.push("");
        if (lineNo > 0) lines[lineNo - 1] = text;
        break;
      case "i":
        lines.splice(Math.max(0, lineNo - 1), 0, text);
        break;
      case "d":
        if (lineNo > 0 && lineNo <= lines.length) lines.splice(lineNo - 1, 1);
        break;
      default: // append
        lines.push(text);
    }
    this.files.set(key, lines.join("\n"));
    this.persist(key);
  }

  // ---- $read --------------------------------------------------------------
  private read(args: string[]): string {
    const content = this.files.get(baseName(args[0] ?? "")) ?? "";
    const lines = splitLines(content);
    if (lines.length === 0) return "";
    // $read(file, w, wildcard) / $read(file, s, text): search
    if ((args[1] === "w" || args[1] === "s") && args[2] !== undefined) {
      const pat = args[2];
      const hit = lines.find((l) => (args[1] === "w" ? wildMatch(pat, l) : l.startsWith(pat)));
      return hit ?? "";
    }
    const n = parseInt(args[1] ?? "", 10);
    if (!isNaN(n)) return n === 0 ? String(lines.length) : lines[n - 1] ?? "";
    // no index → random line (first line if RNG unavailable, e.g. in tests)
    const r = typeof Math.random === "function" ? Math.random() : 0;
    return lines[Math.floor(r * lines.length)] ?? lines[0];
  }

  // ---- INI ----------------------------------------------------------------
  private readIni(file: string, section: string, item: string): string {
    const lines = splitLines(this.files.get(baseName(file)) ?? "");
    let inSec = false;
    for (const ln of lines) {
      const sm = /^\s*\[(.+)\]\s*$/.exec(ln);
      if (sm) {
        inSec = sm[1].toLowerCase() === section.toLowerCase();
        continue;
      }
      if (inSec) {
        const eq = ln.indexOf("=");
        if (eq >= 0 && ln.slice(0, eq).trim().toLowerCase() === item.toLowerCase()) {
          return ln.slice(eq + 1);
        }
      }
    }
    return "";
  }

  private writeIni(rest: string) {
    const m = /^(\S+)\s+(\S+)\s+(\S+)\s*([\s\S]*)$/.exec(rest.trim());
    if (!m) return;
    const [, file, section, item, value] = m;
    const key = baseName(file);
    const lines = splitLines(this.files.get(key) ?? "");
    let secStart = -1;
    let secEnd = lines.length;
    for (let i = 0; i < lines.length; i++) {
      const sm = /^\s*\[(.+)\]\s*$/.exec(lines[i]);
      if (sm) {
        if (sm[1].toLowerCase() === section.toLowerCase()) secStart = i;
        else if (secStart >= 0) {
          secEnd = i;
          break;
        }
      }
    }
    if (secStart === -1) {
      // new section at end
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      lines.push(`[${section}]`, `${item}=${value}`);
    } else {
      // replace existing item in section, or append within it
      let replaced = false;
      for (let i = secStart + 1; i < secEnd; i++) {
        const eq = lines[i].indexOf("=");
        if (eq >= 0 && lines[i].slice(0, eq).trim().toLowerCase() === item.toLowerCase()) {
          lines[i] = `${item}=${value}`;
          replaced = true;
          break;
        }
      }
      if (!replaced) lines.splice(secEnd, 0, `${item}=${value}`);
    }
    this.files.set(key, lines.join("\n"));
    this.persist(key);
  }
}
