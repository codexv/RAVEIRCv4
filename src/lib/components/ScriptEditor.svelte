<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { saveRaveConfig, DEFAULT_REMOTE, type RaveConfig } from "$lib/irc/rave";

  type Tab = "aliases" | "remote" | "variables";
  let tab = $state<Tab>("aliases");
  let config = $state<RaveConfig | null>(null);
  let error = $state("");
  let wrap = $state(typeof localStorage !== "undefined" && localStorage.getItem("raveirc.editorWrap") !== "off");

  function toggleWrap() {
    wrap = !wrap;
    localStorage.setItem("raveirc.editorWrap", wrap ? "soft" : "off");
  }

  let fontSize = $state(
    typeof localStorage !== "undefined" ? Number(localStorage.getItem("raveirc.editorFont")) || 13 : 13,
  );
  function bumpFont(delta: number) {
    fontSize = Math.min(24, Math.max(9, fontSize + delta));
    localStorage.setItem("raveirc.editorFont", String(fontSize));
  }

  // Floating-window geometry (position + size), remembered across opens.
  const GEO_KEY = "raveirc.editorGeo";
  let geo = $state({ x: 0, y: 0, w: 720, h: 560 });
  let editorEl = $state<HTMLElement | null>(null);

  function loadGeo() {
    try {
      const r = JSON.parse(localStorage.getItem(GEO_KEY) ?? "");
      if (r && typeof r.w === "number") geo = { x: r.x, y: r.y, w: r.w, h: r.h };
    } catch {
      /* defaults */
    }
    // Center the first time (or if off-screen).
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (geo.w > vw) geo.w = Math.max(380, vw - 40);
    if (geo.h > vh) geo.h = Math.max(280, vh - 40);
    if (geo.x <= 0 || geo.x > vw - 80) geo.x = Math.max(20, (vw - geo.w) / 2);
    if (geo.y <= 0 || geo.y > vh - 80) geo.y = Math.max(20, (vh - geo.h) / 2);
  }
  function saveGeo() {
    localStorage.setItem(GEO_KEY, JSON.stringify($state.snapshot(geo)));
  }

  $effect(() => {
    if (irc.scriptEditorOpen && !config) {
      loadGeo();
      config = structuredClone($state.snapshot(irc.raveConfig)) as RaveConfig;
    }
  });

  // Track live size from the CSS resize handle and persist on release.
  $effect(() => {
    if (!editorEl) return;
    const ro = new ResizeObserver(() => {
      if (editorEl) {
        geo.w = editorEl.offsetWidth;
        geo.h = editorEl.offsetHeight;
      }
    });
    ro.observe(editorEl);
    const persist = () => saveGeo();
    window.addEventListener("pointerup", persist);
    return () => {
      ro.disconnect();
      window.removeEventListener("pointerup", persist);
    };
  });

  /** Drag the window by its header (ignore clicks on buttons). */
  function dragStart(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    const dx = e.clientX - geo.x;
    const dy = e.clientY - geo.y;
    const move = (ev: PointerEvent) => {
      geo.x = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dx));
      geo.y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveGeo();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Escape closes/cancels the editor.
  $effect(() => {
    if (!irc.scriptEditorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function save() {
    if (!config) return;
    await saveRaveConfig(config);
    irc.applyConfig(config); // reloads the mSL engine
    close();
  }
  function close() {
    irc.scriptEditorOpen = false;
    config = null;
    error = "";
  }

  /** Replace the Remote script with the built-in RAVE whois art. */
  function loadDefaultWhois() {
    if (!config) return;
    if (config.scripts.remote.trim() && !confirm("Replace the Remote script with the default RAVE whois art?")) return;
    config.scripts.remote = DEFAULT_REMOTE;
    tab = "remote";
  }

  const placeholders: Record<Tab, string> = {
    aliases: "alias hello /msg $chan Hello everyone!\n\nalias slap {\n  /me slaps $1 around a bit with a large trout\n}",
    remote:
      "on *:TEXT:!ping:#: {\n  /msg $chan pong, $nick $+ !\n}\n\non *:JOIN:#: {\n  /notice $nick Welcome to $chan\n}",
    variables: "%greeting Welcome to the channel\n%maxwarns 3",
  };
</script>

{#if irc.scriptEditorOpen && config}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="editor"
    bind:this={editorEl}
    role="dialog"
    tabindex="-1"
    style="left:{geo.x}px; top:{geo.y}px; width:{geo.w}px; height:{geo.h}px"
  >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="ed-head" onpointerdown={dragStart} title="Drag to move">
        <span class="ed-title">Scripts <span class="msl">mIRC scripting</span></span>
        <div class="tabs">
          <button class:active={tab === "aliases"} onclick={() => (tab = "aliases")}>Aliases</button>
          <button class:active={tab === "remote"} onclick={() => (tab = "remote")}>Remote</button>
          <button class:active={tab === "variables"} onclick={() => (tab = "variables")}>Variables</button>
          <button class="wrap-btn" class:active={wrap} onclick={toggleWrap} title="Toggle word wrap">
            ↩ Wrap
          </button>
          <button class="fz" onclick={() => bumpFont(-1)} title="Smaller font">A−</button>
          <button class="fz" onclick={() => bumpFont(1)} title="Larger font">A+</button>
          {#if tab === "remote"}
            <button class="fz" onclick={loadDefaultWhois} title="Replace Remote with the default RAVE whois art">↺ Whois</button>
          {/if}
        </div>
      </div>

      {#if tab === "aliases"}
        <textarea bind:value={config.scripts.aliases} wrap={wrap ? "soft" : "off"} style="font-size:{fontSize}px" placeholder={placeholders.aliases} spellcheck="false"></textarea>
      {:else if tab === "remote"}
        <textarea bind:value={config.scripts.remote} wrap={wrap ? "soft" : "off"} style="font-size:{fontSize}px" placeholder={placeholders.remote} spellcheck="false"></textarea>
      {:else}
        <textarea bind:value={config.scripts.variables} wrap={wrap ? "soft" : "off"} style="font-size:{fontSize}px" placeholder={placeholders.variables} spellcheck="false"></textarea>
      {/if}

      <div class="ed-foot">
        <span class="hint">
          {#if tab === "aliases"}Define <code>/commands</code>: <code>alias name &#123; … &#125;</code> or one-liners.
          {:else if tab === "remote"}Event handlers: <code>on *:TEXT:&lt;match&gt;:#: &#123; … &#125;</code>, JOIN, PART, ACTION, NOTICE.
          {:else}Persistent <code>%variables</code>: <code>%name value</code> per line.{/if}
          Supports $identifiers, %vars, $+, if/elseif/else, while.
        </span>
        <div class="actions">
          <button class="cancel" onclick={close}>Cancel</button>
          <button class="go" onclick={save}>Save &amp; apply</button>
        </div>
      </div>
      {#if error}<p class="err">{error}</p>{/if}
  </div>
{/if}

<style>
  /* Floating, non-modal, resizable window. */
  .editor {
    position: fixed;
    min-width: 380px;
    min-height: 280px;
    max-width: 100vw;
    max-height: 100vh;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    resize: both;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    z-index: 100;
  }
  .ed-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    cursor: move;
    user-select: none;
  }
  .ed-title {
    font-weight: 700;
    color: var(--fg);
  }
  .msl {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 10px;
    padding: 2px 8px;
    margin-left: 6px;
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tabs button {
    padding: 6px 12px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .tabs button.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--fg);
  }
  .wrap-btn {
    margin-left: 10px;
  }
  .fz {
    padding: 6px 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    min-width: 30px;
  }
  .fz:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  textarea {
    flex: 1;
    background: var(--bg);
    border: none;
    color: var(--fg);
    padding: 14px 16px;
    /* Always monospace in the code editor, regardless of the message-font setting. */
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: none;
    outline: none;
    tab-size: 2;
  }
  .ed-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
  }
  .hint {
    font-size: 11px;
    color: var(--fg-dim);
    line-height: 1.5;
  }
  code {
    background: var(--bg);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: var(--mono);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  .actions button {
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
  .err {
    color: #f85149;
    padding: 0 16px 10px;
    margin: 0;
  }
</style>
