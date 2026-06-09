<script lang="ts">
  import { tick } from "svelte";
  import type { Buffer, Line } from "$lib/irc/types";
  import { renderMirc } from "$lib/irc/mirc";
  import { irc } from "$lib/irc/store.svelte";
  import { focusInput } from "$lib/focus";

  let { buffer }: { buffer: Buffer | null } = $props();

  let viewport = $state<HTMLDivElement | null>(null);
  let pinned = $state(true);
  let menu = $state<{ x: number; y: number } | null>(null);

  function openMenu(e: MouseEvent) {
    if (!buffer) return;
    e.preventDefault();
    menu = {
      x: Math.min(e.clientX, window.innerWidth - 210),
      y: Math.min(e.clientY, window.innerHeight - 320),
    };
  }
  function run(cmd: string) {
    menu = null;
    irc.sendInput(cmd);
  }
  function setTopic() {
    menu = null;
    const t = window.prompt("New channel topic:", buffer?.topic ?? "");
    if (t !== null) irc.sendInput(`/topic ${t}`);
  }
  async function copySel() {
    menu = null;
    const sel = window.getSelection()?.toString();
    if (sel) await navigator.clipboard.writeText(sel);
  }
  // Double-clicking inside a query window whoises the person you're talking to.
  function onDblClick() {
    if (buffer?.kind === "query") irc.sendInput(`/whois ${buffer.name}`);
  }

  function fmtTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function onScroll() {
    if (!viewport) return;
    const dist = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    pinned = dist < 40;
  }

  // Auto-scroll to bottom when new lines arrive and we're pinned.
  $effect(() => {
    const _count = buffer?.lines.length;
    void _count;
    if (pinned && viewport) {
      tick().then(() => {
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      });
    }
  });

  // Reset pin when switching buffers.
  $effect(() => {
    const _id = buffer?.id;
    void _id;
    pinned = true;
  });

  // The speaker's current channel mode prefix (@ op, + voice, …) — so you can
  // tell at a glance whether they're an operator.
  function prefixFor(nick: string): string {
    if (!buffer || buffer.kind !== "channel") return "";
    return buffer.users.find((u) => u.nick === nick)?.prefix ?? "";
  }

  function nickColor(nick: string): string {
    let h = 0;
    for (let i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) % 360;
    return `hsl(${h}, 65%, 65%)`;
  }

  function lineClass(line: Line): string {
    return `line line-${line.kind}`;
  }

  function symbolFor(kind: string): string {
    switch (kind) {
      case "join":
        return "→";
      case "part":
      case "quit":
      case "kick":
        return "←";
      case "nick":
        return "↻";
      case "mode":
        return "±";
      case "topic":
        return "≡";
      case "error":
        return "✕";
      default:
        return "•";
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="messages" bind:this={viewport} onscroll={onScroll} oncontextmenu={openMenu} onclick={() => focusInput()} ondblclick={onDblClick}>
  {#if !buffer}
    <div class="placeholder">
      <h2>RAVE<span>IRC</span></h2>
      <p>Select a buffer or connect to a server to begin.</p>
    </div>
  {:else}
    {#each buffer.lines as line (line.id)}
      <div class={lineClass(line)}>
        <span class="ts">{fmtTime(line.ts)}</span>
        {#if line.kind === "message" || line.kind === "self"}
          <span class="nick" style="color:{line.kind === 'self' ? 'var(--accent)' : nickColor(line.from ?? '')}">
            &lt;{#if prefixFor(line.from ?? '')}<span class="uprefix">{prefixFor(line.from ?? '')}</span>{/if}{line.from}&gt;
          </span>
          <span class="text">{@html renderMirc(line.text)}</span>
        {:else if line.kind === "notice"}
          <span class="nick notice-nick">-{line.from}-</span>
          <span class="text">{@html renderMirc(line.text)}</span>
        {:else if line.kind === "action"}
          <span class="star">*</span>
          <span class="text">{@html renderMirc(line.text)}</span>
        {:else if line.kind === "echo"}
          <span class="text">{@html renderMirc(line.text)}</span>
        {:else}
          <span class="sys-prefix">{symbolFor(line.kind)}</span>
          <span class="text sys-text">{@html renderMirc(line.text)}</span>
        {/if}
      </div>
    {/each}
  {/if}
</div>

{#if menu && buffer}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cm-backdrop" onclick={() => (menu = null)} oncontextmenu={(e) => { e.preventDefault(); menu = null; }}></div>
  <div class="cm" style="left:{menu.x}px; top:{menu.y}px">
    <div class="cm-title">{buffer.name}</div>
    <button onclick={copySel}>Copy selection</button>
    <button onclick={() => run("/clear")}>Clear window</button>
    {#if buffer.kind === "query"}
      <div class="cm-sep"></div>
      <button onclick={() => run(`/whois ${buffer.name}`)}>Whois {buffer.name}</button>
    {/if}
    {#if buffer.kind === "channel"}
      <div class="cm-sep"></div>
      <button onclick={setTopic}>Set topic…</button>
      <button onclick={() => run("/names")}>Refresh names</button>
      <button onclick={() => run("/csinfo")}>Channel info</button>
      <button onclick={() => run("/op")}>Op me</button>
      <div class="cm-sep"></div>
      <button class="ai" onclick={() => run("/catchup")}>🤖 AI: Catch me up</button>
      <div class="cm-sep"></div>
      <button class="danger" onclick={() => run("/part")}>Leave channel</button>
    {/if}
    {#if buffer.kind !== "server"}
      <button onclick={() => run("/close")}>Close window</button>
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
    min-width: 190px;
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
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    font-family: var(--mono);
    font-size: var(--msg-size, 13px);
    line-height: 1.5;
    /* User-overridable chat background, independent of the theme. */
    background: var(--chat-bg, var(--bg));
  }
  .placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--fg-dim);
  }
  .placeholder h2 {
    font-size: 52px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin: 0;
    color: var(--fg);
  }
  .placeholder h2 span {
    color: var(--accent);
    text-shadow: 0 0 28px var(--accent);
  }
  .line {
    display: flex;
    gap: 7px;
    padding: 1px 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .ts {
    color: var(--fg-faint);
    flex-shrink: 0;
  }
  .nick {
    flex-shrink: 0;
    font-weight: 600;
  }
  .uprefix {
    color: var(--accent);
    font-weight: 800;
  }
  .notice-nick {
    color: var(--line-notice, #d29922);
  }
  .text {
    flex: 1;
  }
  .star {
    color: var(--line-action, var(--accent));
  }
  .sys-prefix {
    color: var(--fg-faint);
    flex-shrink: 0;
  }
  .sys-text {
    color: var(--line-system, var(--fg-dim));
  }

  /* Per-event text colours (configurable via Settings → Appearance). */
  .line-message .text {
    color: var(--line-message, var(--fg));
  }
  .line-self .text {
    color: var(--line-self, var(--fg));
  }
  .line-notice .text {
    color: var(--line-notice, #d29922);
  }
  .line-action .text {
    color: var(--line-action, var(--accent));
  }
  .line-join .sys-text {
    color: var(--line-join, #3fb950);
  }
  .line-part .sys-text {
    color: var(--line-part, #8b949e);
  }
  .line-quit .sys-text {
    color: var(--line-quit, #6e7681);
  }
  .line-kick .sys-text {
    color: var(--line-kick, #f0883e);
  }
  .line-nick .sys-text {
    color: var(--line-nick, #58a6ff);
  }
  .line-mode .sys-text {
    color: var(--line-mode, #8b949e);
  }
  .line-topic .sys-text {
    color: var(--line-topic, #58a6ff);
  }
  .line-error .sys-text {
    color: var(--line-error, #f85149);
  }
  .line-motd .sys-text {
    color: var(--fg-dim);
  }
</style>
