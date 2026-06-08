// Parse a remote script into aliases and `on` event handlers.

export interface AliasDef {
  name: string;
  /** Inline command (one-liner) or block body. */
  body: string;
}

export interface EventDef {
  level: string; // the part after "on " before the first ':'
  event: string; // TEXT, JOIN, PART, ...
  fields: string[]; // remaining colon fields (event-specific: matchtext, chans)
  body: string;
}

export interface ParsedScript {
  aliases: Map<string, AliasDef>;
  events: EventDef[];
}

interface Item {
  header: string;
  body: string | null; // null = one-liner (header carries the command)
}

/** Split script text into top-level items (header + optional {block}). */
function splitItems(text: string): Item[] {
  const items: Item[] = [];
  let header = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "{") {
      // capture balanced block
      let depth = 0;
      let j = i;
      let body = "";
      for (; j < text.length; j++) {
        const ch = text[j];
        if (ch === "{") {
          depth++;
          if (depth === 1) continue;
        } else if (ch === "}") {
          depth--;
          if (depth === 0) break;
        }
        body += ch;
      }
      items.push({ header: header.trim(), body });
      header = "";
      i = j + 1;
    } else if (c === "\n") {
      const h = header.trim();
      if (h && !h.startsWith(";")) items.push({ header: h, body: null });
      header = "";
      i++;
    } else {
      header += c;
      i++;
    }
  }
  const h = header.trim();
  if (h && !h.startsWith(";")) items.push({ header: h, body: null });
  return items;
}

export function parseScript(text: string): ParsedScript {
  const aliases = new Map<string, AliasDef>();
  const events: EventDef[] = [];

  for (const item of splitItems(text)) {
    const head = item.header;
    if (/^alias\b/i.test(head)) {
      // alias [-l] name [inline-command]
      const m = /^alias\s+(?:-l\s+)?(\S+)\s*(.*)$/i.exec(head);
      if (!m) continue;
      const name = m[1].toLowerCase();
      const body = item.body !== null ? item.body : m[2];
      aliases.set(name, { name, body });
    } else if (/^on\b/i.test(head)) {
      // on <level>:<EVENT>:<field>:<field>:
      const rest = head.replace(/^on\s+/i, "");
      const fields = rest.split(":");
      const level = fields.shift() ?? "*";
      const event = (fields.shift() ?? "").toUpperCase();
      // drop a trailing empty field from the trailing ':'
      while (fields.length && fields[fields.length - 1] === "") fields.pop();
      if (event) {
        events.push({ level, event, fields, body: item.body ?? "" });
      }
    } else if (/^raw\b/i.test(head)) {
      // raw <numeric>:<matchtext>:  → event "RAW", fields [numeric, matchtext]
      const rest = head.replace(/^raw\s+/i, "");
      const fields = rest.split(":");
      const numeric = fields.shift() ?? "*";
      while (fields.length && fields[fields.length - 1] === "") fields.pop();
      const match = fields.shift() ?? "*";
      events.push({ level: "*", event: "RAW", fields: [numeric, match], body: item.body ?? "" });
    } else if (/^ctcp\b/i.test(head)) {
      const rest = head.replace(/^ctcp\s+/i, "");
      const fields = rest.split(":");
      const level = fields.shift() ?? "*";
      const name = (fields.shift() ?? "").toUpperCase();
      while (fields.length && fields[fields.length - 1] === "") fields.pop();
      events.push({ level, event: "CTCP", fields: [name, ...fields], body: item.body ?? "" });
    }
    // menu/dialog and other constructs are ignored (not yet supported).
  }

  return { aliases, events };
}

/** Parse a variables section ("%name value" or "name value" per line). */
export function parseVars(text: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith(";")) continue;
    const m = /^%?(\S+)\s+(.*)$/.exec(line);
    if (m) vars.set(m[1].toLowerCase(), m[2]);
  }
  return vars;
}
