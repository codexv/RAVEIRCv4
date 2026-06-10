<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { updater } from "$lib/update.svelte";

  let open = $state(false);
  function pick(fn: () => void) {
    open = false;
    fn();
  }
</script>

<div class="help">
  <button class="opt-btn icon" class:active={open} onclick={() => (open = !open)} title="Help" aria-label="Help">?</button>
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="backdrop" role="presentation" onclick={() => (open = false)}></div>
    <div class="menu">
      <div class="ver">RAVEIRC v{irc.appVersion || "?"}</div>
      <button onclick={() => pick(() => (irc.aboutOpen = true))}>About RAVEIRC</button>
      <button onclick={() => pick(() => (irc.bugReportOpen = true))}>🐞 Report a bug…</button>
      <button onclick={() => pick(() => updater.check(true))}>Check for updates</button>
      <div class="sep"></div>
      <button onclick={() => pick(() => irc.sendInput("/help"))}>Command reference</button>
    </div>
  {/if}
</div>

<style>
  .help {
    position: relative;
  }
  .opt-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--fg-dim);
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .opt-btn.icon {
    padding: 5px 9px;
    font-size: 14px;
    line-height: 1;
    min-width: 30px;
    text-align: center;
  }
  .opt-btn:hover,
  .opt-btn.active {
    border-color: var(--accent);
    color: var(--fg);
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 50;
    min-width: 190px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  .ver {
    font-size: 11px;
    color: var(--fg-faint);
    padding: 6px 8px;
    font-family: var(--mono);
  }
  .menu button {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--fg-dim);
    padding: 6px 8px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 13px;
  }
  .menu button:hover {
    background: var(--hover);
    color: var(--fg);
  }
  .sep {
    height: 1px;
    background: var(--border);
    margin: 4px 6px;
  }
</style>
