<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { appearance } from "$lib/appearance.svelte";
  import type { Buffer, ChanUser } from "$lib/irc/types";

  let { buffer }: { buffer: Buffer | null } = $props();

  // Context-menu state
  let menu = $state<{ x: number; y: number; user: ChanUser } | null>(null);

  const me = $derived(irc.servers.find((s) => s.id === buffer?.serverId)?.nick ?? "");

  function colorFor(user: ChanUser): string {
    return appearance.nickColor(user.prefix, user.nick === me);
  }

  function openMenu(e: MouseEvent, user: ChanUser) {
    e.preventDefault();
    // Keep the menu within the viewport.
    const x = Math.min(e.clientX, window.innerWidth - 190);
    const y = Math.min(e.clientY, window.innerHeight - 360);
    menu = { x, y, user };
    selected = user.nick; // right-click also selects the row (mIRC-style)
  }

  // Run the action first, THEN close — closing first would null `menu`.
  function act(fn: () => void) {
    fn();
    menu = null;
  }

  let selected = $state<string | null>(null);

  const sid = $derived(buffer?.serverId ?? 0);
  const chan = $derived(buffer?.name ?? "");
</script>

{#if buffer && buffer.kind === "channel"}
  <div class="nicklist">
    <div class="nl-head">{buffer.users.length} users</div>
    <div class="nl-list">
      {#each buffer.users as user (user.nick)}
        {@const col = colorFor(user)}
        <button
          class="nick-row"
          class:selected={user.nick === selected}
          onclick={() => (selected = user.nick)}
          ondblclick={() => irc.openQuery(sid, user.nick)}
          oncontextmenu={(e) => openMenu(e, user)}
          title="Right-click for actions · double-click to message"
        >
          <span class="prefix" style="color:{col}">{user.prefix || ""}</span>
          <span class="name" style="color:{col}">{user.nick}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if menu}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cm-backdrop" onclick={() => (menu = null)} oncontextmenu={(e) => { e.preventDefault(); menu = null; }}></div>
  {@const u = menu.user}
  <div class="cm" style="left:{menu.x}px; top:{menu.y}px">
    <div class="cm-title">{u.prefix}{u.nick}</div>
    <button onclick={() => act(() => irc.openQuery(sid, u.nick))}>Message (query)</button>
    <button onclick={() => act(() => irc.whoisUser(sid, u.nick))}>WhoIs</button>
    <div class="cm-sep"></div>
    <button onclick={() => act(() => irc.setUserMode(sid, chan, true, "o", u.nick))}>Op (+o)</button>
    <button onclick={() => act(() => irc.setUserMode(sid, chan, false, "o", u.nick))}>Deop (-o)</button>
    <button onclick={() => act(() => irc.setUserMode(sid, chan, true, "v", u.nick))}>Voice (+v)</button>
    <button onclick={() => act(() => irc.setUserMode(sid, chan, false, "v", u.nick))}>Devoice (-v)</button>
    <div class="cm-sep"></div>
    <button onclick={() => act(() => irc.kickUser(sid, chan, u.nick))}>Kick</button>
    <button onclick={() => act(() => irc.banUser(sid, chan, u.nick))}>Ban</button>
    <button class="danger" onclick={() => act(() => irc.kickBan(sid, chan, u.nick))}>Kick + Ban</button>
    <div class="cm-sep"></div>
    <button onclick={() => act(() => irc.ctcpRequest(sid, u.nick, "VERSION"))}>CTCP Version</button>
    <button onclick={() => act(() => irc.ctcpRequest(sid, u.nick, `PING ${Date.now()}`))}>CTCP Ping</button>
    <div class="cm-sep"></div>
    <button class="ai" onclick={() => act(() => irc.analyzeUser(sid, chan, u.nick))}>🤖 AI: Analyze user</button>
  </div>
{/if}

<style>
  .nicklist {
    width: 100%;
    min-width: 0;
    height: 100%;
    background: var(--panel);
    display: flex;
    flex-direction: column;
    user-select: none;
  }
  .nl-head {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--fg-dim);
    border-bottom: 1px solid var(--border);
  }
  .nl-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }
  .nick-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: none;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
    border-radius: 5px;
    font-size: var(--msg-size, 13px);
    text-align: left;
    font-family: var(--mono);
  }
  .nick-row:hover {
    background: var(--hover);
    color: var(--fg);
  }
  .nick-row.selected {
    background: var(--accent);
    color: #fff;
    border-radius: 0;
  }
  .nick-row.selected .prefix,
  .nick-row.selected .name {
    color: #fff !important;
  }
  .prefix {
    width: 10px;
    font-weight: 700;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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
