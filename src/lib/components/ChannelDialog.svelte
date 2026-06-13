<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";

  // The channel buffer this dialog is bound to (null = closed).
  const buf = $derived(
    irc.channelDialogId ? (irc.buffers.find((b) => b.id === irc.channelDialogId) ?? null) : null,
  );
  const isOp = $derived(buf ? irc.isOpIn(buf.serverId, buf.name) : false);

  // Channel list modes (mIRC Channel Central tabs): bans / excepts / invites.
  type ListKind = "b" | "e" | "I";
  const TABS: { kind: ListKind; label: string }[] = [
    { kind: "b", label: "Bans (+b)" },
    { kind: "e", label: "Exceptions (+e)" },
    { kind: "I", label: "Invites (+I)" },
  ];
  let tab = $state<ListKind>("b");
  const entries = $derived(
    tab === "e" ? (buf?.excepts ?? []) : tab === "I" ? (buf?.invites ?? []) : (buf?.bans ?? []),
  );
  const listLoading = $derived(buf?.listLoading?.[tab] ?? false);
  const countFor = (kind: ListKind) =>
    (kind === "e" ? buf?.excepts : kind === "I" ? buf?.invites : buf?.bans)?.length ?? 0;

  // Ticking clock so timed-ban countdowns update live while the dialog is open.
  let now = $state(Date.now());
  $effect(() => {
    if (!buf) return;
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });

  // --- list selection (multi-select for batch removal) + resizable column ---
  let selected = $state<Set<string>>(new Set());
  let lastClicked = $state<string | null>(null);
  // Clear the selection when the tab or channel changes.
  $effect(() => {
    void tab;
    void buf?.id;
    selected = new Set();
    lastClicked = null;
  });

  function rowClick(e: MouseEvent, mask: string) {
    const masks = entries.map((x) => x.mask);
    if (e.shiftKey && lastClicked && masks.includes(lastClicked)) {
      const a = masks.indexOf(lastClicked);
      const b = masks.indexOf(mask);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const next = new Set(selected);
      for (let i = lo; i <= hi; i++) next.add(masks[i]);
      selected = next;
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selected);
      if (next.has(mask)) next.delete(mask);
      else next.add(mask);
      selected = next;
      lastClicked = mask;
    } else {
      selected = new Set([mask]);
      lastClicked = mask;
    }
  }

  function removeSelected() {
    if (!buf || !isOp || selected.size === 0) return;
    for (const mask of selected) irc.removeMask(buf.serverId, buf.name, tab, mask);
    selected = new Set();
    lastClicked = null;
  }

  // Resizable "mask" column width (px), dragged via the header divider.
  let maskW = $state(230);
  let tableEl = $state<HTMLDivElement | null>(null);
  function startResize(e: PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = maskW;
    const move = (ev: PointerEvent) => {
      const max = (tableEl?.clientWidth ?? 480) - 120;
      maskW = Math.max(90, Math.min(startW + (ev.clientX - startX), max));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

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
  let newMask = $state("");
  let banMinutes = $state(""); // optional timed-ban duration (bans tab only)
  let keyDraft = $state("");
  let limitDraft = $state("");
  // Reset the editable fields whenever a different channel dialog opens.
  let lastId = $state<string | null>(null);
  $effect(() => {
    if (buf && buf.id !== lastId) {
      topicDraft = buf.topic;
      newMask = "";
      banMinutes = "";
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
  function addEntry() {
    if (!buf || !isOp || !newMask.trim()) return;
    const mins = Number(banMinutes);
    if (tab === "b" && mins > 0) {
      irc.timedBan(buf.serverId, buf.name, newMask.trim(), Math.round(mins * 60));
    } else {
      irc.addMask(buf.serverId, buf.name, tab, newMask.trim());
    }
    newMask = "";
    banMinutes = "";
  }

  function fmtWhen(ts?: number): string {
    if (!ts) return "";
    const d = new Date(ts * 1000);
    return d.toLocaleDateString() + " " + d.toTimeString().slice(0, 5);
  }

  /** "expires in 4m 12s" for a timed ban, or "" if permanent. Recomputes on tick. */
  function expiresLabel(mask: string): string {
    if (!buf || tab !== "b") return "";
    const at = irc.banExpiry(buf.serverId, buf.name, mask);
    if (!at) return "";
    const left = Math.max(0, Math.round((at - now) / 1000));
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `⏱ ${m > 0 ? `${m}m ` : ""}${s}s`;
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
          <div class="tabs">
            {#each TABS as t (t.kind)}
              <button class="tab" class:active={tab === t.kind} onclick={() => (tab = t.kind)}>
                {t.label}{countFor(t.kind) ? ` (${countFor(t.kind)})` : ""}
              </button>
            {/each}
            <button class="btn small refresh" onclick={() => irc.refreshList(buf.serverId, buf.name, tab)}>
              ↻
            </button>
          </div>

          {#if listLoading && entries.length === 0}
            <div class="empty">Loading…</div>
          {:else if entries.length === 0}
            <div class="empty">Empty.</div>
          {:else}
            <div class="bans" bind:this={tableEl} style="--maskw:{maskW}px">
              <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
              <div class="ban head">
                <span class="mask">
                  Mask
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <span class="grip" onpointerdown={startResize} title="Drag to resize"></span>
                </span>
                <span class="meta">Set by / when</span>
              </div>
              {#each entries as b (b.mask)}
                <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                <div
                  class="ban row-item"
                  class:selected={selected.has(b.mask)}
                  onclick={(e) => rowClick(e, b.mask)}
                >
                  <span class="mask" title={b.mask}>{b.mask}</span>
                  <span class="meta">
                    {#if expiresLabel(b.mask)}<span class="timed">{expiresLabel(b.mask)}</span>{:else}{#if b.by}by {b.by}{/if}{#if b.ts}&nbsp;· {fmtWhen(b.ts)}{/if}{/if}
                  </span>
                </div>
              {/each}
            </div>
            {#if isOp}
              <div class="row">
                <button class="btn danger" disabled={selected.size === 0} onclick={removeSelected}>
                  Remove selected{selected.size ? ` (${selected.size})` : ""}
                </button>
                <span class="hint">Click to select · Shift/Ctrl-click for multiple</span>
              </div>
            {/if}
          {/if}

          {#if isOp}
            <form class="row" onsubmit={(e) => { e.preventDefault(); addEntry(); }}>
              <input
                class="addmask"
                bind:value={newMask}
                placeholder="nick!user@host"
                spellcheck="false"
                autocomplete="off"
              />
              {#if tab === "b"}
                <input
                  class="kv-in short"
                  type="number"
                  min="0"
                  bind:value={banMinutes}
                  placeholder="min"
                  title="Optional: auto-unban after N minutes (timed ban)"
                />
              {/if}
              <button class="btn primary" type="submit" disabled={!newMask.trim()}>Add</button>
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
  .tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }
  .tab {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--fg-dim);
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .tab:hover {
    color: var(--fg);
  }
  .tab.active {
    color: var(--fg);
    border-bottom-color: var(--accent);
  }
  .refresh {
    margin-left: auto;
  }
  .timed {
    color: var(--accent);
  }
  .empty {
    font-size: 12px;
    color: var(--fg-dim);
    padding: 8px 0;
  }
  .bans {
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    user-select: none;
  }
  /* Two resizable columns (mask | meta); the mask width is the dragged var. */
  .ban {
    display: grid;
    grid-template-columns: var(--maskw, 230px) 1fr;
    align-items: center;
    gap: 10px;
    padding: 5px 8px;
  }
  .row-item {
    cursor: pointer;
    border-top: 1px solid var(--border);
  }
  .row-item:hover {
    background: var(--hover);
  }
  .row-item.selected {
    background: var(--accent-soft);
  }
  .ban.head {
    position: sticky;
    top: 0;
    background: var(--panel);
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-dim);
    z-index: 1;
  }
  .ban.head .mask {
    position: relative;
  }
  /* Draggable divider sitting on the mask column's right edge. */
  .grip {
    position: absolute;
    right: -10px;
    top: -5px;
    bottom: -5px;
    width: 12px;
    cursor: col-resize;
  }
  .grip::after {
    content: "";
    position: absolute;
    left: 5px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--border);
  }
  .mask {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    font-size: 11px;
    color: var(--fg-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
