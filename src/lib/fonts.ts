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
