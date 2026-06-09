// Minimal IRCv3 line parser for the web build's browser IRC core. Produces the
// same IrcMessage shape the Rust engine emits, so the store handles web and
// desktop messages identically.

import type { IrcMessage, Prefix } from "./types";

function unescapeTag(v: string): string {
  return v
    .replace(/\\:/g, ";")
    .replace(/\\s/g, " ")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
}

function parsePrefix(raw: string): Prefix {
  let nick: string | null = null;
  let user: string | null = null;
  let host: string | null = null;
  const bang = raw.indexOf("!");
  const at = raw.indexOf("@");
  if (bang !== -1) {
    nick = raw.slice(0, bang);
    if (at !== -1 && at > bang) {
      user = raw.slice(bang + 1, at);
      host = raw.slice(at + 1);
    } else {
      user = raw.slice(bang + 1);
    }
  } else if (at !== -1) {
    nick = raw.slice(0, at);
    host = raw.slice(at + 1);
  } else {
    // A bare servername prefix — leave nick null (callers fall back to raw).
    host = raw;
  }
  return { raw, nick, user, host };
}

/** Parse a single raw IRC line (no trailing CRLF) into an IrcMessage. */
export function parseIrcLine(line: string): IrcMessage {
  let rest = line;
  const tags: Record<string, string> = {};

  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ");
    const tagStr = sp === -1 ? rest.slice(1) : rest.slice(1, sp);
    rest = sp === -1 ? "" : rest.slice(sp + 1);
    for (const t of tagStr.split(";")) {
      if (!t) continue;
      const eq = t.indexOf("=");
      if (eq === -1) tags[t] = "";
      else tags[t.slice(0, eq)] = unescapeTag(t.slice(eq + 1));
    }
  }

  let prefix: Prefix | null = null;
  if (rest.startsWith(":")) {
    const sp = rest.indexOf(" ");
    const praw = sp === -1 ? rest.slice(1) : rest.slice(1, sp);
    rest = sp === -1 ? "" : rest.slice(sp + 1);
    prefix = parsePrefix(praw);
  }

  // Split params; everything after " :" is a single trailing param.
  let trailing: string | null = null;
  let head = rest;
  const tIdx = rest.indexOf(" :");
  if (rest.startsWith(":")) {
    // Whole remainder is trailing (rare: command-less). Handled by head split below.
  } else if (tIdx !== -1) {
    head = rest.slice(0, tIdx);
    trailing = rest.slice(tIdx + 2);
  }
  const parts = head.split(" ").filter(Boolean);
  const command = parts.shift() ?? "";
  const params = parts;
  if (trailing !== null) params.push(trailing);

  return { tags, prefix, command, params };
}
