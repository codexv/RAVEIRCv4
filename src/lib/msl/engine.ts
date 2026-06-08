// mSL engine: loads aliases/events/variables, runs aliases on /command, and
// dispatches IRC events to matching `on` handlers.

import { emptyCtx, wildMatch, type EvalCtx } from "./eval";
import { execBody, parseBody, type MslHost } from "./exec";
import { parseScript, parseVars, type EventDef } from "./parser";

export interface EventData {
  me: string;
  nick: string;
  chan: string;
  target: string;
  address: string;
  /** Message text (for TEXT/ACTION/NOTICE), or reason (KICK/QUIT/PART). */
  text?: string;
  /** Kicked nick (KICK). */
  knick?: string;
  /** New nick (NICK). */
  newnick?: string;
}

export class MslEngine {
  private aliases = new Map<string, string>();
  private events: EventDef[] = [];
  /** Global %variables (persist across runs). */
  vars = new Map<string, string>();

  /** Load the user's aliases, remote script, and variables sections. */
  load(aliasesText: string, remoteText: string, varsText: string) {
    this.aliases.clear();
    this.events = [];
    for (const src of [aliasesText, remoteText]) {
      const parsed = parseScript(src);
      for (const [name, def] of parsed.aliases) this.aliases.set(name, def.body);
      this.events.push(...parsed.events);
    }
    this.vars = parseVars(varsText);
  }

  /** Serialize variables back to the "%name value" section format. */
  serializeVars(): string {
    return [...this.vars.entries()].map(([k, v]) => `%${k} ${v}`).join("\n");
  }

  hasAlias(name: string): boolean {
    return this.aliases.has(name.toLowerCase());
  }

  private ctx(data: Partial<EventData>, params: string[]): EvalCtx {
    return emptyCtx({
      params,
      me: data.me ?? "",
      nick: data.nick ?? "",
      chan: data.chan ?? "",
      target: data.target ?? data.chan ?? "",
      address: data.address ?? "",
      knick: data.knick,
      newnick: data.newnick,
      vars: this.vars,
      local: new Map(),
    });
  }

  /** Run a user alias by name with a parameter string. Returns false if none. */
  runAlias(name: string, paramStr: string, data: EventData, host: MslHost): boolean {
    const body = this.aliases.get(name.toLowerCase());
    if (body === undefined) return false;
    const params = paramStr.length ? paramStr.split(" ") : [];
    execBody(parseBody(body), this.ctx(data, params), host);
    return true;
  }

  /**
   * Dispatch a raw numeric to `raw <n>:<match>:` handlers. `params` are the
   * numeric's parameters ($1 = first param, as in mIRC raw events). Returns
   * true if any handler called haltdef/halt (suppress the default display).
   */
  dispatchRaw(numeric: string, params: string[], data: EventData, host: MslHost): boolean {
    let halted = false;
    for (const def of this.events) {
      if (def.event !== "RAW") continue;
      const numSpec = def.fields[0] ?? "*";
      if (numSpec !== "*" && numSpec !== numeric) continue;
      const match = def.fields[1] ?? "*";
      if (match !== "*" && !wildMatch(match, params.join(" "))) continue;
      if (execBody(parseBody(def.body), this.ctx(data, params), host) === "halt") halted = true;
    }
    return halted;
  }

  /** Dispatch an IRC event to all matching `on` handlers. */
  dispatch(event: string, data: EventData, host: MslHost) {
    const ev = event.toUpperCase();
    for (const def of this.events) {
      if (def.event !== ev) continue;
      if (!this.eventMatches(def, data)) continue;
      // For text events, $1- is the message; otherwise params come from text.
      const params = (data.text ?? "").length ? data.text!.split(" ") : [];
      execBody(parseBody(def.body), this.ctx(data, params), host);
    }
  }

  /** Check an event handler's match text and channel filter against the data. */
  private eventMatches(def: EventDef, data: EventData): boolean {
    // Channel filter is the last field; match text (TEXT/ACTION/NOTICE) precedes it.
    const fields = def.fields;
    let chanFilter = "*";
    let matchText: string | null = null;

    if (["TEXT", "ACTION", "NOTICE"].includes(def.event)) {
      matchText = fields[0] ?? "*";
      chanFilter = fields[1] ?? "*";
    } else {
      chanFilter = fields[0] ?? "*";
    }

    // Match text against the message (wildcard, case-insensitive).
    if (matchText !== null && matchText !== "*") {
      if (!wildMatch(matchText, data.text ?? "")) return false;
    }

    // Channel filter: "#" = any channel, "?" = query, "*" = anywhere, or a name.
    const chan = data.chan ?? "";
    if (chanFilter === "*" || chanFilter === "") return true;
    if (chanFilter === "#") return chan.startsWith("#");
    if (chanFilter === "?") return !chan.startsWith("#");
    return chan.toLowerCase() === chanFilter.toLowerCase();
  }
}
