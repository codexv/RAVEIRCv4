<script lang="ts">
  import { updater } from "$lib/update.svelte";
</script>

{#if updater.status !== "idle" && updater.status !== "checking"}
  <div class="banner" class:err={updater.status === "error"}>
    {#if updater.status === "available"}
      {#if updater.web}
        <span class="msg">🚀 A new version is available</span>
        <div class="actions">
          <button class="go" onclick={() => updater.installAndRestart()}>Update now</button>
          <button class="later" onclick={() => updater.dismiss()}>Later</button>
        </div>
      {:else}
        <span class="msg">🚀 Update available — <b>v{updater.version}</b></span>
        <div class="actions">
          <button class="go" onclick={() => updater.installAndRestart()}>Install &amp; restart</button>
          <button class="later" onclick={() => updater.dismiss()}>Later</button>
        </div>
      {/if}
    {:else if updater.status === "downloading"}
      <span class="msg">Downloading update… {updater.progress}%</span>
      <div class="bar"><div class="fill" style="width:{updater.progress}%"></div></div>
    {:else if updater.status === "ready"}
      <span class="msg">Update ready — restarting…</span>
    {:else if updater.status === "none"}
      <span class="msg">You're on the latest version ✓</span>
      <button class="later" onclick={() => updater.dismiss()}>Dismiss</button>
    {:else if updater.status === "error"}
      <span class="msg">Update check failed: {updater.error}</span>
      <button class="later" onclick={() => updater.dismiss()}>Dismiss</button>
    {/if}
  </div>
{/if}

<style>
  .banner {
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 90vw;
    padding: 8px 14px;
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
    font-size: 13px;
    color: var(--fg);
  }
  .banner.err {
    border-color: var(--border);
    color: var(--fg-dim);
  }
  .msg b {
    color: var(--accent);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  button {
    border-radius: 6px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 12px;
    padding: 5px 10px;
  }
  .go {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
    font-weight: 600;
  }
  .later {
    background: var(--bg);
    color: var(--fg-dim);
  }
  .bar {
    width: 160px;
    height: 6px;
    background: var(--bg);
    border-radius: 3px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
</style>
