// mIRC control-code formatting -> safe HTML.
//
// Supports: bold (0x02), italic (0x1D), underline (0x1F), strikethrough (0x1E),
// monospace (0x11), reverse (0x16), reset (0x0F), color (0x03 fg[,bg]) with the
// 16 base colors + the 16-98 extended palette, and hex color (0x04 RRGGBB).

/** The mIRC 99-colour palette, indexed 0-98. Index 99 = default (handled separately). */
const PALETTE: string[] = [
  "#ffffff", "#000000", "#00007f", "#009300", "#ff0000", "#7f0000", "#9c009c", "#fc7f00",
  "#ffff00", "#00fc00", "#009393", "#00ffff", "#0000fc", "#ff00ff", "#7f7f7f", "#d2d2d2",
  // extended 16-98
  "#470000", "#472100", "#474700", "#324700", "#004700", "#00472c", "#004747", "#002747",
  "#000047", "#2e0047", "#470047", "#47002a", "#740000", "#743a00", "#747400", "#517400",
  "#007400", "#007449", "#007474", "#004074", "#000074", "#4b0074", "#740074", "#740045",
  "#b50000", "#b56300", "#b5b500", "#7db500", "#00b500", "#00b571", "#00b5b5", "#0063b5",
  "#0000b5", "#7500b5", "#b500b5", "#b5006b", "#ff0000", "#ff8c00", "#ffff00", "#b2ff00",
  "#00ff00", "#00ffa0", "#00ffff", "#008cff", "#0000ff", "#a500ff", "#ff00ff", "#ff0098",
  "#ff5959", "#ffb459", "#ffff71", "#cfff60", "#6fff6f", "#65ffc9", "#6dffff", "#59b4ff",
  "#5959ff", "#c459ff", "#ff66ff", "#ff59bc", "#ff9c9c", "#ffd39c", "#ffff9c", "#e2ff9c",
  "#9cff9c", "#9cffdb", "#9cffff", "#9cd3ff", "#9c9cff", "#dc9cff", "#ff9cff", "#ff94d3",
  "#000000", "#131313", "#282828", "#363636", "#4d4d4d", "#656565", "#818181", "#9f9f9f",
  "#bcbcbc", "#e2e2e2", "#ffffff",
];

const CHAR = {
  BOLD: "\x02",
  COLOR: "\x03",
  HEX: "\x04",
  RESET: "\x0f",
  REVERSE: "\x16",
  ITALIC: "\x1d",
  STRIKE: "\x1e",
  UNDERLINE: "\x1f",
  MONO: "\x11",
};

interface State {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  mono: boolean;
  reverse: boolean;
  fg: string | null;
  bg: string | null;
}

function emptyState(): State {
  return {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    mono: false,
    reverse: false,
    fg: null,
    bg: null,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spanFor(state: State): string {
  const styles: string[] = [];
  const deco: string[] = [];
  if (state.bold) styles.push("font-weight:bold");
  if (state.italic) styles.push("font-style:italic");
  if (state.underline) deco.push("underline");
  if (state.strike) deco.push("line-through");
  if (deco.length) styles.push(`text-decoration:${deco.join(" ")}`);
  if (state.mono) styles.push("font-family:var(--mono,monospace)");

  let fg = state.fg;
  let bg = state.bg;
  if (state.reverse) [fg, bg] = [bg ?? "var(--bg)", fg ?? "var(--fg)"];
  if (fg) styles.push(`color:${fg}`);
  if (bg) styles.push(`background-color:${bg}`);

  return styles.length ? `<span style="${styles.join(";")}">` : "<span>";
}

function colorFor(idx: number): string | null {
  if (idx === 99) return null;
  return PALETTE[idx] ?? null;
}

/** Render an mIRC-formatted string into a safe HTML fragment. */
export function renderMirc(input: string): string {
  const state = emptyState();
  let out = "";
  let text = "";
  let openSpan = false;

  const flush = () => {
    if (text) {
      out += escapeHtml(text);
      text = "";
    }
  };
  const reopen = () => {
    flush();
    if (openSpan) {
      out += "</span>";
      openSpan = false;
    }
    out += spanFor(state);
    openSpan = true;
  };

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    switch (c) {
      case CHAR.BOLD:
        state.bold = !state.bold;
        reopen();
        break;
      case CHAR.ITALIC:
        state.italic = !state.italic;
        reopen();
        break;
      case CHAR.UNDERLINE:
        state.underline = !state.underline;
        reopen();
        break;
      case CHAR.STRIKE:
        state.strike = !state.strike;
        reopen();
        break;
      case CHAR.MONO:
        state.mono = !state.mono;
        reopen();
        break;
      case CHAR.REVERSE:
        state.reverse = !state.reverse;
        reopen();
        break;
      case CHAR.RESET:
        Object.assign(state, emptyState());
        reopen();
        break;
      case CHAR.COLOR: {
        // \x03[fg][,bg] with 1-2 digit codes
        const m = /^(\d{1,2})(?:,(\d{1,2}))?/.exec(input.slice(i + 1));
        if (m) {
          state.fg = colorFor(parseInt(m[1], 10));
          if (m[2] !== undefined) state.bg = colorFor(parseInt(m[2], 10));
          i += m[0].length;
        } else {
          // bare \x03 resets colours
          state.fg = null;
          state.bg = null;
        }
        reopen();
        break;
      }
      case CHAR.HEX: {
        const m = /^([0-9a-fA-F]{6})(?:,([0-9a-fA-F]{6}))?/.exec(input.slice(i + 1));
        if (m) {
          state.fg = `#${m[1]}`;
          if (m[2]) state.bg = `#${m[2]}`;
          i += m[0].length;
        } else {
          state.fg = null;
          state.bg = null;
        }
        reopen();
        break;
      }
      default:
        text += c;
    }
  }

  flush();
  if (openSpan) out += "</span>";
  return out;
}

/** Strip all mIRC control codes, returning plain text. */
export function stripMirc(input: string): string {
  return input.replace(
    // eslint-disable-next-line no-control-regex
    /\x03(\d{1,2}(,\d{1,2})?)?|\x04([0-9a-fA-F]{6}(,[0-9a-fA-F]{6})?)?|[\x02\x0f\x11\x16\x1d\x1e\x1f]/g,
    "",
  );
}
