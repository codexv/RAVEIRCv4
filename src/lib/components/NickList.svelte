<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { appearance } from "$lib/appearance.svelte";
  import NickMenu from "./NickMenu.svelte";
  import type { Buffer, ChanUser } from "$lib/irc/types";

  let { buffer }: { buffer: Buffer | null } = $props();

  // Context-menu state
  let menu = $state<{ x: number; y: number; user: ChanUser } | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);

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

  let selected = $state<string | null>(null);

  const sid = $derived(buffer?.serverId ?? 0);
  const chan = $derived(buffer?.name ?? "");

  // Clicking a nick in the chat window highlights + scrolls to it here.
  $effect(() => {
    const f = irc.nickFocus;
    if (!f || !buffer || f.serverId !== buffer.serverId) return;
    void f.seq; // re-run on every focus request, even for the same nick
    if (!buffer.users.some((u) => u.nick === f.nick)) return;
    selected = f.nick;
    queueMicrotask(() => {
      listEl
        ?.querySelector(`[data-nick="${CSS.escape(f.nick)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  });
</script>

{#if buffer && buffer.kind === "channel"}
  <div class="nicklist">
    <div class="nl-head">{buffer.users.length} users</div>
    <div class="nl-list" bind:this={listEl}>
      {#each buffer.users as user (user.nick)}
        {@const col = colorFor(user)}
        <button
          class="nick-row"
          class:selected={user.nick === selected}
          data-nick={user.nick}
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
  <NickMenu
    {sid}
    {chan}
    nick={menu.user.nick}
    prefix={menu.user.prefix}
    x={menu.x}
    y={menu.y}
    onClose={() => (menu = null)}
  />
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

</style>
