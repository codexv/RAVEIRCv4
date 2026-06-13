<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";

  // The channel buffer this dialog is bound to (null = closed).
  const buf = $derived(
    irc.channelDialogId ? (irc.buffers.find((b) => b.id === irc.channelDialogId) ?? null) : null,
  );
  const isOp = $derived(buf ? irc.isOpIn(buf.serverId, buf.name) : false);
  const bans = $derived(buf?.bans ?? []);

  // mIRC Channel Central boolean modes.
  const MODES: { flag: string; label: string }[] = [
    { flag: "m", label: "Moderated (+m)" },
    { flag: "n", label: "No external messages (+n)" },
    { flag: "t", label: "Only ops set topic (+t)" },
    { flag: "i", label: "Invite only (+i)" },
    { flag: "s", label: "Secret (+s)" },
    { flag: "p", label: "Private (+p)" },
  ];
  const flags = $derived(buf?.modeFlags ?? "");

  let topicDraft = $state("");
  let newBan = $state("");
  let keyDraft = $state("");
  let limitDraft = $state("");
  // Reset the editable fields whenever a different channel dialog opens.
  let lastId = $state<string | null>(null);
  $effect(() => {
    if (buf && buf.id !== lastId) {
      topicDraft = buf.topic;
      newBan = "";
      keyDraft = buf.modeKey ?? "";
      limitDraft = buf.modeLimit ? String(buf.modeLimit) : "";
      lastId = buf.id;
    }
  });
  // Keep key/limit drafts synced when the server reports new values.
  $effect(() => {
    keyDraft = buf?.modeKey ?? "";
  });
  $effect(() => {
    limitDraft = buf?.modeLimit ? String(buf.modeLimit) : "";
  });

  function close() {
    irc.channelDialogId = null;
    lastId = null;
  }

  function saveTopic() {
    if (!buf || !isOp) return;
    if (topicDraft !== buf.topic) irc.setChannelTopic(buf.serverId, buf.name, topicDraft);
  }
  function unban(mask: string) {
    if (buf && isOp) irc.removeBan(buf.serverId, buf.name, mask);
  }
  function addBan() {
    if (buf && isOp && newBan.trim()) {
      irc.addBan(buf.serverId, buf.name, newBan);
      newBan = "";
    }
  }

  function fmtWhen(ts?: number): string {
    if (!ts) return "";
    const d = new Date(ts * 1000);
    return d.toLocaleDateString() + " " + d.toTimeString().slice(0, 5);
  }

  // Close only on a true backdrop click (press + release on the overlay).
  let pressedBackdrop = $state(false);
  function backdropDown(e: PointerEvent) {
    pressedBackdrop = e.target === e.currentTarget;
  }
  function backdropClick(e: MouseEvent) {
    if (pressedBackdrop && e.target === e.currentTarget) close();
    pressedBackdrop = false;
  }
  $effect(() => {
    if (!buf) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

{#if buf}
  <div class="overlay" onpointerdown={backdropDown} onclick={backdropClick} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="head">
        <div class="title">{buf.name}</div>
        <div class="role" class:op={isOp}>{isOp ? "operator" : "not an operator"}</div>
        <button class="x" onclick={close} title="Close" aria-label="Close">✕</button>
      </div>

      <div class="body">
        <section>
          <span class="lbl">Topic</span>
          <textarea
            class="topic"
            bind:value={topicDraft}
            readonly={!isOp}
            rows="3"
            placeholder={isOp ? "Set the channel topic…" : "(no topic)"}
          ></textarea>
          <div class="row">
            {#if isOp}
              <button class="btn primary" onclick={saveTopic} disabled={topicDraft === buf.topic}>
                Set topic
              </button>
              <button class="btn" onclick={() => (topicDraft = buf.topic)} disabled={topicDraft === buf.topic}>
                Revert
              </button>
            {:else}
              <span class="hint">Op required to change the topic.</span>
            {/if}
          </div>
        </section>

        <section>
          <span class="lbl">Channel modes</span>
          <div class="modes">
            {#each MODES as m (m.flag)}
              <label class="mode" class:dim={!isOp}>
                <input
                  type="checkbox"
                  checked={flags.includes(m.flag)}
                  disabled={!isOp}
                  onchange={(e) =>
                    buf && irc.setChannelMode(buf.serverId, buf.name, m.flag, e.currentTarget.checked)}
                />
                {m.label}
              </label>
            {/each}
          </div>
          <div class="row">
            <label class="kv">
              Key (+k)
              <input
                class="kv-in"
                bind:value={keyDraft}
                readonly={!isOp}
                placeholder="none"
                spellcheck="false"
                autocomplete="off"
              />
            </label>
            {#if isOp}
              <button
                class="btn small"
                onclick={() => buf && irc.setChannelKey(buf.serverId, buf.name, keyDraft.trim())}
                disabled={keyDraft.trim() === (buf.modeKey ?? "")}
              >
                Set
              </button>
            {/if}
            <label class="kv">
              Limit (+l)
              <input
                class="kv-in short"
                type="number"
                min="0"
                bind:value={limitDraft}
                readonly={!isOp}
                placeholder="none"
              />
            </label>
            {#if isOp}
              <button
                class="btn small"
                onclick={() => buf && irc.setChannelLimit(buf.serverId, buf.name, Number(limitDraft) || 0)}
                disabled={(Number(limitDraft) || 0) === (buf.modeLimit ?? 0)}
              >
                Set
              </button>
            {/if}
          </div>
        </section>

        <section>
          <div class="ban-head">
            <span class="lbl">Ban list (+b){bans.length ? ` — ${bans.length}` : ""}</span>
            <button class="btn small" onclick={() => irc.refreshBans(buf.serverId, buf.name)}>
              ↻ Refresh
            </button>
          </div>

          {#if buf.bansLoading && bans.length === 0}
            <div class="empty">Loading…</div>
          {:else if bans.length === 0}
            <div class="empty">No bans set.</div>
          {:else}
            <div class="bans">
              {#each bans as b (b.mask)}
                <div class="ban">
                  <span class="mask" title={b.mask}>{b.mask}</span>
                  <span class="meta">
                    {#if b.by}by {b.by}{/if}{#if b.ts}&nbsp;· {fmtWhen(b.ts)}{/if}
                  </span>
                  {#if isOp}
                    <button class="btn small danger" onclick={() => unban(b.mask)} title="Remove ban">
                      Unban
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if isOp}
            <form class="row" onsubmit={(e) => { e.preventDefault(); addBan(); }}>
              <input
                class="addmask"
                bind:value={newBan}
                placeholder="nick!user@host  (add a ban)"
                spellcheck="false"
                autocomplete="off"
              />
              <button class="btn primary" type="submit" disabled={!newBan.trim()}>Add ban</button>
            </form>
          {/if}
        </section>
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
    width: 560px;
    max-width: 94vw;
    max-height: 86vh;
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
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .title {
    font-weight: 700;
    font-family: var(--mono);
    color: var(--fg);
    font-size: 15px;
  }
  .role {
    font-size: 11px;
    color: var(--fg-dim);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 8px;
  }
  .role.op {
    color: var(--accent);
    border-color: var(--accent);
  }
  .x {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 6px;
  }
  .x:hover {
    background: var(--hover);
    color: var(--fg);
  }
  .body {
    padding: 16px 18px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .lbl {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-dim);
    margin-bottom: 6px;
  }
  .topic {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    font-family: var(--mono);
    font-size: 13px;
    padding: 8px 10px;
  }
  .topic:read-only {
    opacity: 0.7;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
  }
  .hint {
    font-size: 12px;
    color: var(--fg-dim);
  }
  .modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 14px;
  }
  .mode {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: var(--fg);
  }
  .mode.dim {
    color: var(--fg-dim);
  }
  .kv {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--fg-dim);
  }
  .kv-in {
    width: 120px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    font-family: var(--mono);
    font-size: 12px;
    padding: 5px 8px;
    outline: none;
  }
  .kv-in.short {
    width: 70px;
  }
  .kv-in:focus {
    border-color: var(--accent);
  }
  .ban-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .empty {
    font-size: 12px;
    color: var(--fg-dim);
    padding: 8px 0;
  }
  .bans {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
  }
  .ban {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .mask {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .meta {
    font-size: 11px;
    color: var(--fg-dim);
    white-space: nowrap;
  }
  .addmask {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    font-family: var(--mono);
    font-size: 12px;
    padding: 7px 10px;
    outline: none;
  }
  .addmask:focus {
    border-color: var(--accent);
  }
  .btn {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--fg);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .btn.small {
    padding: 3px 9px;
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: 600;
  }
  .btn.danger:hover:not(:disabled) {
    border-color: #d2453a;
    color: #ff6b5e;
  }
</style>
