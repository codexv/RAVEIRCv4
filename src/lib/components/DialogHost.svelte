<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import type { OpenDialog } from "$lib/msl/dialogs";

  // mIRC dialog units are smaller than pixels; scale up for a usable layout.
  const S = 1.7;

  function dragStart(e: PointerEvent, dlg: OpenDialog) {
    if ((e.target as HTMLElement).closest("button")) return;
    const dx = e.clientX - (dlg.x || 0);
    const dy = e.clientY - (dlg.y || 0);
    const move = (ev: PointerEvent) => {
      dlg.x = Math.max(0, ev.clientX - dx);
      dlg.y = Math.max(0, ev.clientY - dy);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

{#each irc.dialogsOpen as dlg, i (dlg.name)}
  <div
    class="dlg"
    style="left:{dlg.x || 120 + i * 24}px; top:{dlg.y || 100 + i * 24}px; width:{dlg.w * S}px;"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dlg-head" onpointerdown={(e) => dragStart(e, dlg)}>
      <span class="dlg-title">{dlg.title}</span>
      <button class="dlg-x" onclick={() => irc.dlgClose(dlg.name)}>✕</button>
    </div>
    <div class="dlg-body" style="height:{dlg.h * S}px">
      {#each dlg.controls as c (c.id)}
        {@const st = `left:${c.x * S}px; top:${c.y * S}px; width:${c.w * S}px; height:${c.h * S}px`}
        {#if c.type === "button"}
          <button class="c-btn" style={st} disabled={!c.enabled} onclick={() => irc.dlgButton(dlg.name, c.id)}>{c.caption}</button>
        {:else if c.type === "edit"}
          <input class="c-edit" style={st} disabled={!c.enabled} value={c.text} oninput={(e) => irc.dlgEdit(dlg.name, c.id, e.currentTarget.value)} />
        {:else if c.type === "check" || c.type === "radio"}
          <label class="c-check" style={st}><input type="checkbox" checked={c.checked} disabled={!c.enabled} onchange={(e) => irc.dlgCheck(dlg.name, c.id, e.currentTarget.checked)} /> {c.caption}</label>
        {:else if c.type === "list"}
          <div class="c-list" style={st}>
            {#each c.items as item, idx (idx)}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div class="c-item" class:sel={c.sel === idx + 1} onclick={() => irc.dlgSelect(dlg.name, c.id, idx + 1)}>{item}</div>
            {/each}
          </div>
        {:else if c.type === "combo"}
          <select class="c-combo" style={st} disabled={!c.enabled} onchange={(e) => irc.dlgSelect(dlg.name, c.id, e.currentTarget.selectedIndex + 1)}>
            {#each c.items as item, idx (idx)}<option selected={c.sel === idx + 1}>{item}</option>{/each}
          </select>
        {:else if c.type === "box"}
          <fieldset class="c-box" style={st}><legend>{c.caption}</legend></fieldset>
        {:else}
          <span class="c-text" style={st}>{c.caption}</span>
        {/if}
      {/each}
    </div>
  </div>
{/each}

<style>
  .dlg {
    position: fixed;
    z-index: 90;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }
  .dlg-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    cursor: move;
    user-select: none;
  }
  .dlg-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--fg);
  }
  .dlg-x {
    background: transparent;
    border: none;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 12px;
  }
  .dlg-body {
    position: relative;
  }
  .dlg-body > * {
    position: absolute;
    font-size: 12px;
  }
  .c-text {
    color: var(--fg);
    display: flex;
    align-items: center;
  }
  .c-btn {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 5px;
    cursor: pointer;
  }
  .c-btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .c-edit,
  .c-combo {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 6px;
    outline: none;
  }
  .c-check {
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .c-list {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow-y: auto;
    color: var(--fg);
  }
  .c-item {
    padding: 2px 6px;
    cursor: pointer;
    white-space: nowrap;
  }
  .c-item:hover {
    background: var(--hover);
  }
  .c-item.sel {
    background: var(--accent-soft);
  }
  .c-box {
    border: 1px solid var(--border);
    border-radius: 4px;
    margin: 0;
  }
  .c-box legend {
    color: var(--fg-dim);
    padding: 0 4px;
  }
  :disabled {
    opacity: 0.5;
  }
</style>
