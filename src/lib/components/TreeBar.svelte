<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import type { Buffer } from "$lib/irc/types";

  let { onAddServer, onOpenSettings }: { onAddServer: () => void; onOpenSettings: () => void } =
    $props();

  let menu = $state<{ x: number; y: number; buf: Buffer } | null>(null);
  // Servers whose channel list is collapsed (session state).
  let collapsed = $state(new Set<number>());

  function toggleCollapse(id: number) {
    const next = new Set(collapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    collapsed = next;
  }

  function openMenu(e: MouseEvent, buf: Buffer) {
    e.preventDefault();
    menu = { x: Math.min(e.clientX, window.innerWidth - 200), y: e.clientY, buf };
  }
  function act(fn: () => void) {
    menu = null;
    fn();
  }

  /** Close a server window, warning first if it's still connected. */
  function closeServerConfirmed(serverId: number) {
    const s = irc.servers.find((x) => x.id === serverId);
    if (
      s &&
      s.status !== "disconnected" &&
      !window.confirm(`Close "${s.name}"? This disconnects the server and closes its windows.`)
    )
      return;
    irc.closeServer(serverId);
  }

  function statusDot(status: string): string {
    switch (status) {
      case "registered":
        return "ok";
      case "connected":
      case "connecting":
        return "pending";
      default:
        return "off";
    }
  }
</script>

<div class="treebar">
  <div class="tb-head">
    <div class="brand">
      <svg class="app-icon" viewBox="0 0 1024 1024" aria-hidden="true">
        <rect width="1024" height="1024" rx="230" fill="#181818" />
        <path
          d="M 220 210 H 640 A 70 70 0 0 1 710 280 V 480 A 70 70 0 0 1 640 550 H 390 L 300 645 L 300 550 H 220 A 70 70 0 0 1 150 480 V 280 A 70 70 0 0 1 220 210 Z"
          fill="#ffffff"
        />
        <path
          d="M 400 360 H 800 A 70 70 0 0 1 870 430 V 620 A 70 70 0 0 1 800 690 H 560 L 470 785 L 470 690 H 400 A 70 70 0 0 1 330 620 V 430 A 70 70 0 0 1 400 360 Z"
          fill="var(--accent)"
        />
      </svg>
      <span class="logo">RAVE<span class="logo-irc">IRC</span></span>
    </div>
    <div class="head-btns">
      <button class="add" title="Settings" onclick={onOpenSettings}>⚙</button>
      <button class="add" title="Add server" onclick={onAddServer}>+</button>
    </div>
  </div>

  <div class="tb-list">
    {#each irc.servers as server (server.id)}
      {@const buffers = irc.serverBuffers(server.id)}
      <div class="server">
        {#each buffers as buf (buf.id)}
          {#if buf.kind === "server" || !collapsed.has(server.id)}
          <button
            class="node"
            class:active={buf.id === irc.activeId}
            class:server-node={buf.kind === "server"}
            class:highlight={buf.highlight}
            title={buf.kind === "server"
              ? "Shift+click to close this server window"
              : "Shift+click (or middle-click) to close"}
            onclick={(e) => {
              if (e.shiftKey) {
                if (buf.kind === "server") closeServerConfirmed(buf.serverId);
                else irc.closeBuffer(buf.id);
              } else irc.select(buf.id);
            }}
            oncontextmenu={(e) => openMenu(e, buf)}
            onauxclick={(e) => {
              if (e.button === 1 && buf.kind !== "server") irc.closeBuffer(buf.id);
            }}
          >
            {#if buf.kind === "server"}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <span
                class="chevron"
                role="button"
                tabindex="-1"
                title={collapsed.has(server.id) ? "Expand" : "Collapse"}
                onclick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(server.id);
                }}
              >{collapsed.has(server.id) ? "▸" : "▾"}</span>
              <span class="dot {statusDot(server.status)}"></span>
              <span class="label">{server.name}</span>
            {:else}
              <span class="kind-icon">{buf.kind === "channel" ? "#" : "@"}</span>
              <span class="label" class:parted={buf.kind === "channel" && !buf.joined}>
                {buf.kind === "channel" ? buf.name.replace(/^#/, "") : buf.name}
              </span>
            {/if}

            {#if buf.unread > 0}
              <span class="badge" class:hl={buf.highlight}>{buf.unread}</span>
            {/if}
          </button>
          {/if}
        {/each}
      </div>
    {/each}

    {#if irc.servers.length === 0}
      <div class="empty">
        <p>No servers yet.</p>
        <button class="connect-cta" onclick={onAddServer}>Connect to a server</button>
      </div>
    {/if}
  </div>

  <div class="tb-foot" title="RAVEIRC version">
    {#if irc.appVersion}RAVE<span>IRC</span> v{irc.appVersion}{/if}
  </div>
</div>

{#if menu}
  {@const b = menu.buf}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cm-backdrop" onclick={() => (menu = null)} oncontextmenu={(e) => { e.preventDefault(); menu = null; }}></div>
  <div class="cm" style="left:{menu.x}px; top:{menu.y}px">
    <div class="cm-title">{b.kind === "server" ? (irc.servers.find((s) => s.id === b.serverId)?.name ?? "server") : b.name}</div>
    <button onclick={() => act(() => irc.select(b.id))}>Open</button>
    <button onclick={() => act(() => irc.clearBuffer(b.id))}>Clear</button>
    {#if b.kind === "channel"}
      <div class="cm-sep"></div>
      {#if b.joined}
        <button onclick={() => act(() => irc.leaveChannel(b.serverId, b.name))}>Leave (keep window)</button>
      {:else}
        <button onclick={() => act(() => irc.rejoinChannel(b.serverId, b.name))}>Rejoin</button>
      {/if}
    {/if}
    {#if b.kind === "server"}
      <div class="cm-sep"></div>
      <button class="danger" onclick={() => act(() => irc.disconnectServer(b.serverId))}>Disconnect</button>
      <button class="danger" onclick={() => act(() => closeServerConfirmed(b.serverId))}>Close server window</button>
    {:else}
      <button class="danger" onclick={() => act(() => irc.closeBuffer(b.id))}>Close window</button>
    {/if}
  </div>
{/if}

<style>
  .cm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
  }
  .cm {
    position: fixed;
    z-index: 201;
    min-width: 170px;
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
  .cm-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 6px;
  }
  .treebar {
    width: 100%;
    height: 100%;
    background: var(--panel);
    display: flex;
    flex-direction: column;
    user-select: none;
  }
  .tb-foot {
    flex-shrink: 0;
    padding: 6px 12px;
    border-top: 1px solid var(--border);
    font-size: 10px;
    letter-spacing: 0.5px;
    color: var(--fg-faint);
    font-family: var(--mono);
    text-align: center;
    min-height: 14px;
  }
  .tb-foot span {
    color: var(--accent);
  }
  .tb-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .app-icon {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    flex-shrink: 0;
  }
  .logo {
    font-family: var(--ui);
    font-weight: 800;
    letter-spacing: 0.5px;
    font-size: 15px;
    text-transform: uppercase;
    color: var(--fg);
  }
  .logo-irc {
    color: var(--accent);
    text-shadow: 0 0 12px var(--accent);
    margin-left: 1px;
  }
  .head-btns {
    display: flex;
    gap: 6px;
  }
  .add {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }
  .add:hover {
    border-color: var(--accent);
  }
  .tb-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }
  .server {
    margin-bottom: 8px;
  }
  .node {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 8px;
    border: none;
    background: transparent;
    color: var(--fg-dim);
    cursor: pointer;
    border-radius: 6px;
    font-size: 13px;
    text-align: left;
  }
  .node:hover {
    background: var(--hover);
  }
  .node.active {
    background: var(--accent-soft);
    color: var(--fg);
  }
  .server-node {
    font-weight: 600;
    color: var(--fg);
  }
  .node:not(.server-node) {
    padding-left: 18px;
  }
  .chevron {
    width: 12px;
    flex-shrink: 0;
    color: var(--fg-faint);
    font-size: 10px;
    text-align: center;
    cursor: pointer;
  }
  .chevron:hover {
    color: var(--fg);
  }
  .kind-icon {
    color: var(--accent);
    font-weight: 700;
  }
  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .parted {
    opacity: 0.5;
    text-decoration: line-through;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot.ok {
    background: #3fb950;
  }
  .dot.pending {
    background: #d29922;
  }
  .dot.off {
    background: #6e7681;
  }
  .badge {
    background: var(--border);
    color: var(--fg);
    border-radius: 9px;
    padding: 0 6px;
    font-size: 11px;
    min-width: 16px;
    text-align: center;
  }
  .badge.hl {
    background: var(--accent);
    color: #fff;
  }
  .highlight .label {
    color: var(--accent);
  }
  .empty {
    padding: 20px 12px;
    text-align: center;
    color: var(--fg-dim);
    font-size: 13px;
  }
  .connect-cta {
    margin-top: 8px;
    padding: 7px 12px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent-soft);
    color: var(--fg);
    cursor: pointer;
  }
</style>
