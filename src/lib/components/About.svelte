<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";

  const REPO = "https://github.com/codexv/RAVEIRCv4";

  async function link(url: string) {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  }
  function close() {
    irc.aboutOpen = false;
  }

  $effect(() => {
    if (!irc.aboutOpen) return;
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

{#if irc.aboutOpen}
  <div class="overlay" onpointerdown={down} onclick={up} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="brand">
        <span class="logo">R</span>
        <div>
          <div class="name">RAVEIRC</div>
          <div class="ver">v{irc.appVersion || "?"}</div>
        </div>
      </div>
      <p class="tag">
        A cross-platform IRC client with the native RAVE operator toolkit and a
        mIRC-compatible scripting engine.
      </p>
      <p class="credit">
        A from-scratch native port of the <b>RAVE IRC v4</b> mIRC operator script by
        <b>acronix</b> (DALnet). Built with Tauri + Svelte.
      </p>
      <div class="links">
        <button onclick={() => link(REPO)}>GitHub</button>
        <button onclick={() => link(`${REPO}/releases`)}>Releases</button>
        <button onclick={() => (irc.bugReportOpen = true)}>Report a bug</button>
      </div>
      <div class="actions">
        <button class="go" onclick={close}>Close</button>
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
    z-index: 130;
  }
  .dialog {
    width: 420px;
    max-width: 92vw;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 22px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }
  .logo {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--accent), #f06595);
    color: #fff;
    font-weight: 800;
    font-size: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(166, 30, 77, 0.45);
  }
  .name {
    font-weight: 800;
    font-size: 20px;
    color: var(--fg);
    letter-spacing: 0.5px;
  }
  .ver {
    font-size: 12px;
    color: var(--fg-faint);
    font-family: var(--mono);
  }
  .tag {
    color: var(--fg-dim);
    font-size: 13px;
    line-height: 1.5;
    margin: 0 0 10px;
  }
  .credit {
    color: var(--fg-faint);
    font-size: 12px;
    line-height: 1.5;
    margin: 0 0 16px;
  }
  .links {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  .links button {
    flex: 1;
    padding: 7px 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .links button:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
  .go {
    padding: 8px 18px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    font-size: 13px;
  }
</style>
