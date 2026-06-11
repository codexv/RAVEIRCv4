// User-customizable appearance (fonts, size, accent, theme), applied by setting
// CSS custom properties on :root and persisted to localStorage. Pure
// presentation — no backend round-trip needed.

export type ThemeId = "black" | "charcoal" | "midnight" | "light";

interface Theme {
  label: string;
  /** True for light backgrounds — flips text colours for readability. */
  light?: boolean;
  bg: string;
  panel: string;
  border: string;
  hover: string;
  /** Base text colours (foreground / dim / faint). */
  fg: string;
  fgDim: string;
  fgFaint: string;
}

// Dark themes share the same readable light-on-dark text palette.
const DARK_FG = { fg: "#e6edf3", fgDim: "#adbac7", fgFaint: "#6e7681" };

export const THEMES: Record<ThemeId, Theme> = {
  black: { label: "Black", bg: "#000000", panel: "#0c0e12", border: "#20262e", hover: "#15191f", ...DARK_FG },
  charcoal: { label: "Charcoal", bg: "#14161a", panel: "#1c1f25", border: "#2c313a", hover: "#23272e", ...DARK_FG },
  midnight: { label: "Midnight", bg: "#0d1117", panel: "#161b22", border: "#30363d", hover: "#1f262e", ...DARK_FG },
  light: {
    label: "Light",
    light: true,
    bg: "#ffffff",
    panel: "#f6f8fa",
    border: "#d0d7de",
    hover: "#eaeef2",
    fg: "#1f2328",
    fgDim: "#57606a",
    fgFaint: "#8c959f",
  },
};

export const UI_FONTS: { label: string; value: string }[] = [
  { label: "System", value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: "Inter (bundled)", value: '"Inter", system-ui, sans-serif' },
  { label: "Sans", value: 'Helvetica, Arial, sans-serif' },
  { label: "Helvetica", value: 'Helvetica, Arial, sans-serif' },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Segoe UI", value: '"Segoe UI", system-ui, sans-serif' },
  { label: "Roboto", value: "Roboto, system-ui, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: "Calibri", value: "Calibri, Candara, Segoe, sans-serif" },
  { label: "Serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Palatino", value: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];

export const MONO_FONTS: { label: string; value: string }[] = [
  { label: "System Mono", value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  { label: "SF Mono", value: '"SF Mono", ui-monospace, Menlo, monospace' },
  { label: "Menlo", value: "Menlo, monospace" },
  { label: "Monaco", value: "Monaco, monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "Cascadia Code", value: '"Cascadia Code", "Cascadia Mono", Consolas, monospace' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "Lucida Console", value: '"Lucida Console", Monaco, monospace' },
  { label: "DejaVu Sans Mono", value: '"DejaVu Sans Mono", monospace' },
  { label: "Ubuntu Mono", value: '"Ubuntu Mono", monospace' },
  { label: "Fira Code", value: '"Fira Code", "Fira Mono", monospace' },
  { label: "JetBrains Mono", value: '"JetBrains Mono", monospace' },
  { label: "Source Code Pro", value: '"Source Code Pro", monospace' },
  { label: "IBM Plex Mono", value: '"IBM Plex Mono", monospace' },
  { label: "Roboto Mono", value: '"Roboto Mono", monospace' },
  { label: "Inconsolata", value: "Inconsolata, monospace" },
  { label: "System UI", value: 'system-ui, -apple-system, sans-serif' },
];

export const ACCENTS = ["#a61e4d", "#2f81f7", "#2ea043", "#8957e5", "#db6d28", "#1f9ed6"];

/** Per-role nicklist colours. Keys map to mode prefixes (+ self/normal). */
export interface NickColors {
  owner: string; // ~
  admin: string; // &
  op: string; // @
  halfop: string; // %
  voice: string; // +
  normal: string; // no prefix
  self: string; // your own nick
}

/** Display metadata for the nicklist-colour editor. */
export const NICK_ROLES: { key: keyof NickColors; label: string }[] = [
  { key: "owner", label: "Owner (~)" },
  { key: "admin", label: "Admin (&)" },
  { key: "op", label: "Op (@)" },
  { key: "halfop", label: "Halfop (%)" },
  { key: "voice", label: "Voice (+)" },
  { key: "normal", label: "Normal" },
  { key: "self", label: "Your nick" },
];

/** Per-event/line-kind text colours. Keys match the `LineKind` values shown. */
export interface EventColors {
  message: string;
  self: string;
  notice: string;
  action: string;
  join: string;
  part: string;
  quit: string;
  kick: string;
  nick: string;
  mode: string;
  topic: string;
  system: string;
  error: string;
}

/** Display metadata for the event-colour editor. */
export const EVENT_ROLES: { key: keyof EventColors; label: string }[] = [
  { key: "message", label: "Message" },
  { key: "self", label: "Your message" },
  { key: "notice", label: "Notice" },
  { key: "action", label: "Action (/me)" },
  { key: "join", label: "Join" },
  { key: "part", label: "Part" },
  { key: "quit", label: "Quit" },
  { key: "kick", label: "Kick" },
  { key: "nick", label: "Nick change" },
  { key: "mode", label: "Mode" },
  { key: "topic", label: "Topic" },
  { key: "system", label: "System" },
  { key: "error", label: "Error" },
];

const DEFAULTS = {
  theme: "black" as ThemeId,
  /** Custom chat-area background; "" = follow the theme's background. */
  chatBg: "",
  accent: "#a61e4d",
  uiFont: UI_FONTS[0].value,
  monoFont: MONO_FONTS[0].value,
  msgSize: 13,
  soundOnHighlight: false,
  nickColors: {
    owner: "#f85149",
    admin: "#f0883e",
    op: "#58a6ff", // blue
    halfop: "#3fb950",
    voice: "#db6d28", // orange
    normal: "#ffffff", // white
    self: "#8b949e", // gray
  } as NickColors,
  eventColors: {
    message: "#e6edf3",
    self: "#9aa4b2",
    notice: "#d29922",
    action: "#b48ead",
    join: "#3fb950",
    part: "#8b949e",
    quit: "#6e7681",
    kick: "#f0883e",
    nick: "#58a6ff",
    mode: "#8b949e",
    topic: "#58a6ff",
    system: "#adbac7",
    error: "#f85149",
  } as EventColors,
};

const KEY = "raveirc.appearance";

// Readable defaults for a LIGHT background (GitHub-light semantic palette). Used
// automatically whenever the effective chat background is light, so roles/events
// stay distinct AND legible on white instead of washing out.
const LIGHT_NICK_COLORS: NickColors = {
  owner: "#cf222e", // red
  admin: "#bc4c00", // orange
  op: "#0969da", // blue
  halfop: "#1a7f37", // green
  voice: "#9a6700", // amber
  normal: "#1f2328", // near-black
  self: "#57606a", // gray
};
const LIGHT_EVENT_COLORS: EventColors = {
  message: "#1f2328",
  self: "#57606a",
  notice: "#9a6700",
  action: "#8250df", // purple
  join: "#1a7f37",
  part: "#57606a",
  quit: "#8c959f",
  kick: "#bc4c00",
  nick: "#0969da",
  mode: "#57606a",
  topic: "#0969da",
  system: "#57606a",
  error: "#cf222e",
};

/** Relative luminance (0=black, 1=white) of a #rrggbb colour, for contrast checks. */
function relLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1; // unknown → treat as light so we err toward swapping
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

class Appearance {
  theme = $state<ThemeId>(DEFAULTS.theme);
  chatBg = $state(DEFAULTS.chatBg);
  accent = $state(DEFAULTS.accent);
  uiFont = $state(DEFAULTS.uiFont);
  monoFont = $state(DEFAULTS.monoFont);
  msgSize = $state(DEFAULTS.msgSize);
  soundOnHighlight = $state(DEFAULTS.soundOnHighlight);
  nickColors = $state<NickColors>({ ...DEFAULTS.nickColors });
  eventColors = $state<EventColors>({ ...DEFAULTS.eventColors });

  /** True when the effective chat background is light (light theme or light custom bg). */
  private get lightBg(): boolean {
    return relLuminance(this.chatBg || THEMES[this.theme].bg) > 0.5;
  }

  /** Resolve the colour for a nick given its prefix and whether it's you. */
  nickColor(prefix: string, isSelf: boolean): string {
    // Light background → readable light palette (keeps roles distinct);
    // dark background → the user's colours.
    const p = this.lightBg ? LIGHT_NICK_COLORS : this.nickColors;
    if (isSelf) return p.self;
    switch (prefix) {
      case "~": return p.owner;
      case "&": return p.admin;
      case "@": return p.op;
      case "%": return p.halfop;
      case "+": return p.voice;
      default: return p.normal;
    }
  }

  /** Load saved appearance and apply it. Call once at startup. */
  init() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.theme in THEMES) this.theme = v.theme;
        if (typeof v.chatBg === "string") this.chatBg = v.chatBg;
        if (typeof v.accent === "string") this.accent = v.accent;
        if (typeof v.uiFont === "string") this.uiFont = v.uiFont;
        if (typeof v.monoFont === "string") this.monoFont = v.monoFont;
        if (typeof v.msgSize === "number") this.msgSize = v.msgSize;
        if (typeof v.soundOnHighlight === "boolean") this.soundOnHighlight = v.soundOnHighlight;
        if (v.nickColors) this.nickColors = { ...DEFAULTS.nickColors, ...v.nickColors };
        if (v.eventColors) this.eventColors = { ...DEFAULTS.eventColors, ...v.eventColors };
      }
    } catch {
      /* ignore malformed storage */
    }
    this.apply();
  }

  /** Apply current values to the document and persist. */
  apply() {
    const r = document.documentElement.style;
    const t = THEMES[this.theme];
    r.setProperty("--bg", t.bg);
    // Chat-area background overrides the theme bg when the user sets one.
    r.setProperty("--chat-bg", this.chatBg || t.bg);
    r.setProperty("--panel", t.panel);
    r.setProperty("--border", t.border);
    r.setProperty("--hover", t.hover);
    r.setProperty("--fg", t.fg);
    r.setProperty("--fg-dim", t.fgDim);
    r.setProperty("--fg-faint", t.fgFaint);
    r.setProperty("--accent", this.accent);
    r.setProperty("--accent-soft", this.accent + "33"); // ~20% alpha tint
    r.setProperty("--ui", this.uiFont);
    r.setProperty("--mono", this.monoFont);
    r.setProperty("--msg-size", `${this.msgSize}px`);
    // Per-event line colours as CSS variables consumed by MessageView. On a light
    // effective background use the readable light palette so every event kind
    // (join/nick/kick/notice/error/…) stays legible; otherwise the user's colours.
    const eventPalette = this.lightBg ? LIGHT_EVENT_COLORS : this.eventColors;
    for (const [k, v] of Object.entries(eventPalette)) {
      r.setProperty(`--line-${k}`, v);
    }
    this.save();
  }

  private save() {
    const { theme, chatBg, accent, uiFont, monoFont, msgSize, soundOnHighlight, nickColors, eventColors } =
      this;
    localStorage.setItem(
      KEY,
      JSON.stringify({
        theme,
        chatBg,
        accent,
        uiFont,
        monoFont,
        msgSize,
        soundOnHighlight,
        nickColors,
        eventColors,
      }),
    );
  }

  reset() {
    this.theme = DEFAULTS.theme;
    this.chatBg = DEFAULTS.chatBg;
    this.accent = DEFAULTS.accent;
    this.uiFont = DEFAULTS.uiFont;
    this.monoFont = DEFAULTS.monoFont;
    this.msgSize = DEFAULTS.msgSize;
    this.soundOnHighlight = DEFAULTS.soundOnHighlight;
    this.nickColors = { ...DEFAULTS.nickColors };
    this.eventColors = { ...DEFAULTS.eventColors };
    this.apply();
  }
}

export const appearance = new Appearance();
