<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";

  const REPO = "codexv/RAVEIRCv4";

  let title = $state("");
  let desc = $state("");
  let steps = $state("");
  let copied = $state(false);

  function diagnostics(): string {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
    const server = irc.servers.map((s) => `${s.name} (${s.status})`).join(", ") || "not connected";
    return `RAVEIRC v${irc.appVersion || "?"}\n${ua}\nServers: ${server}`;
  }

  function body(): string {
    return (
      `**Describe the bug**\n${desc || "(what went wrong?)"}\n\n` +
      `**Steps to reproduce**\n${steps || "1.\n2.\n3."}\n\n` +
      `---\n<details><summary>Diagnostics</summary>\n\n\`\`\`\n${diagnostics()}\n\`\`\`\n</details>`
    );
  }

  function issueUrl(): string {
    const u = new URL(`https://github.com/${REPO}/issues/new`);
    u.searchParams.set("title", title || "Bug: ");
    u.searchParams.set("body", body());
    return u.toString();
  }

  async function submit() {
    try {
      await openUrl(issueUrl());
    } catch {
      // opener unavailable (e.g. dev/web) — fall back to a new tab
      window.open(issueUrl(), "_blank");
    }
    close();
  }

  async function copyReport() {
    await navigator.clipboard.writeText(`${title}\n\n${body()}`);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  function close() {
    irc.bugReportOpen = false;
    title = "";
    desc = "";
    steps = "";
  }

  // Escape closes.
  $effect(() => {
    if (!irc.bugReportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Backdrop click only when press+release land on the overlay.
  let pressed = $state(false);
  function down(e: PointerEvent) {
    pressed = e.target === e.currentTarget;
  }
  function up(e: MouseEvent) {
    if (pressed && e.target === e.currentTarget) close();
    pressed = false;
  }
</script>

{#if irc.bugReportOpen}
  <div class="overlay" onpointerdown={down} onclick={up} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <h3>🐞 Report a bug</h3>
      <p class="muted">
        This opens a pre-filled GitHub issue (with version + system info attached). You review and
        submit it on GitHub — nothing is sent automatically.
      </p>

      <label>Summary<input bind:value={title} placeholder="Short title for the bug" /></label>
      <label>What happened<textarea bind:value={desc} rows="3" placeholder="Describe the bug"></textarea></label>
      <label>Steps to reproduce<textarea bind:value={steps} rows="3" placeholder="1. …&#10;2. …&#10;3. …"></textarea></label>

      <span class="group-label">Auto-attached diagnostics</span>
      <pre class="diag">{diagnostics()}</pre>

      <div class="actions">
        <button class="cancel" onclick={close}>Cancel</button>
        <button class="copy" onclick={copyReport}>{copied ? "Copied ✓" : "Copy report"}</button>
        <button class="go" onclick={submit}>Open issue on GitHub</button>
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
    z-index: 120;
  }
  .dialog {
    width: 480px;
    max-width: 92vw;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  h3 {
    margin: 0 0 8px;
    color: var(--fg);
  }
  .muted {
    color: var(--fg-dim);
    font-size: 12px;
    margin: 0 0 14px;
    line-height: 1.5;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--fg-dim);
    margin-bottom: 10px;
  }
  input,
  textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 9px;
    color: var(--fg);
    font-size: 13px;
    outline: none;
    font-family: var(--ui);
    resize: vertical;
  }
  input:focus,
  textarea:focus {
    border-color: var(--accent);
  }
  .group-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--fg-faint);
  }
  .diag {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    margin: 6px 0 14px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--fg-dim);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .actions button {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 13px;
  }
  .cancel,
  .copy {
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
