<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { detectNetwork } from "$lib/irc/network";
  import { channelKey, saveRaveConfig, type ProtectionsConfig, type RaveConfig } from "$lib/irc/rave";

  let config = $state<RaveConfig | null>(null);
  let selectedKey = $state("");
  let joinServer = $state<number | null>(null);
  let joinChan = $state("");
  let joinKey = $state("");
  // Offline "add channel" form.
  let addChan = $state("");
  let addNet = $state("dalnet");
  // Channels the user manages (persisted), kept listed even when using global.
  let managed = $state<string[]>([]);
  const MKEY = "raveirc.managedChannels";
  function loadManaged(): string[] {
    try {
      const r = JSON.parse(localStorage.getItem(MKEY) ?? "");
      if (Array.isArray(r)) return r;
    } catch {
      /* ignore */
    }
    return [];
  }
  function persistManaged() {
    localStorage.setItem(MKEY, JSON.stringify($state.snapshot(managed)));
  }

  // Networks a channel can belong to (match detectNetwork() ids).
  const NETS = [
    { value: "dalnet", label: "DALnet" },
    { value: "undernet", label: "Undernet" },
    { value: "libera", label: "Libera.Chat" },
    { value: "rizon", label: "Rizon" },
    { value: "quakenet", label: "QuakeNet" },
    { value: "efnet", label: "EFnet" },
    { value: "ircnet", label: "IRCnet" },
    { value: "generic", label: "Other" },
  ];
  const netLabel = (id: string) => NETS.find((n) => n.value === id)?.label ?? id;

  // Per-channel protections that are simple enable/ban toggles.
  const PROTS = [
    { key: "badword", label: "Bad words" },
    { key: "caps", label: "Excess caps" },
    { key: "flood", label: "Flood" },
    { key: "clone", label: "Clones" },
    { key: "length", label: "Long lines" },
    { key: "ctcpFlood", label: "CTCP flood" },
    { key: "tricks", label: "Exploits / tricks" },
  ] as const;

  $effect(() => {
    if (irc.channelManagerOpen && !config) {
      config = structuredClone($state.snapshot(irc.raveConfig)) as RaveConfig;
      joinServer = irc.servers[0]?.id ?? null;
      managed = loadManaged();
    }
  });

  const channels = $derived.by(() => {
    if (!config) return [] as { key: string; label: string; joined: boolean; override: boolean }[];
    const map = new Map<string, { key: string; label: string; joined: boolean; override: boolean }>();
    for (const b of irc.buffers) {
      if (b.kind !== "channel") continue;
      const srv = irc.servers.find((s) => s.id === b.serverId);
      const net = srv ? detectNetwork(srv) : "generic";
      const k = channelKey(net, b.name);
      map.set(k, { key: k, label: `${b.name} · ${netLabel(net)}`, joined: true, override: !!config!.channelProtections[k] });
    }
    // Channels with overrides, plus ones the user manages (even if global).
    for (const k of [...Object.keys(config.channelProtections), ...managed]) {
      if (!map.has(k)) {
        const slash = k.indexOf("/");
        const net = slash >= 0 ? k.slice(0, slash) : "generic";
        const chan = slash >= 0 ? k.slice(slash + 1) : k;
        map.set(k, { key: k, label: `${chan} · ${netLabel(net)}`, joined: false, override: !!config.channelProtections[k] });
      }
    }
    return [...map.values()];
  });

  /** Add a channel to manage offline (creates a per-channel override entry). */
  function addChannel() {
    if (!config || !addChan.trim()) return;
    let chan = addChan.trim();
    if (!/^[#&!+]/.test(chan)) chan = "#" + chan;
    const key = channelKey(addNet, chan);
    if (!config.channelProtections[key]) {
      config.channelProtections[key] = structuredClone($state.snapshot(config.protections)) as ProtectionsConfig;
    }
    if (!managed.includes(key)) {
      managed = [...managed, key];
      persistManaged();
    }
    selectedKey = key;
    addChan = "";
  }

  /** Remove a managed channel entirely (its override + the list entry). */
  function removeChannel(key: string) {
    if (!config) return;
    delete config.channelProtections[key];
    managed = managed.filter((k) => k !== key);
    persistManaged();
    if (selectedKey === key) selectedKey = "";
  }

  const activeProt = $derived(config && selectedKey ? config.channelProtections[selectedKey] ?? null : null);
  const selected = $derived(channels.find((c) => c.key === selectedKey) ?? null);

  /** Parse "network/#channel" from a key. */
  function splitKey(key: string): { net: string; chan: string } {
    const i = key.indexOf("/");
    return i >= 0 ? { net: key.slice(0, i), chan: key.slice(i + 1) } : { net: "generic", chan: key };
  }

  /** A connected server whose network matches the selected channel, if any. */
  const joinTarget = $derived.by(() => {
    if (!selected || selected.joined) return null;
    const { net } = splitKey(selected.key);
    return (
      irc.servers.find(
        (s) =>
          (s.status === "registered" || s.status === "connected") && detectNetwork(s) === net,
      ) ?? null
    );
  });

  function joinSelected() {
    if (!selected || !joinTarget) return;
    irc.joinChannel(joinTarget.id, splitKey(selected.key).chan);
  }

  function customize() {
    if (!config || !selectedKey) return;
    config.channelProtections[selectedKey] = structuredClone($state.snapshot(config.protections)) as ProtectionsConfig;
  }
  function resetGlobal() {
    if (!config || !selectedKey) return;
    delete config.channelProtections[selectedKey];
  }

  function doJoin() {
    if (joinServer == null || !joinChan.trim()) return;
    irc.joinChannel(joinServer, joinChan, joinKey || undefined);
    joinChan = "";
    joinKey = "";
  }

  async function save() {
    if (!config) return;
    await saveRaveConfig(config);
    irc.applyConfig(config);
    close();
  }
  function close() {
    irc.channelManagerOpen = false;
    config = null;
    selectedKey = "";
  }

  $effect(() => {
    if (!irc.channelManagerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let pressed = $state(false);
  function down(e: PointerEvent) {
    pressed = e.target === e.currentTarget;
  }
  function up(e: MouseEvent) {
    if (pressed && e.target === e.currentTarget) close();
    pressed = false;
  }
</script>

{#if irc.channelManagerOpen && config}
  <div class="overlay" onpointerdown={down} onclick={up} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="head">
        <span class="title">Channel Manager</span>
        <button class="x" onclick={close}>✕</button>
      </div>

      <div class="join">
        <span class="group-label">Add a channel (edit protections offline)</span>
        <div class="join-row">
          <select bind:value={addNet}>
            {#each NETS as n (n.value)}<option value={n.value}>{n.label}</option>{/each}
          </select>
          <input class="chan" bind:value={addChan} placeholder="#channel" onkeydown={(e) => e.key === "Enter" && addChannel()} />
          <button class="go" onclick={addChannel}>Add</button>
        </div>

        <span class="group-label" style="margin-top:10px">Join a channel</span>
        <div class="join-row">
          {#if irc.servers.length > 1}
            <select bind:value={joinServer}>
              {#each irc.servers as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
            </select>
          {/if}
          <input class="chan" bind:value={joinChan} placeholder="#channel" onkeydown={(e) => e.key === "Enter" && doJoin()} />
          <input class="key" bind:value={joinKey} placeholder="key (optional)" />
          <button class="go" onclick={doJoin} disabled={joinServer == null}>Join</button>
        </div>
        {#if irc.servers.length === 0}<p class="hint">Not connected — you can still add channels above and set their protections offline.</p>{/if}
      </div>

      <div class="body">
        <div class="list">
          <span class="group-label">Channels</span>
          {#if channels.length === 0}
            <p class="empty">No channels yet — add or join one above.</p>
          {/if}
          {#each channels as c (c.key)}
            <button class="ch" class:active={selectedKey === c.key} onclick={() => (selectedKey = c.key)}>
              <span class="ch-name">{c.label}</span>
              <span class="tags">
                {#if c.joined}<span class="tag j">joined</span>{/if}
                {#if c.override}<span class="tag o">custom</span>{/if}
              </span>
            </button>
          {/each}
        </div>

        <div class="detail">
          {#if !selectedKey}
            <p class="muted">Select a channel to set its protections.</p>
          {:else if !activeProt}
            <p class="muted">Using <b>global</b> protections for this channel.</p>
            <div class="detail-actions">
              {#if selected && !selected.joined}
                <button class="go" onclick={joinSelected} disabled={!joinTarget}
                  title={joinTarget ? `Join on ${joinTarget.name}` : "Connect to this network to join"}>Join</button>
              {/if}
              <button class="reset" onclick={customize}>Customize</button>
              {#if selected && !selected.joined}
                <button class="reset" onclick={() => removeChannel(selectedKey)}>Remove</button>
              {/if}
            </div>
          {:else}
            <div class="prot-head">
              <span class="muted">Custom protections for this channel</span>
              <div class="detail-actions">
                {#if selected && !selected.joined}
                  <button class="go" onclick={joinSelected} disabled={!joinTarget}
                    title={joinTarget ? `Join on ${joinTarget.name}` : "Connect to this network to join"}>Join</button>
                {/if}
                <button class="reset" onclick={resetGlobal}>Use global</button>
                {#if selected && !selected.joined}
                  <button class="reset" onclick={() => removeChannel(selectedKey)}>Remove</button>
                {/if}
              </div>
            </div>
            <div class="prot-grid">
              <div class="prot-hdr"><span>Protection</span><span>On</span><span>Ban</span></div>
              {#each PROTS as p (p.key)}
                {@const t = activeProt[p.key]}
                <div class="prot-row">
                  <span>{p.label}</span>
                  <input type="checkbox" bind:checked={t.enabled} />
                  <input type="checkbox" bind:checked={t.ban} disabled={!t.enabled} />
                </div>
              {/each}
            </div>
            <label class="ban-min">Ban duration (minutes, 0 = permanent)
              <input type="number" min="0" bind:value={activeProt.banMinutes} />
            </label>
            <label class="chk"><input type="checkbox" bind:checked={activeProt.autoRejoin} /> Auto-rejoin if kicked</label>
            <p class="hint">Fine-tune thresholds (caps %, flood rate, clone limit…) in Settings → Protections.</p>
          {/if}
        </div>
      </div>

      <div class="footer">
        <button class="cancel" onclick={close}>Cancel</button>
        <button class="go" onclick={save}>Save &amp; apply</button>
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
    z-index: 110;
  }
  .panel {
    width: 680px;
    max-width: 94vw;
    height: 520px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
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
  .join {
    padding: 12px 18px;
    border-bottom: 1px solid var(--border);
  }
  .join-row {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
  .join-row .chan {
    flex: 1;
  }
  .join-row .key {
    width: 130px;
  }
  .group-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--fg-faint);
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .list {
    width: 240px;
    border-right: 1px solid var(--border);
    padding: 12px;
    overflow-y: auto;
  }
  .ch {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--fg-dim);
    padding: 7px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    text-align: left;
  }
  .ch:hover {
    background: var(--hover);
  }
  .ch.active {
    background: var(--accent-soft);
    color: var(--fg);
  }
  .ch-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tags {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .tag {
    font-size: 9px;
    text-transform: uppercase;
    padding: 1px 4px;
    border-radius: 4px;
  }
  .tag.j {
    background: #1f6f3f;
    color: #d7ffe5;
  }
  .tag.o {
    background: var(--accent);
    color: #fff;
  }
  .empty,
  .muted {
    color: var(--fg-dim);
    font-size: 12px;
  }
  .detail {
    flex: 1;
    padding: 14px 18px;
    overflow-y: auto;
  }
  .prot-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .reset {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--fg-dim);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .reset:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .detail-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .prot-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .prot-hdr,
  .prot-row {
    display: grid;
    grid-template-columns: 1fr 40px 40px;
    align-items: center;
    gap: 6px;
    padding: 5px 4px;
    font-size: 13px;
    color: var(--fg);
  }
  .prot-hdr {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--fg-faint);
    border-bottom: 1px solid var(--border);
  }
  .prot-row input {
    justify-self: center;
    accent-color: var(--accent);
  }
  .ban-min {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--fg-dim);
    margin-top: 12px;
  }
  .ban-min input {
    width: 100px;
  }
  .chk {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--fg-dim);
    margin-top: 10px;
  }
  .chk input {
    accent-color: var(--accent);
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
  .hint {
    font-size: 11px;
    color: var(--fg-faint);
    margin-top: 10px;
  }
  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--border);
  }
  .footer button,
  .go {
    padding: 8px 16px;
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
  .go:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
