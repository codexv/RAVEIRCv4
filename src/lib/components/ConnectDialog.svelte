<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { loadProfiles, profileMatchesHost, type NickProfile } from "$lib/profiles";
  import type { ServerConfig } from "$lib/irc/types";

  let { open = $bindable() }: { open: boolean } = $props();

  interface Preset {
    name: string;
    host: string;
    port: number;
    tls: boolean;
  }

  const presets: Preset[] = [
    { name: "DALnet", host: "irc.dal.net", port: 6697, tls: true },
    { name: "Libera.Chat", host: "irc.libera.chat", port: 6697, tls: true },
    { name: "Undernet", host: "irc.undernet.org", port: 6697, tls: true },
    { name: "EFnet", host: "irc.efnet.org", port: 6697, tls: true },
    { name: "Custom", host: "", port: 6697, tls: true },
  ];

  let presetName = $state("DALnet");
  let host = $state("irc.dal.net");
  let port = $state(6697);
  let tls = $state(true);
  let nick = $state("RAVE" + Math.floor(Math.random() * 1000));
  let username = $state("rave");
  let realname = $state("RAVEIRC user");
  let autojoin = $state("");
  let saslPassword = $state("");
  let nickservPassword = $state("");
  let autoIdentify = $state(true);
  let autoGhost = $state(true);
  let autoRelease = $state(false);
  // Pre-fill alt nicks from the Nick Manager list (shared via localStorage).
  let altNicks = $state(
    (typeof localStorage !== "undefined" ? localStorage.getItem("raveirc.altNicks") ?? "" : "")
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .join(", "),
  );

  function applyPreset(name: string) {
    presetName = name;
    const p = presets.find((x) => x.name === name);
    if (p && p.name !== "Custom") {
      host = p.host;
      port = p.port;
      tls = p.tls;
    }
  }

  // Saved identity profiles, filtered to those that suit the chosen server.
  // Reload from storage every time the dialog opens so profiles created in the
  // Nick Manager after app start show up here.
  let allProfiles = $state<NickProfile[]>(loadProfiles());
  let profileId = $state("");
  const matchingProfiles = $derived(allProfiles.filter((p) => profileMatchesHost(p, host)));

  $effect(() => {
    if (open) allProfiles = loadProfiles();
  });

  function applyProfile(id: string) {
    profileId = id;
    const p = allProfiles.find((x) => x.id === id);
    if (!p) return;
    nick = p.nick || nick;
    username = p.username || username;
    realname = p.realname || realname;
    nickservPassword = p.nickservPassword;
    autoIdentify = p.autoIdentify;
    autoGhost = p.autoGhost;
    autoRelease = p.autoRelease;
    altNicks = p.altNicks
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .join(", ");
  }

  // Escape closes the dialog (window-level so it works without focus).
  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") open = false;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Only close on a TRUE backdrop click (press AND release on the overlay),
  // so dragging/selecting text inside a field never closes the dialog.
  let pressedBackdrop = $state(false);
  function backdropDown(e: PointerEvent) {
    pressedBackdrop = e.target === e.currentTarget;
  }
  function backdropClick(e: MouseEvent) {
    if (pressedBackdrop && e.target === e.currentTarget) open = false;
    pressedBackdrop = false;
  }

  async function connect() {
    if (!host || !nick) return;
    const config: ServerConfig = {
      host,
      port,
      tls,
      nick,
      username: username || nick,
      realname: realname || "RAVEIRC user",
      saslPassword: saslPassword || undefined,
      saslAccount: saslPassword ? nick : undefined,
      nickservPassword: nickservPassword || undefined,
      autoIdentify,
      autoGhost,
      autoRelease,
      altNicks: altNicks
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean),
      autojoin: autojoin
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    };
    await irc.connect(config);
    open = false;
  }
</script>

{#if open}
  <div
    class="overlay"
    onpointerdown={backdropDown}
    onclick={backdropClick}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <h3>Connect to Server</h3>

      <div class="presets">
        {#each presets as p (p.name)}
          <button class:active={presetName === p.name} onclick={() => applyPreset(p.name)}>
            {p.name}
          </button>
        {/each}
      </div>

      {#if allProfiles.length}
        <label class="profile-row">Identity profile
          <select value={profileId} onchange={(e) => applyProfile(e.currentTarget.value)}>
            <option value="">— Custom —</option>
            {#each matchingProfiles as p (p.id)}
              <option value={p.id}>{p.label} ({p.nick})</option>
            {/each}
          </select>
        </label>
      {/if}

      <div class="grid">
        <label>Server<input bind:value={host} placeholder="irc.example.net" /></label>
        <label class="small">Port<input type="number" bind:value={port} /></label>
        <label class="check">
          <input type="checkbox" bind:checked={tls} /> TLS/SSL
        </label>

        <label>Nick<input bind:value={nick} /></label>
        <label>Username<input bind:value={username} /></label>
        <label class="wide">Real name<input bind:value={realname} /></label>
        <label class="wide">Alt nicks (comma separated)<input bind:value={altNicks} placeholder="RAVE_, RAVE__" /></label>
        <label class="wide">Auto-join (comma separated)<input bind:value={autojoin} placeholder="#channel, #another" /></label>
        <label class="wide">SASL password (optional)<input type="password" bind:value={saslPassword} /></label>
        <label class="wide">NickServ password<input type="password" bind:value={nickservPassword} /></label>
        <label class="check-line"><input type="checkbox" bind:checked={autoIdentify} /> Auto-identify to NickServ on connect</label>
        <label class="check-line"><input type="checkbox" bind:checked={autoGhost} /> Auto-ghost / regain my nick if in use</label>
        <label class="check-line"><input type="checkbox" bind:checked={autoRelease} /> Auto-release my nick if held</label>
      </div>

      <div class="actions">
        <button class="cancel" onclick={() => (open = false)}>Cancel</button>
        <button class="go" onclick={connect}>Connect</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .dialog {
    width: 440px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  h3 {
    margin: 0 0 14px;
    color: var(--fg);
  }
  .presets {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .presets button {
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 12px;
  }
  .presets button.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--fg);
  }
  .profile-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--fg-dim);
    margin-bottom: 14px;
  }
  .profile-row select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 9px;
    color: var(--fg);
    font-size: 13px;
    outline: none;
  }
  .profile-row select:focus {
    border-color: var(--accent);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 90px auto;
    gap: 10px;
    align-items: end;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--fg-dim);
  }
  label.wide {
    grid-column: 1 / -1;
  }
  label.small {
    grid-column: 2;
  }
  label.check {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    grid-column: 3;
  }
  /* One full-width, left-aligned row per toggle (no cramping on the right). */
  label.check-line {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    margin: 0;
  }
  label.check-line input[type="checkbox"] {
    width: auto;
    flex: none;
    margin: 0;
    padding: 0;
    accent-color: var(--accent);
  }
  input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 9px;
    color: var(--fg);
    font-size: 13px;
    outline: none;
  }
  input:focus {
    border-color: var(--accent);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
  .actions button {
    padding: 8px 18px;
    border-radius: 6px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 13px;
  }
  .cancel {
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
