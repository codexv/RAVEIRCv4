<script lang="ts">
  import { irc } from "$lib/irc/store.svelte";
  import { detectNetwork } from "$lib/irc/network";
  import { deepClone } from "$lib/util";
  import {
    aiStatus,
    channelKey,
    saveRaveConfig,
    type AiStatus,
    type ProtectionsConfig,
    type RaveConfig,
  } from "$lib/irc/rave";
  import {
    appearance,
    ACCENTS,
    UI_FONTS,
    MONO_FONTS,
    THEMES,
    NICK_ROLES,
    EVENT_ROLES,
    type ThemeId,
  } from "$lib/appearance.svelte";

  import { updater } from "$lib/update.svelte";

  let { open = $bindable() }: { open: boolean } = $props();

  type Section = "appearance" | "ctcp" | "protections" | "antispam" | "friends" | "ai" | "updates";
  let section = $state<Section>("appearance");

  function setTheme(t: ThemeId) {
    appearance.theme = t;
    appearance.apply();
  }
  function setAccent(c: string) {
    appearance.accent = c;
    appearance.apply();
  }
  function setChatBg(c: string) {
    appearance.chatBg = c;
    appearance.apply();
  }
  // Quick chat-background presets (any colour is still available via the picker).
  const CHAT_BG_PRESETS = ["#000000", "#0d1117", "#11161c", "#1a1a2e", "#f6f8fa", "#fbf0d9"];
  let config = $state<RaveConfig | null>(null);
  let status = $state<AiStatus | null>(null);
  let checking = $state(false);

  // Protections scope: "" = global default, else a channelProtections key.
  let protScope = $state("");
  let activeProt = $state<ProtectionsConfig | null>(null);

  async function checkAi() {
    checking = true;
    status = null;
    try {
      status = await aiStatus();
    } catch (e) {
      status = { available: false, modelPresent: false, models: [], error: String(e) };
    }
    checking = false;
  }

  // Snapshot the live config for editing whenever the panel opens.
  $effect(() => {
    if (open && !config) {
      config = deepClone($state.snapshot(irc.raveConfig)) as RaveConfig;
      protScope = "";
      activeProt = config.protections;
    }
  });

  // Escape closes/cancels the panel (window-level so it works without focus).
  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toLines(s: string): string[] {
    return s
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  /** Open channels available as protection scopes (deduped by key). */
  const channelScopes = $derived(
    irc.buffers
      .filter((b) => b.kind === "channel")
      .map((b) => {
        const srv = irc.servers.find((s) => s.id === b.serverId);
        const net = srv ? detectNetwork(srv) : "generic";
        return { key: channelKey(net, b.name), label: `${b.name} · ${net}` };
      })
      .filter((v, i, arr) => arr.findIndex((x) => x.key === v.key) === i),
  );

  function selectScope(key: string) {
    protScope = key;
    if (!config) return;
    activeProt = key === "" ? config.protections : (config.channelProtections[key] ?? null);
  }

  function customizeChannel() {
    if (!config || !protScope) return;
    config.channelProtections[protScope] = deepClone(
      $state.snapshot(config.protections),
    ) as ProtectionsConfig;
    activeProt = config.channelProtections[protScope];
  }

  function removeOverride() {
    if (!config || !protScope) return;
    delete config.channelProtections[protScope];
    activeProt = null;
  }

  async function save() {
    if (!config) return;
    await saveRaveConfig(config);
    irc.applyConfig(config);
    close();
  }

  function close() {
    open = false;
    config = null;
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
</script>

{#if open && config}
  <div
    class="overlay"
    onpointerdown={backdropDown}
    onclick={backdropClick}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="sidebar">
        <div class="s-title">Settings</div>
        <button
          class="s-item"
          class:active={section === "appearance"}
          onclick={() => (section = "appearance")}
        >
          Appearance
        </button>
        <button class="s-item" class:active={section === "ctcp"} onclick={() => (section = "ctcp")}>
          CTCP Replies
        </button>
        <button
          class="s-item"
          class:active={section === "protections"}
          onclick={() => (section = "protections")}
        >
          Protections
        </button>
        <button
          class="s-item"
          class:active={section === "antispam"}
          onclick={() => (section = "antispam")}
        >
          AntiSpam
        </button>
        <button
          class="s-item"
          class:active={section === "friends"}
          onclick={() => (section = "friends")}
        >
          Friends
        </button>
        <button
          class="s-item"
          class:active={section === "ai"}
          onclick={() => {
            section = "ai";
            if (!status) checkAi();
          }}
        >
          AI Co-pilot
        </button>
        <button class="s-item" class:active={section === "updates"} onclick={() => (section = "updates")}>
          Updates
        </button>
      </div>

      <div class="content">
        {#if section === "appearance"}
          <h3>Appearance</h3>
          <p class="muted">Changes apply instantly and are saved automatically.</p>

          <span class="group-label">Theme</span>
          <div class="theme-row">
            {#each Object.keys(THEMES) as t (t)}
              <button
                class="theme-chip"
                class:active={appearance.theme === t}
                style="background:{THEMES[t as ThemeId].bg}; color:{THEMES[t as ThemeId]
                  .fg}; border-color:{appearance.theme === t
                  ? 'var(--accent)'
                  : THEMES[t as ThemeId].border}"
                onclick={() => setTheme(t as ThemeId)}
              >
                {THEMES[t as ThemeId].label}
              </button>
            {/each}
          </div>

          <span class="group-label" style="margin-top:14px">Accent colour</span>
          <div class="swatches">
            {#each ACCENTS as c (c)}
              <button
                class="swatch"
                class:active={appearance.accent.toLowerCase() === c}
                style="background:{c}"
                aria-label={c}
                onclick={() => setAccent(c)}
              ></button>
            {/each}
            <input
              class="color-input"
              type="color"
              value={appearance.accent}
              oninput={(e) => setAccent((e.currentTarget as HTMLInputElement).value)}
            />
          </div>

          <span class="group-label" style="margin-top:14px">Chat background</span>
          <div class="swatches">
            <input
              class="color-input"
              type="color"
              value={appearance.chatBg || THEMES[appearance.theme].bg}
              oninput={(e) => setChatBg((e.currentTarget as HTMLInputElement).value)}
            />
            {#each CHAT_BG_PRESETS as c (c)}
              <button
                class="swatch"
                class:active={appearance.chatBg.toLowerCase() === c}
                style="background:{c}"
                aria-label={c}
                onclick={() => setChatBg(c)}
              ></button>
            {/each}
            <button class="follow-theme" class:active={!appearance.chatBg} onclick={() => setChatBg("")}>
              Follow theme
            </button>
          </div>

          <label style="margin-top:14px">Interface font
            <select bind:value={appearance.uiFont} onchange={() => appearance.apply()}>
              {#each UI_FONTS as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
            </select>
          </label>

          <label>Message font
            <select bind:value={appearance.monoFont} onchange={() => appearance.apply()}>
              {#each MONO_FONTS as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
            </select>
          </label>

          <label>Message text size — {appearance.msgSize}px
            <input
              type="range"
              min="11"
              max="18"
              bind:value={appearance.msgSize}
              oninput={() => appearance.apply()}
            />
          </label>

          <span class="group-label" style="margin-top:16px">Nicklist colours</span>
          <div class="color-grid">
            {#each NICK_ROLES as r (r.key)}
              <label class="color-row">
                <input
                  type="color"
                  bind:value={appearance.nickColors[r.key]}
                  oninput={() => appearance.apply()}
                />
                {r.label}
              </label>
            {/each}
          </div>

          <span class="group-label" style="margin-top:16px">Event / message colours</span>
          <div class="color-grid">
            {#each EVENT_ROLES as r (r.key)}
              <label class="color-row">
                <input
                  type="color"
                  bind:value={appearance.eventColors[r.key]}
                  oninput={() => appearance.apply()}
                />
                {r.label}
              </label>
            {/each}
          </div>

          <span class="group-label" style="margin-top:16px">Sound</span>
          <label class="toggle" style="margin-top:6px">
            <input type="checkbox" bind:checked={appearance.soundOnHighlight} onchange={() => appearance.apply()} />
            Beep when your nick is highlighted
          </label>

          <div style="margin-top:18px"></div>
          <button class="reset" onclick={() => appearance.reset()}>Reset appearance to defaults</button>

        {:else if section === "ctcp"}
          <h3>CTCP Auto-Replies</h3>
          <p class="muted">Automatic replies sent when others query your client (RAVE-01).</p>
          <label class="toggle">
            <input type="checkbox" bind:checked={config.ctcp.enabled} /> Enable CTCP replies
          </label>
          <fieldset disabled={!config.ctcp.enabled}>
            <label>VERSION<input bind:value={config.ctcp.version} /></label>
            <label>FINGER<input bind:value={config.ctcp.finger} /></label>
            <label>USERINFO<input bind:value={config.ctcp.userinfo} /></label>
            <label>SOURCE<input bind:value={config.ctcp.source} /></label>
            <div class="checks">
              <label class="toggle"><input type="checkbox" bind:checked={config.ctcp.answerPing} /> Answer PING</label>
              <label class="toggle"><input type="checkbox" bind:checked={config.ctcp.answerTime} /> Answer TIME</label>
              <label class="toggle"><input type="checkbox" bind:checked={config.ctcp.answerClientinfo} /> Answer CLIENTINFO</label>
            </div>
          </fieldset>

        {:else if section === "protections"}
          <h3>Channel Protections</h3>
          <p class="muted">
            Per-channel auto-moderation for channels where you hold ops (RAVE-02/03). Configure these
            anytime — they apply once you have ops. Friends (global) are always exempt.
          </p>

          <label>Settings for
            <select value={protScope} onchange={(e) => selectScope(e.currentTarget.value)}>
              <option value="">Global default (all channels)</option>
              {#each channelScopes as s (s.key)}
                <option value={s.key}>{s.label}{config.channelProtections[s.key] ? "  ✓" : ""}</option>
              {/each}
            </select>
          </label>

          {#if protScope !== "" && !activeProt}
            <div class="status-card">
              <p class="hint">This channel uses the global defaults.</p>
              <button class="recheck" onclick={customizeChannel}>Customize this channel</button>
            </div>
          {:else if activeProt}
            {#if protScope !== ""}
              <button class="reset" style="margin:10px 0 0" onclick={removeOverride}>
                ↩ Use global defaults (remove this channel's override)
              </button>
            {/if}

            <div class="status-card">
              <div class="proto-summary">
                <span class:on={activeProt.badword.enabled}>Bad-word</span>
                <span class:on={activeProt.clone.enabled}>Anti-clone</span>
                <span class:on={activeProt.flood.enabled}>Flood</span>
              </div>
              <p class="hint">
                Bans: {activeProt.banMinutes > 0
                  ? `auto-unban after ${activeProt.banMinutes} min`
                  : "permanent"} · green = active
              </p>
            </div>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.badword.enabled} /> <b>Bad-word filter</b></label>
              <fieldset disabled={!activeProt.badword.enabled}>
                <label>Words / phrases (one per line)
                  <textarea
                    rows="4"
                    value={activeProt.badword.words.join("\n")}
                    onchange={(e) => activeProt && (activeProt.badword.words = toLines(e.currentTarget.value))}
                    placeholder="badword&#10;another phrase"
                  ></textarea>
                </label>
                <label>Kick reason<input bind:value={activeProt.badword.reason} /></label>
                <label class="toggle"><input type="checkbox" bind:checked={activeProt.badword.ban} /> Ban (+b) as well as kick</label>
              </fieldset>
            </div>

            {#if activeProt.offensiveNick}
              <div class="block">
                <label class="toggle"><input type="checkbox" bind:checked={activeProt.offensiveNick.enabled} /> <b>Intelligent bans (offensive nick/ident)</b></label>
                <fieldset disabled={!activeProt.offensiveNick.enabled}>
                  <label>Trigger words (one per line) — bans <code>*word*!*@*</code> on join
                    <textarea
                      rows="3"
                      value={activeProt.offensiveNick.words.join("\n")}
                      onchange={(e) => activeProt && (activeProt.offensiveNick.words = toLines(e.currentTarget.value))}
                      placeholder="4hire&#10;spammer"
                    ></textarea>
                  </label>
                  <label>Kick reason<input bind:value={activeProt.offensiveNick.reason} /></label>
                </fieldset>
              </div>
            {/if}

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.clone.enabled} /> <b>Anti-clone</b></label>
              <fieldset disabled={!activeProt.clone.enabled}>
                <label class="small">Max per host<input type="number" min="1" bind:value={activeProt.clone.limit} /></label>
                <label>Kick reason<input bind:value={activeProt.clone.reason} /></label>
                <label class="toggle"><input type="checkbox" bind:checked={activeProt.clone.ban} /> Ban the host</label>
              </fieldset>
            </div>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.flood.enabled} /> <b>Flood control</b></label>
              <fieldset disabled={!activeProt.flood.enabled}>
                <div class="row">
                  <label class="small">Lines<input type="number" min="2" bind:value={activeProt.flood.lines} /></label>
                  <label class="small">within seconds<input type="number" min="1" bind:value={activeProt.flood.seconds} /></label>
                </div>
                <label>Kick reason<input bind:value={activeProt.flood.reason} /></label>
                <label class="toggle"><input type="checkbox" bind:checked={activeProt.flood.ban} /> Ban as well as kick</label>
              </fieldset>
            </div>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.caps.enabled} /> <b>CAPS filter</b></label>
              <fieldset disabled={!activeProt.caps.enabled}>
                <div class="row">
                  <label class="small">% caps<input type="number" min="30" max="100" bind:value={activeProt.caps.percent} /></label>
                  <label class="small">min length<input type="number" min="4" bind:value={activeProt.caps.minLength} /></label>
                </div>
                <label>Kick reason<input bind:value={activeProt.caps.reason} /></label>
                <label class="toggle"><input type="checkbox" bind:checked={activeProt.caps.ban} /> Ban as well as kick</label>
              </fieldset>
            </div>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.length.enabled} /> <b>Line-length filter</b></label>
              <fieldset disabled={!activeProt.length.enabled}>
                <label class="small">Max characters<input type="number" min="80" bind:value={activeProt.length.max} /></label>
                <label>Kick reason<input bind:value={activeProt.length.reason} /></label>
                <label class="toggle"><input type="checkbox" bind:checked={activeProt.length.ban} /> Ban as well as kick</label>
              </fieldset>
            </div>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.ctcpFlood.enabled} /> <b>CTCP-flood</b></label>
              <fieldset disabled={!activeProt.ctcpFlood.enabled}>
                <div class="row">
                  <label class="small">CTCPs<input type="number" min="2" bind:value={activeProt.ctcpFlood.count} /></label>
                  <label class="small">within seconds<input type="number" min="1" bind:value={activeProt.ctcpFlood.seconds} /></label>
                </div>
                <label>Kick reason<input bind:value={activeProt.ctcpFlood.reason} /></label>
                <label class="toggle"><input type="checkbox" bind:checked={activeProt.ctcpFlood.ban} /> Ban as well as kick</label>
              </fieldset>
            </div>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.tricks.enabled} /> <b>Anti-trick / exploit</b></label>
              <fieldset disabled={!activeProt.tricks.enabled}>
                <p class="hint">Kicks users sending mIRC crash strings / decode-worm payloads (protects other users).</p>
                <label>Kick reason<input bind:value={activeProt.tricks.reason} /></label>
                <label class="toggle"><input type="checkbox" bind:checked={activeProt.tricks.ban} /> Ban as well as kick</label>
              </fieldset>
            </div>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.raid.enabled} /> <b>Raid / join-flood lockdown</b></label>
              <fieldset disabled={!activeProt.raid.enabled}>
                <div class="row">
                  <label class="small">Joins<input type="number" min="3" bind:value={activeProt.raid.joins} /></label>
                  <label class="small">within seconds<input type="number" min="2" bind:value={activeProt.raid.seconds} /></label>
                </div>
                <div class="row">
                  <label class="small">Lock mode<input bind:value={activeProt.raid.lockMode} /></label>
                  <label class="small">unlock after (min)<input type="number" min="0" bind:value={activeProt.raid.unlockMinutes} /></label>
                </div>
                <p class="hint">On a join-flood, sets the lock mode (e.g. <code>+i</code> invite-only) and clears it after the time.</p>
              </fieldset>
            </div>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.autoRejoin} /> <b>Auto-rejoin</b> if kicked from this channel</label>
            </div>

            <div class="block">
              <b style="font-size:13px">Auto-op / Auto-voice lists</b>
              <p class="hint">Nicks or hostmasks. When they join (and you hold ops) they're auto +o / +v.</p>
              <label>Auto-op (one per line)
                <textarea
                  rows="3"
                  value={activeProt.autoOp.join("\n")}
                  onchange={(e) => activeProt && (activeProt.autoOp = toLines(e.currentTarget.value))}
                  placeholder="trustedop&#10;*!*@staff.host"
                ></textarea>
              </label>
              <label>Auto-voice (one per line)
                <textarea
                  rows="3"
                  value={activeProt.autoVoice.join("\n")}
                  onchange={(e) => activeProt && (activeProt.autoVoice = toLines(e.currentTarget.value))}
                  placeholder="regular&#10;*!*@friends.host"
                ></textarea>
              </label>
            </div>

            <div class="block">
              <label class="small">Ban duration (minutes, 0 = permanent)
                <input type="number" min="0" bind:value={activeProt.banMinutes} />
              </label>
              <label class="toggle"><input type="checkbox" bind:checked={activeProt.autoOpFriends} /> Auto-op friends on join</label>
              <p class="hint">Auto-bans remove the +b after the time is up. Manual right-click bans stay permanent.</p>
            </div>
          {/if}

        {:else if section === "antispam"}
          <h3>AntiSpam</h3>
          <p class="muted">Detects advert URLs / channel-invites and repeated flooding (RAVE-05).</p>
          <label class="toggle"><input type="checkbox" bind:checked={config.antispam.enabled} /> Enable AntiSpam</label>
          <fieldset disabled={!config.antispam.enabled}>
            <label class="toggle"><input type="checkbox" bind:checked={config.antispam.blockAdverts} /> Block advert URLs &amp; channel invites</label>
            <label class="small">Repeat limit<input type="number" min="2" bind:value={config.antispam.repeatLimit} /></label>
            <label>Kick reason<input bind:value={config.antispam.reason} /></label>
            <label class="toggle"><input type="checkbox" bind:checked={config.antispam.ban} /> Ban as well as kick</label>
          </fieldset>

        {:else if section === "friends"}
          <h3>Friends</h3>
          <p class="muted">
            Global list of nicks or hostmasks (e.g. <code>*!*@trusted.host</code>) exempt from all
            protections on every channel. One per line.
          </p>
          <textarea
            rows="8"
            value={config.protections.friends.join("\n")}
            onchange={(e) => config && (config.protections.friends = toLines(e.currentTarget.value))}
            placeholder="trustednick&#10;*!*@trusted.host"
          ></textarea>
          <label class="toggle"><input type="checkbox" bind:checked={config.secureQuery} /> Secure Query — warn on private messages from unknown senders</label>

          <div class="block" style="margin-top:16px">
            <label class="toggle"><input type="checkbox" bind:checked={config.pm.enabled} /> <b>Private-message guard</b></label>
            <fieldset disabled={!config.pm.enabled}>
              <p class="hint">Filters spam in queries (RAVE mega.pvt.*). Friends &amp; people sharing a channel are never blocked.</p>
              <label class="toggle"><input type="checkbox" bind:checked={config.pm.knownOnly} /> Only accept PMs from friends / shared channels</label>
              <label class="toggle"><input type="checkbox" bind:checked={config.pm.blockAdverts} /> Block advert URLs &amp; channel invites</label>
              <label class="toggle"><input type="checkbox" bind:checked={config.pm.blockWorms} /> Block exploit / decode-worm payloads</label>
              <label class="small">Drop after N repeated PMs<input type="number" min="2" bind:value={config.pm.repeatLimit} /></label>
            </fieldset>
          </div>

          <span class="group-label" style="margin-top:16px">Notify / watch list</span>
          <p class="hint">Get an alert when these nicks come online (uses server MONITOR). One per line.</p>
          <textarea
            rows="4"
            value={config.notify.join("\n")}
            onchange={(e) => config && (config.notify = toLines(e.currentTarget.value))}
            placeholder="buddy&#10;someop"
          ></textarea>

          <label class="toggle" style="margin-top:14px"><input type="checkbox" bind:checked={config.logging} /> Log channels &amp; queries to disk</label>
          <p class="hint">Saves to the app config folder under <code>logs/&lt;network&gt;/</code>.</p>

        {:else if section === "ai"}
          <h3>AI Co-pilot <span class="badge-local">local · private</span></h3>
          <p class="muted">
            Runs entirely on your machine via <b>Ollama</b> — nothing leaves your computer, no API
            key. Powers context-aware moderation plus <code>/catchup</code> and
            <code>/analyze &lt;nick&gt;</code>.
          </p>

          <div class="status-card">
            {#if checking}
              <span class="st pending">● Checking Ollama…</span>
            {:else if status?.available && status?.modelPresent}
              <span class="st ok">● Ready — {config.ai.model}</span>
            {:else if status?.available && !status?.modelPresent}
              <span class="st warn">● Ollama running, but model not installed</span>
              <p class="hint">Pull it once in a terminal: <code>ollama pull {config.ai.model}</code></p>
              {#if status.models.length}<p class="hint">Installed: {status.models.join(", ")}</p>{/if}
            {:else}
              <span class="st off">● Ollama not detected</span>
              <p class="hint">
                Install from <code>ollama.com</code>, then run <code>ollama pull {config.ai.model}</code>.
                The app works fully without it — AI features just stay off.
              </p>
            {/if}
            <button class="recheck" onclick={checkAi}>Re-check</button>
          </div>

          <label class="toggle"><input type="checkbox" bind:checked={config.ai.enabled} /> <b>Enable AI co-pilot</b></label>
          <fieldset disabled={!config.ai.enabled}>
            <label>Ollama endpoint<input bind:value={config.ai.endpoint} /></label>
            <label>Model
              <input bind:value={config.ai.model} />
            </label>
            <p class="hint">
              Lightweight models are ideal here (fast, low memory): <code>llama3.2:1b</code>,
              <code>qwen2.5:1.5b</code>, <code>gemma2:2b</code>. Use a larger one for more accuracy.
            </p>

            <div class="block">
              <label class="toggle"><input type="checkbox" bind:checked={config.ai.moderate} /> <b>AI moderation</b> — classify channel messages</label>
              <fieldset disabled={!config.ai.moderate}>
                <label class="small">Act at severity ≥
                  <select bind:value={config.ai.minSeverity}>
                    <option value={2}>2 — lenient</option>
                    <option value={3}>3</option>
                    <option value={4}>4 — recommended</option>
                    <option value={5}>5 — strict</option>
                  </select>
                </label>
                <label class="toggle"><input type="checkbox" bind:checked={config.ai.autoEnforce} /> Auto-enforce (kick) — off = flag only</label>
                <label class="toggle"><input type="checkbox" bind:checked={config.ai.ban} disabled={!config.ai.autoEnforce} /> Ban as well as kick</label>
                <p class="hint">Moderation only ever acts in channels where you're op, and never against friends.</p>
              </fieldset>
            </div>
          </fieldset>
        {:else if section === "updates"}
          <h3>Updates</h3>
          <p class="muted">RAVEIRC <b>v{irc.appVersion || "?"}</b> — checks for new versions on startup and installs them with one click, no reinstall.</p>
          <button class="check-upd" onclick={() => updater.check(true)} disabled={updater.status === "checking" || updater.status === "downloading"}>
            {updater.status === "checking" ? "Checking…" : "Check for updates now"}
          </button>
          {#if updater.status === "available"}
            <p class="hint">Update <b>v{updater.version}</b> is available — use the banner to install &amp; restart.</p>
          {:else if updater.status === "none"}
            <p class="hint">You're on the latest version.</p>
          {:else if updater.status === "downloading"}
            <p class="hint">Downloading… {updater.progress}%</p>
          {:else if updater.status === "error"}
            <p class="hint">Last check failed: {updater.error}</p>
          {/if}
          <p class="hint">Updates are cryptographically signed; only builds signed with the project key are accepted.</p>
        {/if}
      </div>

      <div class="footer">
        <button class="cancel" onclick={close}>Cancel</button>
        <button class="go" onclick={save}>Save</button>
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
    height: 520px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: grid;
    grid-template-columns: 170px 1fr;
    grid-template-rows: 1fr auto;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  .sidebar {
    grid-row: 1 / -1;
    border-right: 1px solid var(--border);
    background: var(--bg);
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .s-title {
    font-weight: 700;
    color: var(--fg);
    padding: 4px 8px 10px;
  }
  .s-item {
    text-align: left;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: var(--fg-dim);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .s-item:hover {
    background: var(--hover);
  }
  .s-item.active {
    background: var(--accent-soft);
    color: var(--fg);
  }
  .content {
    padding: 20px 22px;
    overflow-y: auto;
  }
  h3 {
    margin: 0 0 6px;
    color: var(--fg);
  }
  .muted {
    color: var(--fg-dim);
    font-size: 12px;
    margin: 0 0 16px;
    line-height: 1.5;
  }
  code {
    background: var(--bg);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: var(--mono);
  }
  .block {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 14px;
  }
  fieldset {
    border: none;
    padding: 8px 0 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  fieldset:disabled {
    opacity: 0.45;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--fg-dim);
  }
  .row {
    display: flex;
    gap: 12px;
  }
  .small {
    max-width: 150px;
  }
  input:not([type="checkbox"]),
  textarea,
  select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 9px;
    color: var(--fg);
    font-size: 13px;
    outline: none;
    font-family: inherit;
    resize: vertical;
  }
  select {
    padding-right: 28px;
    resize: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236e7681' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 9px center;
    background-size: 12px;
  }
  input:focus,
  textarea:focus,
  select:focus {
    border-color: var(--accent);
  }
  .badge-local {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #3fb950;
    border: 1px solid #3fb95066;
    border-radius: 10px;
    padding: 2px 8px;
    vertical-align: middle;
    margin-left: 6px;
  }
  .status-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 14px;
    background: var(--bg);
  }
  .st {
    font-size: 13px;
    font-weight: 600;
  }
  .st.ok {
    color: #3fb950;
  }
  .st.warn {
    color: #d29922;
  }
  .st.off {
    color: #f85149;
  }
  .st.pending {
    color: var(--fg-dim);
  }
  .hint {
    font-size: 12px;
    color: var(--fg-dim);
    margin: 6px 0 0;
    line-height: 1.5;
  }
  .recheck {
    margin-top: 10px;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 12px;
  }
  .recheck:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .group-label {
    display: block;
    font-size: 12px;
    color: var(--fg-dim);
  }
  .proto-summary {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .proto-summary span {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--border);
    color: var(--fg-faint);
  }
  .proto-summary span.on {
    color: #3fb950;
    border-color: #3fb95066;
    background: #3fb9501a;
  }
  .theme-row {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
  .theme-chip {
    flex: 1;
    padding: 16px 8px;
    border-radius: 8px;
    border: 2px solid var(--border);
    color: var(--fg);
    cursor: pointer;
    font-size: 12px;
    text-transform: capitalize;
  }
  .swatches {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 6px;
  }
  .swatch {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .swatch.active {
    border-color: var(--fg);
  }
  .color-input {
    width: 36px;
    height: 30px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .follow-theme {
    padding: 5px 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .follow-theme.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--fg);
  }
  .check-upd {
    margin-top: 8px;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    font-size: 13px;
  }
  .check-upd:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .color-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    margin-top: 6px;
  }
  .color-row {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--fg);
  }
  .color-row input[type="color"] {
    width: 28px;
    height: 24px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }
  input[type="range"] {
    padding: 0;
    border: none;
    background: transparent;
    accent-color: var(--accent);
  }
  .reset {
    margin-top: 18px;
    padding: 7px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 12px;
  }
  .reset:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .toggle {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--fg);
    cursor: pointer;
  }
  .checks {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .footer {
    grid-column: 2;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 22px;
    border-top: 1px solid var(--border);
  }
  .footer button {
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
