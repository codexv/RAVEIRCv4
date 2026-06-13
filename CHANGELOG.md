# Changelog

All notable changes to **RAVEIRC** — the native, cross-platform port of RAVE
(the classic DALnet channel-protection script by *sneakers @ DALnet*, since 2006).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). RAVEIRC
is in public beta (pre-1.0); expect frequent releases.

## [Unreleased]

_Nothing yet._

## [0.1.29] — 2026-06-13

- **Ban/exception/invite lists are now a proper table** with a **resizable Mask
  column** (drag the divider) so a long "set by / when" can never hide the mask.
- **Select entries to remove them in bulk.** Click a row to select it,
  Shift-click for a range, Ctrl/Cmd-click to toggle several, then hit one
  **Remove selected (N)** button — much faster than removing bans one by one.
- **Black theme is now true OLED black** (#000000) — the panels/sidebar/nicklist
  are pure black too, not just the chat area.

## [0.1.28] — 2026-06-13

- **Joining a channel now auto-opens (focuses) its window**, mIRC-style — no more
  staying on the server console after a `/join`. A ZNC reconnect that replays
  your channels won't hijack focus, though: it only switches if you're still on
  the console.

## [0.1.27] — 2026-06-13

- **Channel Central — full mIRC parity.** The channel dialog now has **Bans (+b),
  Exceptions (+e), and Invites (+I)** tabs, each fetched live with add/remove for
  operators. **Timed bans**: set a ban to auto-lift after N minutes (with a live
  countdown in the list), via the dialog or `/ban [-u<seconds>] [#chan] <nick|mask>`.
- **Clickable nicks in chat.** Click a chatter's name to highlight + scroll to
  them in the nicklist; right-click for the full actions menu (whois, query,
  op/voice, kick, ban, kick+ban, CTCP, AI). The nicklist and chat now share one menu.
- **Idle-safe services.** `/cs`, `/ns`, `/ms` — and all ChanServ/MemoServ actions
  (op, deop, voice, akick, unban, info…) — now use the raw `CHANSERV`/`NICKSERV`/
  `MEMOSERV` server aliases instead of a `PRIVMSG` to the service, so they no
  longer reset your idle time (matters through a ZNC bouncer). Bot-based networks
  (Undernet X, QuakeNet Q) keep their required PRIVMSG route.

## [0.1.26] — 2026-06-13

- **Your own `/msg`, `/notice`, `/me` now echo locally — including from an alias.**
  A custom alias like `/n` for `/notice` was silent (it sent but you never saw
  it); aliased `/me`/`/describe` were also missing the CTCP wrapper. All now
  display in the right window, matching mIRC and the built-in commands.
- **Channel Central gains channel-mode controls** (mIRC parity). Double-click a
  channel and, as an op, toggle moderated / no-external / topic-ops-only /
  invite-only / secret / private, and set the key (+k) and user limit (+l). The
  controls reflect the live channel modes. (mIRC has no *timed*-ban feature, so
  the ban list shows masks with who-set and when-set, not an expiry.)

## [0.1.25] — 2026-06-13

- **Channel Central** (mIRC-style): double-click a channel window to open a
  dialog showing the **ban list** and the **topic**. Operators can edit the
  topic, add bans, and remove (unban) entries; the list refreshes from the
  server and stays live as `+b`/`-b` modes are observed.
- **ZNC-friendly protections.** After (re)connecting, the bouncer replays missed
  conversations in a burst that previously looked like flooding and could
  trigger bans. Protections are now suppressed for a short grace window after
  registration, and any line carrying an old server-time tag is treated as
  replay — so reattaching no longer auto-bans people over historical chatter.

## [0.1.24] — 2026-06-13

- **Fixed the crash when opening Settings.** The Interface-font dropdown had two
  pairs of entries that resolved to the same font (Sans/Helvetica and
  Serif/Georgia); because the list was keyed by that value, opening Settings
  threw `each_key_duplicate` and froze the UI. The font lists are now keyed by
  their (unique) label, and a test guards every font/accent list against
  duplicate keys. (Pinpointed via the full stack trace added in 0.1.23.)

## [0.1.23] — 2026-06-12

- **Better crash reports.** The on-screen error banner now shows the full stack
  trace (the component that actually failed), instead of always pointing at the
  framework's internal re-throw location — so a report finally says *which* part
  of the app errored. Builds also ship source maps to make those traces legible.

## [0.1.22] — 2026-06-12

- **Hardened every saved list against a duplicate-id crash.** Saved servers,
  identity profiles, and Quick Notes are now de-duplicated by id when loaded, so
  a corrupted entry from older storage can't crash the dialog that lists them
  (the same `each_key_duplicate` class fixed for the channel nicklist in 0.1.21).

## [0.1.21] — 2026-06-12

- **Fixed a crash from a duplicated nick in the user list.** When the same nick
  appeared twice — a nick-change onto an existing name, a case-only rename, or a
  ZNC buffer replay listing it in two cases — the channel nicklist could hold two
  entries with the same nick and crash the render. The list now dedupes by nick
  (case-insensitively), keeping op status and host.

## [0.1.20] — 2026-06-12

- **Fixed a UI freeze when opening Settings or Channel Manager.** On some
  WebViews (older macOS WebKit) those dialogs relied on `structuredClone`, which
  isn't available there — opening them threw and wedged the whole UI (you could
  still type in the editbox but nothing was clickable). They now use a
  WebView-universal clone, so they open everywhere.
- The on-screen error banner moved to the bottom of the window (so it no longer
  covers the Help / report-bug menu) and gained **Copy** and **Report** buttons
  to file the error straight to GitHub.

## [0.1.19] — 2026-06-11

- Default chat font is now **Monaco** (cross-platform stack: Monaco on macOS,
  Consolas/Cascadia on Windows, DejaVu Sans Mono on Linux).
- Hardened against UI lock-ups: the mobile-nav backdrop can't get stuck blocking
  clicks, and an editbox command error can't wedge input.
- Uncaught errors now show a dismissible on-screen banner (helps diagnose
  freezes on builds without devtools).

## [0.1.18] — 2026-06-11

- **Disconnect** now tears down immediately even when the server (e.g. a ZNC
  bouncer) doesn't close the socket after QUIT — the button is no longer a no-op.
- The server window in the tree shows a **friendly name** (saved-server name, or
  the network preset) instead of the raw host address.
- **`/font`** (and its picker) works in **every** window now, including the
  status/server window; each window's font persists.
- **Readable light theme** — nick roles and event lines use a legible
  light-background palette instead of washing out.
- **More font choices** in Settings → Appearance (UI and monospace).
- PWA auto-updates on load (no more stale-cache after a deploy).

## [0.1.17] — 2026-06-11

- **Intelligent Bans** — offensive nick/ident triggers: a join whose nick or
  ident contains a configured word is banned (`+b *word*!*@*`) and kicked, so a
  rename without the word lets them back (per the original RAVE spec).
- **Intelligent kick** now matches RAVE: a `join #channel` invite to the channel
  you're already in is no longer treated as an advert (only hotlinks to other
  channels are).
- Connect dialog: **edit a saved server** and keep the changes (💾 Save changes),
  separate from “Save new”.
- Cleaner status window: **ZNC virtual users** (`*status`, `*controlpanel`, …)
  render without the `<*status>` wrapper.
- The WebSocket gateway tears down the upstream socket immediately on disconnect.

## [0.1.16] — 2026-06-10

- About dialog now carries the authentic RAVE heritage and credit
  (*sneakers @ DALnet*, since 2006), with the original tagline.
- Project now keeps a changelog, published at
  [raveirc.coders.ph/changelog.html](https://raveirc.coders.ph/changelog.html);
  release notes link to it.
- Website shows a public-beta notice.

## [0.1.15] — 2026-06-10

- **Idle-safe auto-identify.** Identify now uses the raw `NICKSERV` server alias
  (like mIRC's `/ns`) instead of a `PRIVMSG` to NickServ, so it no longer resets
  your idle time — important when connected through a ZNC bouncer. Applied to
  connect-time auto-identify, on-nick / NickServ-request identify, `/identify`
  and `/ns`, chosen per network (idle-safe on DALnet/Libera/Rizon).

## [0.1.14] — 2026-06-10

- **Self-contained encrypted credential store.** Replaced the OS keychain with
  RAVE's own AES-GCM encrypted secret store, so saved passwords work identically
  on desktop and the web/PWA (and no keychain prompts on unsigned builds).

## [0.1.13] — 2026-06-10

- **Quick Notes** is now a tabbed mini note editor — multiple notes, font
  face/size, autosaved; opens in its own resizable window on desktop. `/notes`.
- Your own nick changes are no longer suppressed (shown in the server console).
- Auto-identify also fires when you change to a saved auto-ident nick or when
  NickServ asks you to identify.

## [0.1.12] — 2026-06-10

- Close a whole **server window** (right-click, the toolbar ✕, or shift+click),
  with a confirmation when it's still connected.
- Shift+click closes channel/query windows immediately too.
- mIRC-style **reconnect-in-place** — connecting reuses the current server
  window; tick "New server window" to open another.
- Compact icon-only toolbar.

## [0.1.11] — 2026-06-10

- PWA self-update (Check for updates works on the web build via the service worker).
- Connect dialog split into **Server / Identity** tabs; fixed the ZNC label and a
  layout overflow.

## [0.1.10] — 2026-06-10

- **Mobile / PWA.** Responsive layout (sidebar becomes a drawer), installable
  PWA, and a WebSocket↔IRC gateway so the browser build can reach IRC. Hosted at
  `raveirc.coders.ph/chat`.
- **Saved custom servers** + server password field (ZNC / bouncer support, sent
  as `PASS`).
- **`/font`** — set a channel/query window's chat font (command or picker).
- Bundled Inter font for a consistent look across platforms; Linux dropdown fixes.
- Auto-join channels on connect; taller window so dialogs aren't clipped.

## [0.1.8] — 2026-06-10

- mSL `[ ]` evaluation-order brackets.
- Editbox Ctrl+K colour picker.

## [0.1.7] — 2026-06-09

- Fixed a Connect-dialog freeze (no longer hits the keychain on open).
- Tightened the RAVEIRC wordmark spacing.

## [0.1.6] — 2026-06-09

- NickServ passwords stored encrypted at rest (OS keychain at the time).
- Speaker's channel mode prefix shown in chat lines (e.g. `<@sneakers>`).
- Channel topic moved to its own bar; block sending into a channel you've left.

## [0.1.5] — 2026-06-09

- App icon beside the wordmark; red bubble follows the theme accent.
- Channel Manager: "Use global" always keeps the channel listed.

## [0.1.4] — 2026-06-09

- Join channels straight from the Channel Manager list.
- Disabled the webview reload context menu; stopped echoing PING/PONG.

## [0.1.3] — 2026-06-09

- Channel Manager: add & edit channels offline.

## [0.1.2] — 2026-06-09

- **Channel Manager** — join channels + per-channel protections.
- **Help menu** (version + About) and a bug-reporting flow.
- Keepalive ping + auto-reconnect; Disconnect button; tree collapse/expand.
- New app icon.

## [0.1.1] — 2026-06-09

- App version surfaced in the toolbar, OS title, `/help` and Settings.
- Double-click / right-click a query → whois.

## [0.1.0] — 2026-06-09

- First public alpha.
- Native cross-platform client (Tauri + Svelte) with the RAVE operator toolkit.
- mIRC-compatible scripting engine: aliases, events, identifiers, variables,
  hash tables, file/INI I/O, sockets, and custom dialogs.
- Scripts editor in its own OS window.
- In-app auto-updater; macOS/Windows code-signing pipeline.
