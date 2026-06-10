<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { loadProfiles, loadProfilePassword, profileMatchesHost, type NickProfile } from "$lib/profiles";
  import {
    loadServers,
    saveServers,
    loadServerPassword,
    saveServerPassword,
    deleteServerPassword,
    newServer,
    type SavedServer,
  } from "$lib/servers";
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

  let tab = $state<"server" | "identity">("server");
  // Connect into the current server window by default; tick to add another.
  let newWindow = $state(false);
  let presetName = $state("DALnet");
  let host = $state("irc.dal.net");
  let port = $state(6697);
  let tls = $state(true);
  let nick = $state("RAVE" + Math.floor(Math.random() * 1000));
  let username = $state("rave");
  let realname = $state("RAVEIRC user");
  let autojoin = $state("");
  let saslPassword = $state("");
  let serverPassword = $state("");
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
    selectedServerId = "";
    const p = presets.find((x) => x.name === name);
    if (p && p.name !== "Custom") {
      host = p.host;
      port = p.port;
      tls = p.tls;
    }
  }

  // ---- Saved custom servers (host/port/tls + keychain server password) -------
  let savedServers = $state<SavedServer[]>(loadServers());
  let selectedServerId = $state("");
  let saveName = $state("");

  function applySavedServer(id: string) {
    const s = savedServers.find((x) => x.id === id);
    if (!s) return;
    selectedServerId = id;
    presetName = "Custom";
    host = s.host;
    port = s.port;
    tls = s.tls;
    serverPassword = "";
    loadServerPassword(id).then((pw) => {
      if (selectedServerId === id) serverPassword = pw;
    });
  }

  function saveCurrentServer() {
    if (!host) return;
    const name = (saveName.trim() || host).trim();
    const srv = newServer();
    srv.name = name;
    srv.host = host;
    srv.port = port;
    srv.tls = tls;
    savedServers = [...savedServers, srv];
    saveServers(savedServers);
    saveServerPassword(srv.id, serverPassword);
    selectedServerId = srv.id;
    saveName = "";
  }

  /** Save edits (host/port/TLS/password, optional rename) to the selected server. */
  function updateSavedServer() {
    const i = savedServers.findIndex((s) => s.id === selectedServerId);
    if (i < 0) return;
    const name = (saveName.trim() || savedServers[i].name || host).trim();
    savedServers[i] = { ...savedServers[i], name, host, port, tls, serverPassword: "" };
    savedServers = [...savedServers];
    saveServers(savedServers);
    saveServerPassword(selectedServerId, serverPassword);
    saveName = "";
  }

  function deleteSavedServer(id: string) {
    savedServers = savedServers.filter((s) => s.id !== id);
    saveServers(savedServers);
    deleteServerPassword(id);
    if (selectedServerId === id) selectedServerId = "";
  }

  // Saved identity profiles, filtered to those that suit the chosen server.
  // Reload from storage every time the dialog opens so profiles created in the
  // Nick Manager after app start show up here.
  let allProfiles = $state<NickProfile[]>(loadProfiles());
  let profileId = $state("");
  const matchingProfiles = $derived(allProfiles.filter((p) => profileMatchesHost(p, host)));

  $effect(() => {
    if (open) {
      allProfiles = loadProfiles(); // passwords fetched lazily on profile select
      savedServers = loadServers();
    }
  });

  function applyProfile(id: string) {
    profileId = id;
    const p = allProfiles.find((x) => x.id === id);
    if (!p) return;
    nick = p.nick || nick;
    username = p.username || username;
    realname = p.realname || realname;
    // Fetch this profile's password from the keychain only now (explicit choice).
    nickservPassword = "";
    loadProfilePassword(p.id).then((pw) => {
      if (profileId === id) nickservPassword = pw;
    });
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
      password: serverPassword || undefined,
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
    // Default: reconnect the current server window in place (mIRC /server).
    // With "New server window" ticked, open an additional connection (/server -m).
    const target = newWindow ? undefined : (irc.active?.serverId ?? irc.servers[0]?.id);
    if (target != null) await irc.reconnect(target, config);
    else await irc.connect(config);
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

      <div class="tabs">
        <button class:active={tab === "server"} onclick={() => (tab = "server")}>Server</button>
        <button class:active={tab === "identity"} onclick={() => (tab = "identity")}>Identity</button>
      </div>

      {#if tab === "server"}
        <div class="presets">
          {#each presets as p (p.name)}
            <button class:active={presetName === p.name} onclick={() => applyPreset(p.name)}>
              {p.name}
            </button>
          {/each}
        </div>

        {#if savedServers.length}
          <div class="saved">
            {#each savedServers as s (s.id)}
              <span class="srv" class:active={selectedServerId === s.id}>
                <button class="pick" title={`${s.host}:${s.port}${s.tls ? " (TLS)" : ""}`} onclick={() => applySavedServer(s.id)}>{s.name}</button>
                <button class="del" title="Delete saved server" onclick={() => deleteSavedServer(s.id)}>✕</button>
              </span>
            {/each}
          </div>
        {/if}

        <div class="grid">
          <label>Server<input bind:value={host} placeholder="irc.example.net" /></label>
          <label class="small">Port<input type="number" bind:value={port} /></label>
          <label class="check">
            <input type="checkbox" bind:checked={tls} /> TLS/SSL
          </label>

          <label class="wide">Server password<input type="password" bind:value={serverPassword} placeholder="for ZNC / bouncers — sent as PASS" /></label>
          <p class="hint wide">ZNC format: <code>user/network:password</code></p>
          <div class="wide save-row">
            <input bind:value={saveName} placeholder={selectedServerId ? "Rename… (optional)" : "Save this server as… (name)"} />
            {#if selectedServerId}
              <button class="save-btn primary" onclick={updateSavedServer} disabled={!host} title="Save your edits to the selected server">💾 Save changes</button>
            {/if}
            <button class="save-btn" onclick={saveCurrentServer} disabled={!host} title="Save as a new custom server">＋ Save{selectedServerId ? " new" : " server"}</button>
          </div>
          <label class="wide">Auto-join (comma separated)<input bind:value={autojoin} placeholder="#channel, #another" /></label>
        </div>
      {:else}
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
          <label>Nick<input bind:value={nick} /></label>
          <label>Username<input bind:value={username} /></label>
          <label class="wide">Real name<input bind:value={realname} /></label>
          <label class="wide">Alt nicks (comma separated)<input bind:value={altNicks} placeholder="RAVE_, RAVE__" /></label>
          <label class="wide">SASL password (optional)<input type="password" bind:value={saslPassword} /></label>
          <label class="wide">NickServ password<input type="password" bind:value={nickservPassword} /></label>
          <label class="check-line"><input type="checkbox" bind:checked={autoIdentify} /> Auto-identify to NickServ on connect</label>
          <label class="check-line"><input type="checkbox" bind:checked={autoGhost} /> Auto-ghost / regain my nick if in use</label>
          <label class="check-line"><input type="checkbox" bind:checked={autoRelease} /> Auto-release my nick if held</label>
        </div>
      {/if}

      <div class="actions">
        <label class="newwin" title="Open this connection in an additional server window instead of reusing the current one">
          <input type="checkbox" bind:checked={newWindow} /> New server window
        </label>
        <span class="sp"></span>
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
    max-height: 88vh;
    overflow-y: auto;
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
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--fg-dim);
    padding: 7px 14px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: -1px;
  }
  .tabs button.active {
    color: var(--fg);
    border-bottom-color: var(--accent);
  }
  .hint {
    margin: -6px 0 2px;
    font-size: 11px;
    color: var(--fg-faint);
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
  .saved {
    display: flex;
    gap: 6px;
    margin: -8px 0 16px;
    flex-wrap: wrap;
  }
  .saved .srv {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .saved .srv.active {
    border-color: var(--accent);
  }
  .saved .pick {
    border: none;
    background: var(--bg);
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 12px;
    padding: 5px 8px 5px 10px;
  }
  .saved .srv.active .pick {
    background: var(--accent-soft);
    color: var(--fg);
  }
  .saved .del {
    border: none;
    border-left: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-faint);
    cursor: pointer;
    font-size: 11px;
    padding: 0 7px;
  }
  .saved .del:hover {
    color: var(--accent);
  }
  .save-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .save-row input {
    flex: 1;
    min-width: 0;
  }
  .save-btn {
    white-space: nowrap;
    padding: 7px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 12px;
  }
  .save-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--fg);
  }
  .save-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .save-btn.primary {
    border-color: var(--accent);
    color: var(--fg);
  }
  .save-btn.primary:hover:not(:disabled) {
    background: var(--accent-soft);
  }
  code {
    font-family: var(--mono);
    font-size: 11px;
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
    padding: 7px 28px 7px 9px;
    color: var(--fg);
    font-size: 13px;
    outline: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236e7681' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 9px center;
    background-size: 12px;
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
  .wide {
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
    align-items: center;
    gap: 8px;
    margin-top: 20px;
  }
  .actions .sp {
    flex: 1;
  }
  .newwin {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--fg-dim);
    cursor: pointer;
    white-space: nowrap;
  }
  .newwin input {
    width: auto;
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
