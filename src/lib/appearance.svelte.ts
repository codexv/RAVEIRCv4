// User-customizable appearance (fonts, size, accent, theme), applied by setting
// CSS custom properties on :root and persisted to localStorage. Pure
// presentation — no backend round-trip needed.

export type ThemeId = "black" | "charcoal" | "midnight";

interface Theme {
  bg: string;
  panel: string;
  border: string;
  hover: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  black: { bg: "#000000", panel: "#0c0e12", border: "#20262e", hover: "#15191f" },
  charcoal: { bg: "#14161a", panel: "#1c1f25", border: "#2c313a", hover: "#23272e" },
  midnight: { bg: "#0d1117", panel: "#161b22", border: "#30363d", hover: "#1f262e" },
};

export const UI_FONTS: { label: string; value: string }[] = [
  { label: "System", value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: "Sans", value: 'Helvetica, Arial, sans-serif' },
  { label: "Serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];

export const MONO_FONTS: { label: string; value: string }[] = [
  { label: "System Mono", value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  { label: "Menlo", value: "Menlo, monospace" },
  { label: "Courier", value: '"Courier New", Courier, monospace' },
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

class Appearance {
  theme = $state<ThemeId>(DEFAULTS.theme);
  accent = $state(DEFAULTS.accent);
  uiFont = $state(DEFAULTS.uiFont);
  monoFont = $state(DEFAULTS.monoFont);
  msgSize = $state(DEFAULTS.msgSize);
  soundOnHighlight = $state(DEFAULTS.soundOnHighlight);
  nickColors = $state<NickColors>({ ...DEFAULTS.nickColors });
  eventColors = $state<EventColors>({ ...DEFAULTS.eventColors });

  /** Resolve the colour for a nick given its prefix and whether it's you. */
  nickColor(prefix: string, isSelf: boolean): string {
    if (isSelf) return this.nickColors.self;
    switch (prefix) {
      case "~":
        return this.nickColors.owner;
      case "&":
        return this.nickColors.admin;
      case "@":
        return this.nickColors.op;
      case "%":
        return this.nickColors.halfop;
      case "+":
        return this.nickColors.voice;
      default:
        return this.nickColors.normal;
    }
  }

  /** Load saved appearance and apply it. Call once at startup. */
  init() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.theme in THEMES) this.theme = v.theme;
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
    r.setProperty("--panel", t.panel);
    r.setProperty("--border", t.border);
    r.setProperty("--hover", t.hover);
    r.setProperty("--accent", this.accent);
    r.setProperty("--accent-soft", this.accent + "33"); // ~20% alpha tint
    r.setProperty("--ui", this.uiFont);
    r.setProperty("--mono", this.monoFont);
    r.setProperty("--msg-size", `${this.msgSize}px`);
    // Per-event line colours as CSS variables consumed by MessageView.
    for (const [k, v] of Object.entries(this.eventColors)) {
      r.setProperty(`--line-${k}`, v);
    }
    this.save();
  }

  private save() {
    const { theme, accent, uiFont, monoFont, msgSize, soundOnHighlight, nickColors, eventColors } =
      this;
    localStorage.setItem(
      KEY,
      JSON.stringify({
        theme,
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
