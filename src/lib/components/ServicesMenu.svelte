<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { detectNetwork, serviceProfile } from "$lib/irc/network";
  import type { Buffer, Server } from "$lib/irc/types";

  let { buffer, server }: { buffer: Buffer; server: Server | null } = $props();

  let open = $state(false);

  const network = $derived(server ? detectNetwork(server) : "generic");
  const profile = $derived(server ? serviceProfile(server) : null);
  const hasServices = $derived(profile?.hasServices ?? false);
  /** Bot-driven networks (Undernet X / QuakeNet Q): no NickServ ghost, BAN-style akick. */
  const botNet = $derived(network === "undernet" || network === "quakenet");
  /** Account-based access lists we model correctly (not QuakeNet's CHANLEV). */
  const showAccess = $derived(hasServices && network !== "quakenet");
  const netLabel = $derived(network === "generic" ? "Services" : profile?.label ?? "Services");
  const isChannel = $derived(buffer.kind === "channel");

  function run(cmd: string) {
    open = false;
    irc.sendInput(cmd);
  }

  function identify() {
    open = false;
    const pass = window.prompt(`Identify to ${netLabel} NickServ — password:`);
    if (pass) irc.sendInput(`/identify ${pass}`);
  }

  const sid = $derived(buffer.serverId);
  const chan = $derived(buffer.name);

  function akickAdd() {
    open = false;
    const mask = window.prompt("AKick add — nick or hostmask:");
    if (mask) irc.svcAkick(sid, chan, "add", mask);
  }

  function accessAdd(role: string) {
    open = false;
    const nick = window.prompt(`Add ${role} on ${chan} — nick or mask:`);
    if (nick) irc.svcAccessAdd(sid, chan, role, nick);
  }

  function ghost() {
    open = false;
    const nick = window.prompt("Ghost which nick?", server?.nick ?? "");
    if (!nick) return;
    const pass = window.prompt(`NickServ password for ${nick} (blank if already identified):`) ?? "";
    irc.svcGhost(sid, nick, pass);
  }

  function registerChan() {
    open = false;
    const pass = network === "dalnet" ? window.prompt(`Channel password to register ${chan}:`) ?? "" : "";
    irc.svcRegister(sid, chan, pass);
  }
</script>

<div class="services">
  <button class="trigger" class:open onclick={() => (open = !open)}>
    {netLabel} ▾
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={() => (open = false)}></div>
    <div class="menu">
      {#if hasServices}
        <div class="grp">{botNet ? "Auth" : "NickServ"}</div>
        <button onclick={identify}>Identify…</button>
        {#if !botNet}
          <button onclick={ghost}>Ghost / regain nick…</button>
        {/if}
      {/if}

      {#if isChannel}
        <div class="grp">{hasServices ? "ChanServ" : "Channel modes"} — {buffer.name}</div>
        <button onclick={() => run("/op")}>Op me</button>
        <button onclick={() => run("/deop")}>Deop me</button>
        <button onclick={() => run("/voice")}>Voice me</button>
        <button onclick={() => run("/devoice")}>Devoice me</button>
        <div class="sep"></div>
        <button onclick={() => run("/invite")}>Invite me</button>
        <button onclick={() => run("/unban")}>Unban me</button>

        {#if showAccess}
          <div class="grp">Access</div>
          <button onclick={() => accessAdd("SOP")}>Add SOP…</button>
          <button onclick={() => accessAdd("AOP")}>Add AOP…</button>
          <button onclick={() => accessAdd("VOP")}>Add VOP…</button>
          <button onclick={() => irc.svcAccessList(sid, chan)}>List access</button>
        {/if}

        <div class="grp">AKick / Bans</div>
        <button onclick={akickAdd}>{hasServices ? "AKick add…" : "Ban…"}</button>
        <button onclick={() => irc.svcAkick(sid, chan, "list")}>{hasServices ? "AKick list" : "Ban list"}</button>
        {#if hasServices && !botNet}
          <button onclick={() => irc.svcAkick(sid, chan, "wipe")}>AKick wipe</button>
        {/if}

        {#if network === "dalnet"}
          <div class="grp">Anti-takeover</div>
          <button onclick={() => irc.svcMass(sid, chan, "mdeop")}>Mass-deop</button>
          <button onclick={() => irc.svcMass(sid, chan, "mkick")}>Mass-kick</button>
        {/if}

        {#if hasServices}
          <div class="sep"></div>
          <button onclick={registerChan}>Register channel…</button>
          <button onclick={() => run("/csinfo")}>Channel info</button>
        {/if}
      {:else}
        <div class="hint">Open a channel for {hasServices ? "ChanServ" : "channel"} actions.</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .services {
    position: relative;
  }
  .trigger {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--fg-dim);
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .trigger:hover,
  .trigger.open {
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
    min-width: 180px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  .grp {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--fg-faint);
    padding: 6px 8px 3px;
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
  .hint {
    padding: 6px 8px;
    font-size: 12px;
    color: var(--fg-faint);
  }
</style>
