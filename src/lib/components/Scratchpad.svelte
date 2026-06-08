<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";

  let text = $state("");
  let loaded = $state(false);

  $effect(() => {
    if (irc.scratchpadOpen && !loaded) {
      text = localStorage.getItem("raveirc.scratchpad") ?? "";
      loaded = true;
    }
  });

  // Escape closes the scratchpad.
  $effect(() => {
    if (!irc.scratchpadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function save() {
    localStorage.setItem("raveirc.scratchpad", text);
  }
  function close() {
    save();
    irc.scratchpadOpen = false;
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

{#if irc.scratchpadOpen}
  <div
    class="overlay"
    onpointerdown={backdropDown}
    onclick={backdropClick}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="pad" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="pad-head">
        <span>Scratchpad</span>
        <button class="x" onclick={close}>✕</button>
      </div>
      <textarea bind:value={text} oninput={save} placeholder="Notes, snippets, anything… (saved automatically)"></textarea>
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
    width: 520px;
    height: 440px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
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
  textarea {
    flex: 1;
    background: var(--bg);
    border: none;
    color: var(--fg);
    padding: 12px 14px;
    font-family: var(--mono);
    font-size: 13px;
    resize: none;
    outline: none;
  }
</style>
