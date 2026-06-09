<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { appearance } from "$lib/appearance.svelte";
  import { FONT_CHOICES, fontStyle } from "$lib/fonts";

  let family = $state("");
  let size = $state(13);
  let loaded = $state(false);

  // Group the font list (Default / Monospace / Sans-serif / Serif) for display.
  const groups = (() => {
    const out: { name: string; items: typeof FONT_CHOICES }[] = [];
    for (const f of FONT_CHOICES) {
      let g = out.find((x) => x.name === f.group);
      if (!g) {
        g = { name: f.group, items: [] };
        out.push(g);
      }
      g.items.push(f);
    }
    return out;
  })();

  // Initialise from the target window's current font when the picker opens.
  $effect(() => {
    if (irc.fontPickerOpen && !loaded) {
      const cur = irc.fontTarget?.font;
      family = cur?.family ?? "";
      size = cur?.size ?? appearance.msgSize;
      loaded = true;
    }
    if (!irc.fontPickerOpen && loaded) loaded = false;
  });

  $effect(() => {
    if (!irc.fontPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** CSS font-family for a preview row (quote multi-word names; keyword as-is). */
  function rowFont(v: string): string {
    if (!v) return "";
    const fam = /\s/.test(v) ? `"${v}"` : v;
    return `font-family:${fam}, ui-monospace, monospace`;
  }

  function apply() {
    irc.applyPickedFont(family, size);
    close();
  }
  function reset() {
    irc.applyPickedFont("", undefined);
    close();
  }
  function close() {
    irc.fontPickerOpen = false;
    loaded = false;
  }

  let pressedBackdrop = $state(false);
  function backdropDown(e: PointerEvent) {
    pressedBackdrop = e.target === e.currentTarget;
  }
  function backdropClick(e: MouseEvent) {
    if (pressedBackdrop && e.target === e.currentTarget) close();
    pressedBackdrop = false;
  }
</script>

{#if irc.fontPickerOpen}
  <div class="overlay" onpointerdown={backdropDown} onclick={backdropClick} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="head">
        <span>Window font{#if irc.fontTarget} — {irc.fontTarget.name}{/if}</span>
        <button class="x" onclick={close} title="Close">✕</button>
      </div>

      <div class="preview" style={fontStyle({ family: family || undefined, size })}>
        <div class="pl"><span class="t">12:34</span> &lt;@acronix&gt; The quick brown fox jumps over the lazy dog.</div>
        <div class="pl"><span class="t">12:35</span> &lt;rave&gt; ABCDEFG abcdefg 0123456789 !?.,:;-_/|\</div>
      </div>

      <div class="fonts">
        {#each groups as g (g.name)}
          <div class="grp">{g.name}</div>
          {#each g.items as f (f.value)}
            <button
              class="frow"
              class:active={family === f.value}
              style={rowFont(f.value)}
              onclick={() => (family = f.value)}
            >
              <span class="lbl">{f.label}</span>
              {#if family === f.value}<span class="chk">✓</span>{/if}
            </button>
          {/each}
        {/each}
      </div>

      <div class="size">
        <span class="lbl">Size <b>{size}px</b></span>
        <input type="range" min="8" max="40" bind:value={size} aria-label="Font size" />
        <input class="num" type="number" min="6" max="72" bind:value={size} />
      </div>

      <div class="foot">
        <button class="ghost" onclick={reset}>Reset to default</button>
        <span class="sp"></span>
        <button class="ghost" onclick={close}>Cancel</button>
        <button class="go" onclick={apply}>Apply</button>
      </div>
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
  .card {
    width: 460px;
    max-width: 94vw;
    max-height: 88vh;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  .head {
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
  .preview {
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--chat-bg, var(--bg));
    font-family: var(--mono);
    font-size: var(--msg-size, 13px);
    color: var(--fg);
    min-height: 64px;
  }
  .preview .pl {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .preview .t {
    color: var(--fg-faint);
    margin-right: 6px;
  }
  .fonts {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }
  .grp {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--fg-faint);
    padding: 8px 8px 4px;
  }
  .frow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--fg);
    padding: 7px 10px;
    cursor: pointer;
    font-size: 14px;
  }
  .frow:hover {
    background: var(--hover);
  }
  .frow.active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .frow .chk {
    color: var(--accent);
    font-weight: 800;
  }
  .size {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
  }
  .size .lbl {
    color: var(--fg-dim);
    font-size: 13px;
    white-space: nowrap;
  }
  .size input[type="range"] {
    flex: 1;
    accent-color: var(--accent);
  }
  .size .num {
    width: 64px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    padding: 6px 8px;
    font-size: 13px;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid var(--border);
  }
  .foot .sp {
    flex: 1;
  }
  .ghost {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--fg);
    padding: 8px 14px;
    cursor: pointer;
    font-size: 13px;
  }
  .ghost:hover {
    border-color: var(--fg-faint);
  }
  .go {
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 7px;
    color: #fff;
    padding: 8px 18px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
  }
  .go:hover {
    filter: brightness(1.08);
  }
</style>
