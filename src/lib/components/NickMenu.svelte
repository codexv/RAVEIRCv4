<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";

  // Shared right-click menu for a nick — used by the nicklist and by clicking a
  // nick in the chat window. `chan` empty => query/server context (channel-only
  // op actions are hidden).
  let {
    sid,
    chan = "",
    nick,
    prefix = "",
    x,
    y,
    onClose,
  }: {
    sid: number;
    chan?: string;
    nick: string;
    prefix?: string;
    x: number;
    y: number;
    onClose: () => void;
  } = $props();

  // Run the action first, THEN close (closing first would unmount handlers).
  function act(fn: () => void) {
    fn();
    onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="cm-backdrop"
  onclick={onClose}
  oncontextmenu={(e) => {
    e.preventDefault();
    onClose();
  }}
></div>
<div class="cm" style="left:{x}px; top:{y}px">
  <div class="cm-title">{prefix}{nick}</div>
  <button onclick={() => act(() => irc.openQuery(sid, nick))}>Message (query)</button>
  <button onclick={() => act(() => irc.whoisUser(sid, nick))}>WhoIs</button>
  {#if chan}
    <div class="cm-sep"></div>
    <button onclick={() => act(() => irc.setUserMode(sid, chan, true, "o", nick))}>Op (+o)</button>
    <button onclick={() => act(() => irc.setUserMode(sid, chan, false, "o", nick))}>Deop (-o)</button>
    <button onclick={() => act(() => irc.setUserMode(sid, chan, true, "v", nick))}>Voice (+v)</button>
    <button onclick={() => act(() => irc.setUserMode(sid, chan, false, "v", nick))}>Devoice (-v)</button>
    <div class="cm-sep"></div>
    <button onclick={() => act(() => irc.kickUser(sid, chan, nick))}>Kick</button>
    <button onclick={() => act(() => irc.banUser(sid, chan, nick))}>Ban</button>
    <button class="danger" onclick={() => act(() => irc.kickBan(sid, chan, nick))}>Kick + Ban</button>
  {/if}
  <div class="cm-sep"></div>
  <button onclick={() => act(() => irc.ctcpRequest(sid, nick, "VERSION"))}>CTCP Version</button>
  <button onclick={() => act(() => irc.ctcpRequest(sid, nick, `PING ${Date.now()}`))}>CTCP Ping</button>
  {#if chan}
    <div class="cm-sep"></div>
    <button class="ai" onclick={() => act(() => irc.analyzeUser(sid, chan, nick))}>🤖 AI: Analyze user</button>
  {/if}
</div>

<style>
  .cm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
  }
  .cm {
    position: fixed;
    z-index: 201;
    min-width: 180px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  }
  .cm-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--fg);
    padding: 6px 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cm button {
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
  .cm button:hover {
    background: var(--hover);
    color: var(--fg);
  }
  .cm button.danger:hover {
    background: #5a1a1a;
    color: #fff;
  }
  .cm button.ai:hover {
    background: var(--accent-soft);
    color: var(--fg);
  }
  .cm-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 6px;
  }
</style>
