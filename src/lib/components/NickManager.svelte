<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import {
    loadProfiles,
    saveProfiles,
    newProfile,
    NETWORK_CHOICES,
    type NickProfile,
  } from "$lib/profiles";

  let profiles = $state<NickProfile[]>([]);
  let selId = $state<string | null>(null);
  let loaded = $state(false);

  const sel = $derived(profiles.find((p) => p.id === selId) ?? null);
  const server = $derived(irc.activeServer());

  $effect(() => {
    if (irc.nickManagerOpen && !loaded) {
      profiles = loadProfiles();
      selId = profiles[0]?.id ?? null;
      loaded = true;
    }
  });

  function add() {
    const p = newProfile();
    profiles.push(p);
    selId = p.id;
  }
  function dup() {
    if (!sel) return;
    const p = { ...$state.snapshot(sel), id: newProfile().id, label: sel.label + " copy" };
    profiles.push(p);
    selId = p.id;
  }
  function del() {
    if (!sel) return;
    profiles = profiles.filter((p) => p.id !== sel.id);
    selId = profiles[0]?.id ?? null;
  }
  function persist() {
    saveProfiles($state.snapshot(profiles));
  }
  let saved = $state(false);
  let savedTimer: ReturnType<typeof setTimeout> | null = null;
  function doSave() {
    persist();
    saved = true;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (saved = false), 1500);
  }
  function close() {
    persist();
    irc.nickManagerOpen = false;
    loaded = false;
  }

  // Use the selected profile's nick on the current connection.
  function useNickNow() {
    if (sel && server) irc.changeNick(server.id, sel.nick);
  }
  function identify() {
    if (!server) return;
    const pass = sel?.nickservPassword || window.prompt("NickServ password:") || "";
    if (pass) irc.sendInput(`/identify ${pass}`);
  }

  let pressedBackdrop = $state(false);
  function backdropDown(e: PointerEvent) {
    pressedBackdrop = e.target === e.currentTarget;
  }
  function backdropClick(e: MouseEvent) {
    if (pressedBackdrop && e.target === e.currentTarget) close();
    pressedBackdrop = false;
  }
  $effect(() => {
    if (!irc.nickManagerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

{#if irc.nickManagerOpen}
  <div class="overlay" onpointerdown={backdropDown} onclick={backdropClick} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="sidebar">
        <div class="s-title">Profiles</div>
        <div class="plist">
          {#each profiles as p (p.id)}
            <button class="pitem" class:active={p.id === selId} onclick={() => (selId = p.id)}>
              <span class="pl">{p.label || p.nick || "(unnamed)"}</span>
              <span class="pnet">{p.network}</span>
            </button>
          {/each}
          {#if profiles.length === 0}<p class="empty">No profiles yet.</p>{/if}
        </div>
        <button class="add" onclick={add}>＋ New profile</button>
      </div>

      <div class="content">
        <div class="head">
          <span class="title">Nick Manager</span>
          <button class="x" onclick={close}>✕</button>
        </div>

        <div class="body">
        {#if !sel}
          <p class="muted">Create a profile to store a nick identity you can pick at connect time.</p>
        {:else}
          <p class="muted">Edit offline — these are saved and selectable when you connect.</p>
          <div class="grid">
            <label>Profile label<input bind:value={sel.label} oninput={persist} /></label>
            <label>Applies to
              <select bind:value={sel.network} onchange={persist}>
                {#each NETWORK_CHOICES as n (n.value)}<option value={n.value}>{n.label}</option>{/each}
              </select>
            </label>
            <label>Nick<input bind:value={sel.nick} oninput={persist} /></label>
            <label>Alternate nicks (comma separated)<input bind:value={sel.altNicks} oninput={persist} placeholder="RAVE_, RAVE__" /></label>
            <label>Username / ident<input bind:value={sel.username} oninput={persist} /></label>
            <label>Full name (real name)<input bind:value={sel.realname} oninput={persist} /></label>
            <label class="wide">NickServ password<input type="password" bind:value={sel.nickservPassword} oninput={persist} /></label>
          </div>

          <div class="behaviour">
            <span class="b-title">Login behaviour</span>
            <label class="chk"><input type="checkbox" bind:checked={sel.autoIdentify} onchange={persist} /> Auto-identify to NickServ on connect</label>
            <label class="chk"><input type="checkbox" bind:checked={sel.autoGhost} onchange={persist} /> Auto-ghost / regain this nick when it's in use</label>
            <label class="chk"><input type="checkbox" bind:checked={sel.autoRelease} onchange={persist} /> Auto-release this nick when it's held</label>
          </div>

          <div class="actions">
            <button onclick={dup}>Duplicate</button>
            <button class="danger" onclick={del}>Delete</button>
            {#if server}
              <span class="spacer"></span>
              <button onclick={useNickNow} title="Set this nick on {server.name}">Use nick now</button>
              <button onclick={identify}>Identify</button>
            {/if}
          </div>
          {#if server}
            <p class="muted small">Connected to <b>{server.name}</b> as <span class="cur">{server.nick}</span>.</p>
          {/if}
        {/if}
        </div>

        <div class="footer">
          {#if saved}<span class="saved">Saved ✓</span>{/if}
          <span class="spacer"></span>
          <button class="cancel" onclick={close}>Done</button>
          <button class="go" onclick={doSave}>Save</button>
        </div>
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
  .panel {
    width: 680px;
    height: 460px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: grid;
    grid-template-columns: 200px 1fr;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  .sidebar {
    border-right: 1px solid var(--border);
    background: var(--bg);
    display: flex;
    flex-direction: column;
    padding: 12px 10px;
  }
  .s-title {
    font-weight: 700;
    color: var(--fg);
    padding: 2px 6px 10px;
  }
  .plist {
    flex: 1;
    overflow-y: auto;
  }
  .pitem {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--fg-dim);
    padding: 7px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .pitem:hover {
    background: var(--hover);
  }
  .pitem.active {
    background: var(--accent-soft);
    color: var(--fg);
  }
  .pl {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pnet {
    font-size: 10px;
    color: var(--fg-faint);
    flex-shrink: 0;
  }
  .empty {
    color: var(--fg-faint);
    font-size: 12px;
    padding: 8px;
  }
  .add {
    margin-top: 8px;
    padding: 7px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .add:hover {
    border-color: var(--accent);
  }
  .content {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px;
  }
  .footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-top: 1px solid var(--border);
    background: var(--bg);
  }
  .footer .spacer {
    flex: 1;
  }
  .saved {
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
  }
  .footer button {
    padding: 7px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 13px;
  }
  .footer .cancel {
    background: var(--bg);
    color: var(--fg-dim);
  }
  .footer .go {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
    font-weight: 600;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px 0;
    margin-bottom: 8px;
  }
  .title {
    font-weight: 700;
    color: var(--fg);
  }
  .x {
    background: transparent;
    border: none;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 14px;
  }
  .muted {
    color: var(--fg-dim);
    font-size: 12px;
    margin: 0 0 14px;
  }
  .small {
    font-size: 11px;
    margin-top: 12px;
  }
  .cur {
    color: var(--accent);
    font-weight: 600;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
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
  input,
  select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 9px;
    color: var(--fg);
    font-size: 13px;
    outline: none;
  }
  input:focus,
  select:focus {
    border-color: var(--accent);
  }
  .behaviour {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .b-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--fg-faint);
  }
  .chk {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--fg-dim);
    cursor: pointer;
  }
  .chk input {
    width: auto;
    padding: 0;
    border: none;
    background: transparent;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
  }
  .spacer {
    flex: 1;
  }
  .actions button {
    padding: 7px 14px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .actions button:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .actions .danger:hover {
    background: #5a1a1a;
    color: #fff;
    border-color: #5a1a1a;
  }
</style>
