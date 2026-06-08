// mIRC custom dialogs (dialog definitions, /dialog, /did, $did, on DIALOG).
//
// Pure parsing + state logic; the reactive open-dialog list and the on-event
// dispatch live in the store, and a Svelte component renders the controls.
// Dialogs render in-app (floating panels) since they talk to the engine
// constantly — far simpler/more reliable than a separate OS window.

export interface Control {
  id: number;
  type: string; // text, edit, button, list, combo, check, radio, box, ...
  caption: string;
  x: number;
  y: number;
  w: number;
  h: number;
  options: string;
}

export interface DialogDef {
  name: string;
  title: string;
  w: number;
  h: number;
  controls: Control[];
}

/** Live state of a control in an open dialog. */
export interface CtrlState extends Control {
  text: string;
  items: string[];
  sel: number; // 1-based selected line (0 = none)
  checked: boolean;
  enabled: boolean;
}

export interface OpenDialog {
  name: string;
  title: string;
  w: number;
  h: number;
  controls: CtrlState[];
  x: number;
  y: number;
}

function dequote(s: string): string {
  const t = s.trim();
  return /^".*"$/.test(t) || /^'.*'$/.test(t) ? t.slice(1, -1) : t;
}

/** Parse all `dialog <name> { ... }` definitions from a remote script. */
export function parseDialogs(text: string): Map<string, DialogDef> {
  const defs = new Map<string, DialogDef>();
  const re = /(?:^|\n)\s*dialog\s+(\S+)\s*\{/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    const open = m.index + m[0].length - 1; // index of '{'
    let depth = 0;
    let j = open;
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
    defs.set(name, parseDialogBody(name, body));
    re.lastIndex = j;
  }
  return defs;
}

function parseDialogBody(name: string, body: string): DialogDef {
  const def: DialogDef = { name, title: name, w: 220, h: 160, controls: [] };
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith(";")) continue;
    const sp = line.indexOf(" ");
    const type = (sp === -1 ? line : line.slice(0, sp)).toLowerCase();
    const rest = sp === -1 ? "" : line.slice(sp + 1).trim();

    if (type === "title") {
      def.title = dequote(rest);
      continue;
    }
    if (type === "size") {
      const n = rest.split(/\s+/).map(Number);
      if (n[2]) def.w = n[2];
      if (n[3]) def.h = n[3];
      continue;
    }
    if (["option", "tab", "menu", "icon"].includes(type)) continue;

    const parts = rest.split(",");
    let idx = 0;
    let caption = "";
    const first = (parts[0] ?? "").trim();
    if (/^["']/.test(first)) {
      caption = dequote(first);
      idx = 1;
    }
    const id = parseInt((parts[idx] ?? "0").trim(), 10) || 0;
    idx++;
    const dims = (parts[idx] ?? "").trim().split(/\s+/).map(Number);
    idx++;
    const options = parts.slice(idx).join(",").trim();
    def.controls.push({
      id,
      type,
      caption,
      x: dims[0] || 0,
      y: dims[1] || 0,
      w: dims[2] || 0,
      h: dims[3] || 0,
      options,
    });
  }
  return def;
}

const LIST_TYPES = new Set(["list", "combo"]);

/** Instantiate live control state from a definition. */
export function instantiate(def: DialogDef): OpenDialog {
  return {
    name: def.name,
    title: def.title,
    w: def.w,
    h: def.h,
    x: 0,
    y: 0,
    controls: def.controls.map((c) => ({
      ...c,
      text: c.type === "edit" ? "" : c.caption,
      items: [],
      sel: 0,
      checked: false,
      enabled: true,
    })),
  };
}

/** Apply a /did command to a dialog's control. flags e.g. "a","r","ra","o","c". */
export function applyDid(dlg: OpenDialog, flags: string, id: number, args: string[]) {
  const c = dlg.controls.find((x) => x.id === id);
  if (!c) return;
  const isList = LIST_TYPES.has(c.type);
  const numFirst = parseInt(args[0] ?? "", 10);
  const hasNum = !isNaN(numFirst) && String(numFirst) === (args[0] ?? "").trim();

  if (flags.includes("r")) {
    c.text = "";
    c.items = [];
    c.sel = 0;
  }
  if (flags.includes("a")) {
    const text = args.join(" ");
    if (isList) c.items.push(text);
    else c.text += text;
  }
  if (flags.includes("o")) {
    // /did -o name id N text → overwrite line N (list) or set text
    const n = hasNum ? numFirst : 1;
    const text = (hasNum ? args.slice(1) : args).join(" ");
    if (isList) {
      while (c.items.length < n) c.items.push("");
      c.items[n - 1] = text;
    } else c.text = text;
  }
  if (flags.includes("c")) {
    if (c.type === "check" || c.type === "radio") c.checked = true;
    else if (isList && hasNum) c.sel = numFirst;
  }
  if (flags.includes("u")) c.checked = false;
  if (flags.includes("e")) c.enabled = true;
  if (flags.includes("b")) c.enabled = false;
}

/** Resolve $did(name, id[, N]).prop against an open dialog. */
export function didIdent(dlg: OpenDialog, id: number, args: string[], prop?: string): string {
  const c = dlg.controls.find((x) => x.id === id);
  if (!c) return "";
  const isList = LIST_TYPES.has(c.type);
  // $did(name, id, N) → Nth line of a list
  if (args.length >= 3) {
    const n = parseInt(args[2], 10) || 0;
    return c.items[n - 1] ?? "";
  }
  switch (prop) {
    case undefined:
    case "":
    case "text":
      return isList ? c.items[c.sel - 1] ?? "" : c.text;
    case "sel":
      return String(c.sel || 0);
    case "lines":
      return String(c.items.length);
    case "seltext":
      return c.items[c.sel - 1] ?? "";
    case "state":
      return c.checked ? "1" : "0";
    default:
      return c.text;
  }
}
