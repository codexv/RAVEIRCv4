<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { irc } from "$lib/irc/store.svelte";
  import { appearance } from "$lib/appearance.svelte";
  import { renderMirc } from "$lib/irc/mirc";
  import TreeBar from "$lib/components/TreeBar.svelte";
  import MessageView from "$lib/components/MessageView.svelte";
  import NickList from "$lib/components/NickList.svelte";
  import InputBox from "$lib/components/InputBox.svelte";
  import ConnectDialog from "$lib/components/ConnectDialog.svelte";
  import Settings from "$lib/components/Settings.svelte";
  import ServicesMenu from "$lib/components/ServicesMenu.svelte";
  import Scratchpad from "$lib/components/Scratchpad.svelte";
  import ScriptsWindow from "$lib/components/ScriptsWindow.svelte";
  import DialogHost from "$lib/components/DialogHost.svelte";
  import UpdateBanner from "$lib/components/UpdateBanner.svelte";
  import HelpMenu from "$lib/components/HelpMenu.svelte";
  import BugReport from "$lib/components/BugReport.svelte";
  import About from "$lib/components/About.svelte";
  import ChannelManager from "$lib/components/ChannelManager.svelte";
  import NickManager from "$lib/components/NickManager.svelte";
  import FontPicker from "$lib/components/FontPicker.svelte";
  import { updater } from "$lib/update.svelte";
  import { isTauri } from "$lib/platform";

  // This page boots in two modes: the main app, or the standalone scripts window
  // (a separate OS window opened with ?view=scripts).
  const isScriptsWindow =
    typeof location !== "undefined" && new URLSearchParams(location.search).get("view") === "scripts";

  let showConnect = $state(false);
  let showSettings = $state(false);
  let sidebarWidth = $state(220);
  let nicklistWidth = $state(170);
  // Mobile: the sidebar (tree) becomes a slide-in drawer.
  let isMobile = $state(false);
  let mobileNav = $state(false);

  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => (isMobile = mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  });

  // Close the drawer once a buffer is picked from the tree (only react to the
  // buffer change, not to mobileNav itself).
  $effect(() => {
    void irc.active?.id;
    untrack(() => {
      if (isMobile && mobileNav) mobileNav = false;
    });
  });

  /** Open (or focus) the Scripts editor as its own OS window, floating over the app. */
  async function openScriptsWindow() {
    if (!isTauri()) return; // web/PWA: no separate OS windows
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const existing = await WebviewWindow.getByLabel("scripts");
    if (existing) {
      await existing.setFocus();
      return;
    }
    new WebviewWindow("scripts", {
      url: "/?view=scripts",
      title: "RAVEIRC — Scripts",
      width: 760,
      height: 600,
      minWidth: 380,
      minHeight: 280,
      resizable: true,
    });
  }

  onMount(() => {
    // Suppress the webview's default right-click menu (Reload/Inspect) everywhere
    // except text fields, where native copy/paste is useful. Applies to both
    // the main app and the scripts window.
    const noCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    window.addEventListener("contextmenu", noCtx);

    if (isScriptsWindow) return; // standalone editor view: no IRC init
    irc.init();
    appearance.init();
    if (isTauri()) updater.check(); // desktop only — mobile/web updates via the host
    // The scripts window asks the main app to reload + recompile after saving.
    import("@tauri-apps/api/event").then(({ listen }) =>
      listen("scripts-applied", async () => {
        const { loadRaveConfig } = await import("$lib/irc/rave");
        const cfg = await loadRaveConfig();
        if (cfg) irc.applyConfig(cfg);
      }),
    );
    const sb = Number(localStorage.getItem("raveirc.sidebarWidth"));
    if (sb >= 160 && sb <= 480) sidebarWidth = sb;
    const nl = Number(localStorage.getItem("raveirc.nicklistWidth"));
    if (nl >= 120 && nl <= 400) nicklistWidth = nl;

    const onKey = (e: KeyboardEvent) => {
      // Ctrl/Cmd+W closes the active window (not the server console).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        const a = irc.active;
        if (a && a.kind !== "server") {
          e.preventDefault();
          irc.closeBuffer(a.id);
        }
        return;
      }
      // Alt+1..9 / Alt+0 → switch to that window (mIRC switchbar).
      if (e.altKey && /^Digit[0-9]$/.test(e.code)) {
        e.preventDefault();
        const n = Number(e.code.slice(5));
        irc.selectByIndex(n === 0 ? 9 : n - 1);
        return;
      }
      // Ctrl+Tab / Ctrl+Shift+Tab → next / previous window.
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        irc.cycleBuffer(e.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** Generic drag-resize helper. `dir` 1 = grow with rightward drag, -1 = grow leftward. */
  function drag(
    e: PointerEvent,
    get: () => number,
    set: (v: number) => void,
    min: number,
    max: number,
    dir: 1 | -1,
    key: string,
  ) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = get();
    const move = (ev: PointerEvent) => {
      set(Math.min(Math.max(startW + dir * (ev.clientX - startX), min), max));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      localStorage.setItem(key, String(get()));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const startResize = (e: PointerEvent) =>
    drag(e, () => sidebarWidth, (v) => (sidebarWidth = v), 160, 480, 1, "raveirc.sidebarWidth");
  const startResizeNick = (e: PointerEvent) =>
    drag(e, () => nicklistWidth, (v) => (nicklistWidth = v), 120, 400, -1, "raveirc.nicklistWidth");

  // Open the Scripts window whenever something requests the editor (topbar / /editor).
  $effect(() => {
    if (!isScriptsWindow && irc.scriptEditorOpen) {
      irc.scriptEditorOpen = false;
      openScriptsWindow();
    }
  });

  // Reflect the version in the OS window title bar.
  $effect(() => {
    if (isScriptsWindow || !irc.appVersion) return;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().setTitle(`RAVEIRC v${irc.appVersion}`).catch(() => {});
    });
  });

  const active = $derived(irc.active);
  const server = $derived(irc.servers.find((s) => s.id === active?.serverId) ?? null);

  function title(): string {
    if (!active) return "RAVEIRC";
    if (active.kind === "server") return server?.name ?? "server";
    return active.name;
  }
</script>

{#if isScriptsWindow}
  <ScriptsWindow />
{:else}
<div class="app">
  <div class="sidebar" class:open={mobileNav} style={isMobile ? "" : `width:${sidebarWidth}px`}>
    <TreeBar onAddServer={() => (showConnect = true)} onOpenSettings={() => (showSettings = true)} />
  </div>
  {#if mobileNav}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="mnav-backdrop" role="presentation" onclick={() => (mobileNav = false)}></div>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="resizer"
    onpointerdown={startResize}
    role="separator"
    aria-orientation="vertical"
    title="Drag to resize"
  ></div>

  <div class="main">
    <div class="topbar">
      <div class="title-block">
        <button class="hamburger" onclick={() => (mobileNav = !mobileNav)} aria-label="Toggle navigation">☰</button>
        <span class="title">{title()}</span>
        {#if irc.appVersion}<span class="ver" title="RAVEIRC version">v{irc.appVersion}</span>{/if}
      </div>
      <div class="top-actions">
        {#if active}
          <ServicesMenu buffer={active} {server} />
          {#if active.kind !== "server"}
            <button class="ghost" onclick={() => irc.closeBuffer(active.id)} title="Close buffer">✕</button>
          {/if}
        {/if}
        {#if server && (server.status === "registered" || server.status === "connected" || server.status === "connecting")}
          <button class="opt-btn danger" onclick={() => irc.disconnectServer(server.id)} title="Disconnect from {server.name}">⏻ Disconnect</button>
        {/if}
        <button class="opt-btn" onclick={() => (showConnect = true)} title="Add server">＋ Connect</button>
        <button class="opt-btn" onclick={() => (irc.nickManagerOpen = true)} title="Nick manager">🪪 Nick</button>
        <button class="opt-btn" onclick={() => (irc.channelManagerOpen = true)} title="Channel manager">＃ Channels</button>
        {#if isTauri()}
          <button class="opt-btn" onclick={() => (irc.scriptEditorOpen = true)} title="Scripts editor">{"</>"}</button>
        {/if}
        <button class="opt-btn" onclick={() => (irc.scratchpadOpen = true)} title="Scratchpad">📝</button>
        <button class="opt-btn" onclick={() => (showSettings = true)} title="Settings">⚙ Settings</button>
        <HelpMenu />
      </div>
    </div>

    {#if active?.kind === "channel" && active.topic}
      <div class="topicbar" title={active.topic}>{@html renderMirc(active.topic)}</div>
    {/if}

    <div class="body">
      <MessageView buffer={active} />
      {#if active?.kind === "channel"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="resizer"
          onpointerdown={startResizeNick}
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
        ></div>
        <div class="nicklist-wrap" style="width:{nicklistWidth}px">
          <NickList buffer={active} />
        </div>
      {/if}
    </div>

    <InputBox buffer={active} />
  </div>
</div>

<ConnectDialog bind:open={showConnect} />
<Settings bind:open={showSettings} />
<Scratchpad />
<NickManager />
<DialogHost />
<UpdateBanner />
<BugReport />
<About />
<ChannelManager />
<FontPicker />
{/if}

<style>
  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  .sidebar {
    flex-shrink: 0;
    height: 100%;
    overflow: hidden;
  }
  .resizer {
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    background: var(--border);
    transition: background 0.15s;
  }
  .resizer:hover {
    background: var(--accent);
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
    min-height: 22px;
  }
  .title-block {
    display: flex;
    align-items: baseline;
    gap: 12px;
    min-width: 0;
  }
  .title {
    font-weight: 700;
    color: var(--fg);
    flex-shrink: 0;
  }
  .ver {
    font-size: 11px;
    color: var(--fg-faint);
    flex-shrink: 0;
    font-family: var(--mono);
  }
  .topicbar {
    padding: 5px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
    color: var(--fg-dim);
    font-size: 12px;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .top-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .opt-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--fg-dim);
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .opt-btn:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .opt-btn.danger:hover {
    border-color: #f0506e;
    color: #f0506e;
  }
  .ghost {
    background: transparent;
    border: none;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 14px;
    padding: 4px 8px;
    border-radius: 5px;
  }
  .ghost:hover {
    background: var(--hover);
    color: var(--fg);
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .nicklist-wrap {
    flex-shrink: 0;
    height: 100%;
    overflow: hidden;
  }

  /* Mobile drawer toggle — hidden on desktop. */
  .hamburger {
    display: none;
    background: transparent;
    border: none;
    color: var(--fg);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 8px 2px 0;
    flex-shrink: 0;
  }
  .mnav-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 40;
  }

  /* Phones / narrow windows: tree becomes a slide-in drawer, nicklist hidden. */
  @media (max-width: 768px) {
    .hamburger {
      display: inline-flex;
    }
    .resizer {
      display: none;
    }
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      height: 100%;
      width: 80vw;
      max-width: 300px;
      z-index: 50;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
      border-right: 1px solid var(--border);
    }
    .sidebar.open {
      transform: none;
      box-shadow: 6px 0 30px rgba(0, 0, 0, 0.6);
    }
    .nicklist-wrap {
      display: none;
    }
    .top-actions {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .top-actions::-webkit-scrollbar {
      display: none;
    }
    .opt-btn {
      white-space: nowrap;
      flex-shrink: 0;
    }
  }
</style>
