<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { registerInput } from "$lib/focus";
  import type { Buffer } from "$lib/irc/types";

  let { buffer }: { buffer: Buffer | null } = $props();

  let value = $state("");
  let history = $state<string[]>([]);
  let histIdx = $state(-1);
  let input = $state<HTMLInputElement | null>(null);

  // Expose the editbox so clicking the chat area can focus it.
  $effect(() => registerInput(input));

  // Tab-completion state
  let completing = $state(false);
  let completeOptions = $state<string[]>([]);
  let completeIdx = $state(0);
  let completeBase = $state("");

  function submit() {
    const text = value;
    if (!text.trim()) {
      value = "";
      return;
    }
    // Never let a command-handling error wedge the input box.
    Promise.resolve()
      .then(() => irc.sendInput(text))
      .catch((e) => console.error("sendInput failed:", e));
    history = [text, ...history].slice(0, 100);
    histIdx = -1;
    value = "";
    resetComplete();
  }

  function resetComplete() {
    completing = false;
    completeOptions = [];
    completeIdx = 0;
    completeBase = "";
  }

  function doComplete() {
    if (!buffer || buffer.kind !== "channel") return;
    if (!completing) {
      const m = /(\S*)$/.exec(value);
      const partial = m ? m[1] : "";
      if (!partial) return;
      const opts = buffer.users
        .map((u) => u.nick)
        .filter((n) => n.toLowerCase().startsWith(partial.toLowerCase()));
      if (opts.length === 0) return;
      completing = true;
      completeOptions = opts;
      completeIdx = 0;
      completeBase = value.slice(0, value.length - partial.length);
    } else {
      completeIdx = (completeIdx + 1) % completeOptions.length;
    }
    const chosen = completeOptions[completeIdx];
    const suffix = completeBase === "" ? ": " : " ";
    value = completeBase + chosen + suffix;
  }

  // mIRC editbox formatting control codes (char codes inserted at the caret).
  const FORMAT_CODES: Record<string, number> = {
    b: 2, // bold
    u: 31, // underline
    i: 29, // italic
    r: 22, // reverse
    o: 15, // reset
  };

  // The 16 mIRC palette colours; clicking inserts a colour code (Ctrl+K).
  const MIRC_COLORS = [
    "#FFFFFF", "#000000", "#00007F", "#009300", "#FF0000", "#7F0000",
    "#9C009C", "#FC7F00", "#FFFF00", "#00FC00", "#009393", "#00FFFF",
    "#0000FC", "#FF00FF", "#7F7F7F", "#D2D2D2",
  ];
  let colorOpen = $state(false);
  function pickColor(n: number) {
    colorOpen = false;
    insertCode(String.fromCharCode(3) + String(n).padStart(2, "0"));
  }

  function insertCode(code: string) {
    const el = input;
    if (!el) {
      value += code;
      return;
    }
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    value = value.slice(0, s) + code + value.slice(e);
    // restore caret after the inserted code
    queueMicrotask(() => {
      el.selectionStart = el.selectionEnd = s + code.length;
      el.focus();
    });
  }

  function onKey(e: KeyboardEvent) {
    // Ctrl/Cmd formatting codes (mIRC: Ctrl+B/U/I/R/O); Ctrl+K opens the palette.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        colorOpen = !colorOpen;
        return;
      }
      const cc = FORMAT_CODES[e.key.toLowerCase()];
      if (cc) {
        e.preventDefault();
        insertCode(String.fromCharCode(cc));
        return;
      }
    }
    if (e.key === "Escape" && colorOpen) {
      e.preventDefault();
      colorOpen = false;
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      doComplete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx < history.length - 1) {
        histIdx++;
        value = history[histIdx];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx > 0) {
        histIdx--;
        value = history[histIdx];
      } else {
        histIdx = -1;
        value = "";
      }
    } else if (e.key !== "Shift") {
      resetComplete();
    }
  }

  const nick = $derived(irc.servers.find((s) => s.id === buffer?.serverId)?.nick ?? "");
</script>

<div class="inputbar">
  {#if colorOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="cp-backdrop" role="presentation" onclick={() => (colorOpen = false)}></div>
    <div class="color-pop">
      <div class="cp-grid">
        {#each MIRC_COLORS as c, i (i)}
          <button class="sw" style="background:{c}" title="Colour {i}" aria-label="Colour {i}" onclick={() => pickColor(i)}></button>
        {/each}
      </div>
      <button class="cp-reset" title="Reset formatting (Ctrl+O)" onclick={() => { colorOpen = false; insertCode(String.fromCharCode(15)); }}>Reset</button>
    </div>
  {/if}
  <button class="nick-tag" title="Nick manager" onclick={() => (irc.nickManagerOpen = true)}>{nick || "—"}</button>
  <button class="fmt-btn" class:active={colorOpen} title="Text colour (Ctrl+K)" onclick={() => (colorOpen = !colorOpen)}>🎨</button>
  <input
    bind:this={input}
    bind:value
    onkeydown={onKey}
    placeholder={!buffer
      ? "Not connected"
      : buffer.kind === "channel" && !buffer.joined
        ? `You've left ${buffer.name} — /join to rejoin`
        : `Message ${buffer.kind === "server" ? "server" : buffer.name}…`}
    spellcheck="false"
    autocomplete="off"
  />
</div>

<style>
  .inputbar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--panel);
  }
  .fmt-btn {
    flex-shrink: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 5px;
    opacity: 0.7;
  }
  .fmt-btn:hover,
  .fmt-btn.active {
    opacity: 1;
    background: var(--hover);
  }
  .cp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
  }
  .color-pop {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 12px;
    z-index: 61;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }
  .cp-grid {
    display: grid;
    grid-template-columns: repeat(8, 18px);
    gap: 4px;
  }
  .sw {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid var(--border);
    cursor: pointer;
    padding: 0;
  }
  .sw:hover {
    outline: 2px solid var(--accent);
  }
  .cp-reset {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--fg-dim);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .cp-reset:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .nick-tag {
    color: var(--accent);
    font-weight: 600;
    font-size: 13px;
    font-family: var(--mono);
    flex-shrink: 0;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .nick-tag:hover {
    text-decoration: underline;
  }
  input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    color: var(--fg);
    font-family: var(--mono);
    font-size: var(--msg-size, 13px);
    outline: none;
  }
  input:focus {
    border-color: var(--accent);
  }
</style>
