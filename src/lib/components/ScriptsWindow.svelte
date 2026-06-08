<script lang="ts">
  import { onMount } from "svelte";
  import { emit } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import {
    loadRaveConfig,
    saveRaveConfig,
    defaultRaveConfig,
    DEFAULT_REMOTE,
    type RaveConfig,
  } from "$lib/irc/rave";
  import { appearance } from "$lib/appearance.svelte";

  type Tab = "aliases" | "remote" | "variables";
  let tab = $state<Tab>("remote");
  let config = $state<RaveConfig>(defaultRaveConfig());
  let status = $state("");

  let wrap = $state(typeof localStorage !== "undefined" && localStorage.getItem("raveirc.editorWrap") !== "off");
  let fontSize = $state(
    typeof localStorage !== "undefined" ? Number(localStorage.getItem("raveirc.editorFont")) || 13 : 13,
  );

  onMount(async () => {
    appearance.init(); // match the main app's theme
    try {
      const cfg = await loadRaveConfig();
      if (cfg) config = cfg;
    } catch {
      /* keep defaults */
    }
  });

  function toggleWrap() {
    wrap = !wrap;
    localStorage.setItem("raveirc.editorWrap", wrap ? "soft" : "off");
  }
  function bumpFont(delta: number) {
    fontSize = Math.min(24, Math.max(9, fontSize + delta));
    localStorage.setItem("raveirc.editorFont", String(fontSize));
  }

  function loadDefaultWhois() {
    if (config.scripts.remote.trim() && !confirm("Replace the Remote script with the default RAVE whois art?")) return;
    config.scripts.remote = DEFAULT_REMOTE;
    tab = "remote";
  }

  async function apply(close: boolean) {
    await saveRaveConfig($state.snapshot(config));
    // Tell the main window to reload + re-compile the mSL engine.
    await emit("scripts-applied");
    if (close) {
      getCurrentWindow().close();
    } else {
      status = "Applied ✓";
      setTimeout(() => (status = ""), 1500);
    }
  }

  // Ctrl/Cmd+S applies; Escape closes.
  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      apply(false);
    } else if (e.key === "Escape") {
      getCurrentWindow().close();
    }
  }

  const placeholders: Record<Tab, string> = {
    aliases: "alias hello /msg $chan Hello everyone!\n\nalias slap {\n  /me slaps $1 around a bit with a large trout\n}",
    remote:
      "on *:TEXT:!ping:#: {\n  /msg $chan pong, $nick $+ !\n}\n\non *:JOIN:#: {\n  /notice $nick Welcome to $chan\n}",
    variables: "%greeting Welcome to the channel\n%maxwarns 3",
  };
</script>

<svelte:window onkeydown={onKey} />

<div class="win">
  <div class="head">
    <span class="title">Scripts <span class="msl">mIRC Compatible</span></span>
    <div class="tabs">
      <button class:active={tab === "aliases"} onclick={() => (tab = "aliases")}>Aliases</button>
      <button class:active={tab === "remote"} onclick={() => (tab = "remote")}>Remote</button>
      <button class:active={tab === "variables"} onclick={() => (tab = "variables")}>Variables</button>
      <button class="wrap-btn" class:active={wrap} onclick={toggleWrap} title="Toggle word wrap">↩ Wrap</button>
      <button class="fz" onclick={() => bumpFont(-1)} title="Smaller font">A−</button>
      <button class="fz" onclick={() => bumpFont(1)} title="Larger font">A+</button>
      {#if tab === "remote"}
        <button class="fz" onclick={loadDefaultWhois} title="Replace Remote with the default RAVE whois art">↺ Whois</button>
      {/if}
    </div>
  </div>

  {#if tab === "aliases"}
    <textarea bind:value={config.scripts.aliases} wrap={wrap ? "soft" : "off"} style="font-size:{fontSize}px" placeholder={placeholders.aliases} spellcheck="false"></textarea>
  {:else if tab === "remote"}
    <textarea bind:value={config.scripts.remote} wrap={wrap ? "soft" : "off"} style="font-size:{fontSize}px" placeholder={placeholders.remote} spellcheck="false"></textarea>
  {:else}
    <textarea bind:value={config.scripts.variables} wrap={wrap ? "soft" : "off"} style="font-size:{fontSize}px" placeholder={placeholders.variables} spellcheck="false"></textarea>
  {/if}

  <div class="foot">
    <span class="hint">
      {#if tab === "aliases"}Define <code>/commands</code>: <code>alias name &#123; … &#125;</code> or one-liners.
      {:else if tab === "remote"}Event handlers: <code>on *:TEXT:&lt;match&gt;:#: &#123; … &#125;</code>, JOIN, PART, RAW, etc.
      {:else}Persistent <code>%variables</code>: <code>%name value</code> per line.{/if}
      Supports $identifiers, aliases-as-$id, %vars, $+, if/while, hash tables, file I/O.
    </span>
    <div class="actions">
      {#if status}<span class="saved">{status}</span>{/if}
      <button class="cancel" onclick={() => getCurrentWindow().close()}>Close</button>
      <button class="ghost-btn" onclick={() => apply(false)}>Apply</button>
      <button class="go" onclick={() => apply(true)}>Save &amp; close</button>
    </div>
  </div>
</div>

<style>
  :global(html, body) {
    height: 100%;
    margin: 0;
  }
  .win {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--ui);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    gap: 8px;
  }
  .title {
    font-weight: 700;
  }
  .msl {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 10px;
    padding: 2px 8px;
    margin-left: 6px;
  }
  .tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .tabs button,
  .fz {
    padding: 6px 12px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .fz {
    padding: 6px 8px;
    min-width: 30px;
  }
  .tabs button.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--fg);
  }
  .wrap-btn {
    margin-left: 10px;
  }
  textarea {
    flex: 1;
    background: var(--bg);
    border: none;
    color: var(--fg);
    padding: 14px 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: none;
    outline: none;
    tab-size: 2;
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
  }
  .hint {
    font-size: 11px;
    color: var(--fg-dim);
    line-height: 1.4;
  }
  code {
    background: var(--bg);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: var(--mono);
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
  }
  .saved {
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
  }
  .actions button {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 13px;
  }
  .cancel,
  .ghost-btn {
    background: var(--bg);
    color: var(--fg-dim);
  }
  .go {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
    font-weight: 600;
  }
</style>
