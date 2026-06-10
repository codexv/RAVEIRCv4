<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { FONT_CHOICES } from "$lib/fonts";
  import { loadNotes, saveNotes, newNote, type Note } from "$lib/notes";

  // windowed = standalone OS window (desktop); otherwise a modal (web/PWA).
  let { windowed = false }: { windowed?: boolean } = $props();

  let notes = $state<Note[]>([]);
  let activeId = $state("");
  let font = $state("");
  let size = $state(13);
  let loaded = $state(false);

  const idx = $derived(notes.findIndex((n) => n.id === activeId));

  function load() {
    const s = loadNotes();
    notes = s.notes;
    activeId = s.activeId;
    font = s.font;
    size = s.size;
    loaded = true;
  }
  function persist() {
    saveNotes({ notes: $state.snapshot(notes), activeId, font, size });
  }

  // Windowed: load immediately. Modal: load when opened.
  $effect(() => {
    if (windowed && !loaded) load();
  });
  $effect(() => {
    if (!windowed && irc.scratchpadOpen && !loaded) load();
    if (!windowed && !irc.scratchpadOpen) loaded = false;
  });

  function selectNote(id: string) {
    activeId = id;
    persist();
  }
  function addNote() {
    const n = newNote(`Note ${notes.length + 1}`);
    notes = [...notes, n];
    activeId = n.id;
    persist();
  }
  function renameNote(n: Note) {
    const t = window.prompt("Note title", n.title);
    if (t && t.trim()) {
      n.title = t.trim();
      persist();
    }
  }
  function deleteNote(id: string) {
    if (notes.length <= 1) return; // keep at least one
    const n = notes.find((x) => x.id === id);
    if (n && (n.body.trim() === "" || window.confirm(`Delete note "${n.title}"?`))) {
      notes = notes.filter((x) => x.id !== id);
      if (activeId === id) activeId = notes[0].id;
      persist();
    }
  }

  /** Editor font-family CSS (quote multi-word names; fall back to theme mono). */
  function fontCss(v: string): string {
    if (!v) return "var(--mono)";
    const fam = /\s/.test(v) ? `"${v}"` : v;
    return `${fam}, var(--mono)`;
  }

  async function close() {
    persist();
    if (windowed) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      getCurrentWindow().close();
    } else {
      irc.scratchpadOpen = false;
      loaded = false;
    }
  }

  // Escape closes the modal (not the OS window — there you use the title bar).
  $effect(() => {
    if (windowed || !irc.scratchpadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let pressedBackdrop = $state(false);
  function backdropDown(e: PointerEvent) {
    pressedBackdrop = e.target === e.currentTarget;
  }
  function backdropClick(e: MouseEvent) {
    if (pressedBackdrop && e.target === e.currentTarget) close();
    pressedBackdrop = false;
  }
</script>

{#snippet editor()}
  <div class="tabs">
    {#each notes as n (n.id)}
      <span class="tab" class:active={n.id === activeId}>
        <button class="tab-pick" onclick={() => selectNote(n.id)} ondblclick={() => renameNote(n)} title="Click to open · double-click to rename">{n.title}</button>
        {#if notes.length > 1}
          <button class="tab-del" title="Delete note" onclick={() => deleteNote(n.id)}>✕</button>
        {/if}
      </span>
    {/each}
    <button class="tab-add" title="New note" onclick={addNote}>＋</button>
  </div>

  <div class="toolbar">
    <select bind:value={font} onchange={persist} title="Font face" aria-label="Font face">
      {#each FONT_CHOICES as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
    </select>
    <input class="size" type="number" min="8" max="40" bind:value={size} oninput={persist} title="Font size" aria-label="Font size" />
  </div>

  {#if idx >= 0}
    <textarea
      bind:value={notes[idx].body}
      oninput={persist}
      style="font-family: {fontCss(font)}; font-size: {size}px"
      placeholder="Notes, snippets, anything… (saved automatically)"
      spellcheck="false"
    ></textarea>
  {/if}
{/snippet}

{#if windowed}
  <div class="pad windowed">
    <div class="pad-head">
      <span>Quick Notes</span>
    </div>
    {@render editor()}
  </div>
{:else if irc.scratchpadOpen}
  <div class="overlay" onpointerdown={backdropDown} onclick={backdropClick} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="pad" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="pad-head">
        <span>Quick Notes</span>
        <button class="x" onclick={close}>✕</button>
      </div>
      {@render editor()}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .pad {
    width: 560px;
    height: 460px;
    min-width: 320px;
    min-height: 240px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    resize: both; /* the modal is drag-resizable on the web build */
  }
  .pad.windowed {
    width: 100%;
    height: 100vh;
    border: none;
    border-radius: 0;
    resize: none;
    box-shadow: none;
  }
  .pad-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    font-weight: 700;
    color: var(--fg);
  }
  .x {
    background: transparent;
    border: none;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 14px;
  }
  .tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    flex-shrink: 0;
  }
  .tab {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .tab.active {
    border-color: var(--accent);
  }
  .tab-pick {
    background: var(--bg);
    border: none;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 12px;
    padding: 5px 9px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tab.active .tab-pick {
    background: var(--accent-soft);
    color: var(--fg);
  }
  .tab-del {
    border: none;
    border-left: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-faint);
    cursor: pointer;
    font-size: 10px;
    padding: 0 6px;
  }
  .tab-del:hover {
    color: var(--accent);
  }
  .tab-add {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 13px;
    padding: 4px 9px;
    flex-shrink: 0;
  }
  .tab-add:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .toolbar select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    padding: 5px 8px;
    font-size: 12px;
    flex: 1;
    min-width: 0;
  }
  .toolbar .size {
    width: 64px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    padding: 5px 8px;
    font-size: 12px;
  }
  textarea {
    flex: 1;
    background: var(--bg);
    border: none;
    color: var(--fg);
    padding: 12px 14px;
    resize: none;
    outline: none;
    line-height: 1.5;
  }
</style>
