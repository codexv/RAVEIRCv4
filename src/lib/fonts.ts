// Per-window font overrides set with /font in a channel/query, keyed by
// channelKey ("network/#chan") so a window keeps its font across reconnects
// and restarts. The chat view (MessageView) reads Buffer.font and overrides
// its --mono / --msg-size locally.

export interface BufferFont {
  /** CSS font-family (raw name, e.g. "Courier New"). */
  family?: string;
  /** Point size in px. */
  size?: number;
}

/** Font faces offered by the /font picker. `value` is the CSS family ("" = theme
 *  default). Many of these are OS-dependent; unavailable ones fall back gracefully. */
export const FONT_CHOICES: { label: string; value: string; group: string }[] = [
  { label: "Default (theme)", value: "", group: "Default" },
  // Monospace — best for aligned chat.
  { label: "Menlo", value: "Menlo", group: "Monospace" },
  { label: "Monaco", value: "Monaco", group: "Monospace" },
  { label: "Consolas", value: "Consolas", group: "Monospace" },
  { label: "Cascadia Code", value: "Cascadia Code", group: "Monospace" },
  { label: "Cascadia Mono", value: "Cascadia Mono", group: "Monospace" },
  { label: "Courier New", value: "Courier New", group: "Monospace" },
  { label: "Lucida Console", value: "Lucida Console", group: "Monospace" },
  { label: "DejaVu Sans Mono", value: "DejaVu Sans Mono", group: "Monospace" },
  { label: "Liberation Mono", value: "Liberation Mono", group: "Monospace" },
  { label: "Ubuntu Mono", value: "Ubuntu Mono", group: "Monospace" },
  { label: "Fira Code", value: "Fira Code", group: "Monospace" },
  { label: "Fira Mono", value: "Fira Mono", group: "Monospace" },
  { label: "JetBrains Mono", value: "JetBrains Mono", group: "Monospace" },
  { label: "Source Code Pro", value: "Source Code Pro", group: "Monospace" },
  { label: "IBM Plex Mono", value: "IBM Plex Mono", group: "Monospace" },
  { label: "Roboto Mono", value: "Roboto Mono", group: "Monospace" },
  { label: "Inconsolata", value: "Inconsolata", group: "Monospace" },
  { label: "Space Mono", value: "Space Mono", group: "Monospace" },
  { label: "PT Mono", value: "PT Mono", group: "Monospace" },
  { label: "SF Mono", value: "SF Mono", group: "Monospace" },
  { label: "Andale Mono", value: "Andale Mono", group: "Monospace" },
  // Sans-serif.
  { label: "Inter", value: "Inter", group: "Sans-serif" },
  { label: "System UI", value: "system-ui", group: "Sans-serif" },
  { label: "Helvetica", value: "Helvetica", group: "Sans-serif" },
  { label: "Arial", value: "Arial", group: "Sans-serif" },
  { label: "Segoe UI", value: "Segoe UI", group: "Sans-serif" },
  { label: "Roboto", value: "Roboto", group: "Sans-serif" },
  { label: "Verdana", value: "Verdana", group: "Sans-serif" },
  { label: "Tahoma", value: "Tahoma", group: "Sans-serif" },
  { label: "Trebuchet MS", value: "Trebuchet MS", group: "Sans-serif" },
  { label: "Calibri", value: "Calibri", group: "Sans-serif" },
  { label: "Ubuntu", value: "Ubuntu", group: "Sans-serif" },
  { label: "Noto Sans", value: "Noto Sans", group: "Sans-serif" },
  // Serif.
  { label: "Georgia", value: "Georgia", group: "Serif" },
  { label: "Times New Roman", value: "Times New Roman", group: "Serif" },
  { label: "Garamond", value: "Garamond", group: "Serif" },
  { label: "Palatino", value: "Palatino", group: "Serif" },
  { label: "Cambria", value: "Cambria", group: "Serif" },
  { label: "Courier", value: "Courier", group: "Serif" },
];

const KEY = "raveirc.bufferFonts";

export function loadBufferFonts(): Record<string, BufferFont> {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? "");
    if (r && typeof r === "object" && !Array.isArray(r)) return r;
  } catch {
    /* ignore */
  }
  return {};
}

export function saveBufferFonts(map: Record<string, BufferFont>) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

/** Build an inline style overriding --mono / --msg-size for a buffer's font. */
export function fontStyle(f?: BufferFont): string {
  if (!f) return "";
  const parts: string[] = [];
  if (f.family) {
    // Quote multi-word families; always keep a monospace fallback.
    const fam = /\s/.test(f.family) && !/["',]/.test(f.family) ? `"${f.family}"` : f.family;
    parts.push(`--mono:${fam}, ui-monospace, monospace`);
  }
  if (f.size) parts.push(`--msg-size:${f.size}px`);
  return parts.join(";");
}
