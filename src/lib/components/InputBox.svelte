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
    irc.sendInput(text);
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
    k: 3, // colour (then type fg[,bg])
    r: 22, // reverse
    o: 15, // reset
  };

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
    // Ctrl/Cmd formatting codes (mIRC: Ctrl+B/U/I/K/R/O).
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const cc = FORMAT_CODES[e.key.toLowerCase()];
      if (cc) {
        e.preventDefault();
        insertCode(String.fromCharCode(cc));
        return;
      }
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
  <button class="nick-tag" title="Nick manager" onclick={() => (irc.nickManagerOpen = true)}>{nick || "—"}</button>
  <input
    bind:this={input}
    bind:value
    onkeydown={onKey}
    placeholder={buffer ? `Message ${buffer.kind === "server" ? "server" : buffer.name}…` : "Not connected"}
    spellcheck="false"
    autocomplete="off"
  />
</div>

<style>
  .inputbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--panel);
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
