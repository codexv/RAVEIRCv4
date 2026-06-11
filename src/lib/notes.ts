// Persistence for the Quick Notes editor: multiple note "tabs" plus the chosen
// font face/size, auto-saved to local storage (works on desktop and the PWA).

import { dedupeById } from "./util";

export interface Note {
  id: string;
  title: string;
  body: string;
}

export interface NotesState {
  notes: Note[];
  activeId: string;
  /** CSS font-family for the editor ("" = default monospace). */
  font: string;
  size: number;
}

const KEY = "raveirc.notes";
const LEGACY_KEY = "raveirc.scratchpad"; // the old single scratchpad

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "n" + Date.now() + Math.floor(Math.random() * 1e6);
  }
}

export function newNote(title = "Note"): Note {
  return { id: uid(), title, body: "" };
}

export function loadNotes(): NotesState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<NotesState>;
      if (s && Array.isArray(s.notes) && s.notes.length) {
        const notes = dedupeById(s.notes as Note[], uid);
        return {
          notes,
          activeId: s.activeId && notes.some((n) => n.id === s.activeId) ? s.activeId : notes[0].id,
          font: typeof s.font === "string" ? s.font : "",
          size: typeof s.size === "number" ? s.size : 13,
        };
      }
    }
  } catch {
    /* ignore */
  }
  // First run — migrate the old single scratchpad into the first tab.
  let legacy = "";
  try {
    legacy = localStorage.getItem(LEGACY_KEY) ?? "";
  } catch {
    /* ignore */
  }
  const first = newNote("Notes");
  if (legacy) first.body = legacy;
  return { notes: [first], activeId: first.id, font: "", size: 13 };
}

export function saveNotes(s: NotesState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
