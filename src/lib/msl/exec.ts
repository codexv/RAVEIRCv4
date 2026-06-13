// mSL command executor: parses an alias/event body into statements and runs
// them — control flow (if/elseif/else, while), conditions, and leaf commands.

import { evalString, evalBrackets, wildMatch, type EvalCtx } from "./eval";

/** Side-effect host the interpreter drives (wired to the IRC store). */
export interface MslHost {
  /** Send a raw IRC line. */
  sendRaw(line: string): void;
  /** Echo text to the user's active window. */
  echo(text: string): void;
  /** Send a PRIVMSG and echo it locally (like mIRC). Falls back to sendRaw. */
  message?(target: string, text: string): void;
  /** Send a NOTICE and echo it locally (like mIRC). Falls back to sendRaw. */
  notice?(target: string, text: string): void;
  /** Send a CTCP ACTION (/me, /describe) and echo it locally. */
  action?(target: string, text: string): void;
  /**
   * Resolve a live (host-backed) identifier the built-ins/aliases don't cover —
   * $network, $server, $comchan, $ial, $chan, $nick, $hget, $read, … Returns
   * the value, or null if this host doesn't handle it. Optional.
   */
  ident?(name: string, args: string[], prop?: string): string | null;
  /** Run a host-backed command (/hadd, /write, /sockread, …). Returns true if handled. */
  command?(name: string, args: string, ctx: EvalCtx): boolean;
}

type Stmt =
  | { k: "cmd"; text: string }
  | { k: "if"; branches: { cond: string; body: Stmt[] }[]; els?: Stmt[] }
  | { k: "while"; cond: string; body: Stmt[] };

const MAX_LOOPS = 100000; // while-loop guard

// ---- body tokenizing + parsing --------------------------------------------

/** Split a body into tokens: "{", "}", or statement strings. */
function tokenizeBody(text: string): string[] {
  const toks: string[] = [];
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t && !t.startsWith(";")) toks.push(t);
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{" || c === "}") {
      flush();
      toks.push(c);
    } else if (c === "\n" || c === "|") {
      flush();
    } else {
      buf += c;
    }
  }
  flush();
  return toks;
}

/** Parse a token list into statements until the matching "}" (or end). */
function parseStmts(toks: string[], start: number): { stmts: Stmt[]; next: number } {
  const stmts: Stmt[] = [];
  let i = start;
  while (i < toks.length) {
    const t = toks[i];
    if (t === "}") return { stmts, next: i + 1 };

    const ifm = /^if\s*\((.*)\)\s*$/i.exec(t);
    const whm = /^while\s*\((.*)\)\s*$/i.exec(t);
    if (ifm) {
      i++; // consume "if (...)"
      if (toks[i] === "{") i++;
      const then = parseStmts(toks, i);
      const branches = [{ cond: ifm[1], body: then.stmts }];
      i = then.next;
      let els: Stmt[] | undefined;
      // chains of "elseif (...)" then optional "else"
      while (i < toks.length) {
        const ei = /^elseif\s*\((.*)\)\s*$/i.exec(toks[i]);
        if (ei) {
          i++;
          if (toks[i] === "{") i++;
          const b = parseStmts(toks, i);
          branches.push({ cond: ei[1], body: b.stmts });
          i = b.next;
        } else if (/^else\s*$/i.test(toks[i])) {
          i++;
          if (toks[i] === "{") i++;
          const b = parseStmts(toks, i);
          els = b.stmts;
          i = b.next;
          break;
        } else break;
      }
      stmts.push({ k: "if", branches, els });
    } else if (whm) {
      i++;
      if (toks[i] === "{") i++;
      const b = parseStmts(toks, i);
      stmts.push({ k: "while", cond: whm[1], body: b.stmts });
      i = b.next;
    } else if (t === "{") {
      i++; // stray brace
    } else {
      stmts.push({ k: "cmd", text: t });
      i++;
    }
  }
  return { stmts, next: i };
}

export function parseBody(text: string): Stmt[] {
  return parseStmts(tokenizeBody(text), 0).stmts;
}

// ---- conditions ------------------------------------------------------------

export function evalCond(text: string, ctx: EvalCtx): boolean {
  const ev = evalString(text, ctx);
  // OR has lowest precedence, then AND.
  return ev
    .split("||")
    .some((or) => or.split("&&").every((and) => evalAtom(and.trim(), ctx)));
}

function evalAtom(s: string, ctx: EvalCtx): boolean {
  if (s === "") return false;
  const parts = s.split(/\s+/);
  if (parts.length === 1) return truthy(parts[0]);
  const [lhs, op] = parts;
  const rhs = parts.slice(2).join(" ");
  const n = (x: string) => parseFloat(x) || 0;
  switch (op.toLowerCase()) {
    case "==":
      return lhs.toLowerCase() === rhs.toLowerCase();
    case "!=":
      return lhs.toLowerCase() !== rhs.toLowerCase();
    case "<":
      return n(lhs) < n(rhs);
    case ">":
      return n(lhs) > n(rhs);
    case "<=":
      return n(lhs) <= n(rhs);
    case ">=":
      return n(lhs) >= n(rhs);
    case "isin":
      return rhs.toLowerCase().includes(lhs.toLowerCase());
    case "isincs":
      return rhs.includes(lhs);
    case "iswm":
      return wildMatch(rhs, lhs);
    case "isnum":
      return /^\d+$/.test(lhs);
    default:
      return truthy(s);
  }
  void ctx;
}

function truthy(v: string): boolean {
  return v === "$true" || (v !== "" && v !== "$false" && v !== "0");
}

// ---- execution -------------------------------------------------------------

type Signal = "normal" | "halt" | "return";

export function execBody(stmts: Stmt[], ctx: EvalCtx, host: MslHost): Signal {
  for (const st of stmts) {
    const sig = execStmt(st, ctx, host);
    if (sig !== "normal") return sig;
  }
  return "normal";
}

function execStmt(st: Stmt, ctx: EvalCtx, host: MslHost): Signal {
  if (st.k === "if") {
    for (const br of st.branches) {
      if (evalCond(br.cond, ctx)) return execBody(br.body, ctx, host);
    }
    return st.els ? execBody(st.els, ctx, host) : "normal";
  }
  if (st.k === "while") {
    let guard = 0;
    while (evalCond(st.cond, ctx)) {
      if (++guard > MAX_LOOPS) break;
      const sig = execBody(st.body, ctx, host);
      if (sig !== "normal") return sig;
    }
    return "normal";
  }
  return runCommand(st.text, ctx, host);
}

/** Execute a single leaf command line. */
export function runCommand(rawLine: string, ctx: EvalCtx, host: MslHost): Signal {
  const line = rawLine.trim();
  if (!line || line.startsWith(";")) return "normal";

  const sp = line.indexOf(" ");
  let cmd = (sp === -1 ? line : line.slice(0, sp)).toLowerCase();
  const rawRest = sp === -1 ? "" : line.slice(sp + 1);
  if (cmd.startsWith("/")) cmd = cmd.slice(1);
  if (cmd.startsWith(".")) cmd = cmd.slice(1); // silent prefix

  // Variable commands: the var NAME is only [ ]-evaluated (for dynamic names like
  // `%u. [ $+ [ $nick ] ]`), not fully evaluated; the value is fully evaluated.
  switch (cmd) {
    case "set": {
      const r = rawRest.includes("[") ? evalBrackets(rawRest, ctx) : rawRest;
      const m = /^%(\S+)\s*(.*)$/.exec(r);
      if (m) ctx.vars.set(m[1].toLowerCase(), evalString(m[2], ctx));
      return "normal";
    }
    case "var": {
      const r = rawRest.includes("[") ? evalBrackets(rawRest, ctx) : rawRest;
      const m = /^%(\S+)\s*=?\s*(.*)$/.exec(r);
      if (m) ctx.local.set(m[1].toLowerCase(), evalString(m[2], ctx));
      return "normal";
    }
    case "unset": {
      const r = rawRest.includes("[") ? evalBrackets(rawRest, ctx) : rawRest;
      const m = /^%(\S+)/.exec(r);
      if (m) {
        ctx.vars.delete(m[1].toLowerCase());
        ctx.local.delete(m[1].toLowerCase());
      }
      return "normal";
    }
    case "inc":
    case "dec": {
      const r = rawRest.includes("[") ? evalBrackets(rawRest, ctx) : rawRest;
      const m = /^%(\S+)\s*(.*)$/.exec(r);
      if (m) {
        const name = m[1].toLowerCase();
        const by = parseFloat(evalString(m[2], ctx) || "1") || 1;
        const cur = parseFloat(ctx.vars.get(name) ?? "0") || 0;
        ctx.vars.set(name, String(cmd === "inc" ? cur + by : cur - by));
      }
      return "normal";
    }
  }

  // Everything else: evaluate the args, then dispatch.
  const rest = evalString(rawRest, ctx);
  return dispatch(cmd, rest, ctx, host);
}

function dispatch(cmd: string, rest: string, ctx: EvalCtx, host: MslHost): Signal {
  const first = rest.split(" ")[0] ?? "";
  const after = rest.slice(first.length).trim();
  switch (cmd) {
    case "halt":
    case "haltdef":
      return "halt";
    case "return":
      // `return [value]` stops the alias; the value is read by alias-as-identifier.
      ctx.returnValue = rest;
      return "return";
    case "echo": {
      // /echo [-flags] [@window|#chan] text — strip flags + an explicit window
      // target (we always echo to the active window), keep the rest verbatim.
      // The flag may be the whole argument (e.g. `echo -a` → a blank line).
      const t = rest.replace(/^(-\S+(?:\s+|$))+/, "").replace(/^([@#]\S+)\s+/, "");
      host.echo(t);
      return "normal";
    }
    case "say":
      if (host.message) host.message(ctx.chan || ctx.target, rest);
      else host.sendRaw(`PRIVMSG ${ctx.chan || ctx.target} :${rest}`);
      return "normal";
    case "msg":
      if (host.message) host.message(first, after);
      else host.sendRaw(`PRIVMSG ${first} :${after}`);
      return "normal";
    case "notice":
      if (host.notice) host.notice(first, after);
      else host.sendRaw(`NOTICE ${first} :${after}`);
      return "normal";
    case "describe":
      if (host.action) host.action(first, after);
      else host.sendRaw(`PRIVMSG ${first} :ACTION ${after}`);
      return "normal";
    case "me":
      if (host.action) host.action(ctx.chan || ctx.target, rest);
      else host.sendRaw(`PRIVMSG ${ctx.chan || ctx.target} :ACTION ${rest}`);
      return "normal";
    case "kick":
      host.sendRaw(`KICK ${first} ${after}`);
      return "normal";
    case "mode":
      host.sendRaw(`MODE ${rest}`);
      return "normal";
    case "ban":
      host.sendRaw(`MODE ${first} +b ${after}`);
      return "normal";
    case "join":
    case "part":
    case "topic":
    case "invite":
    case "whois":
    case "nick":
    case "quit":
      host.sendRaw(`${cmd.toUpperCase()} ${rest}`.trim());
      return "normal";
    case "raw":
    case "quote":
      host.sendRaw(rest);
      return "normal";
    default:
      // Host-backed commands (/hadd, /amsg, /write, /sockread, …) get first refusal.
      if (host.command && host.command(cmd, rest, ctx)) return "normal";
      // Unknown command: pass through as raw (mIRC-ish) so e.g. /cs works.
      host.sendRaw(`${cmd.toUpperCase()} ${rest}`.trim());
      return "normal";
  }
}
