# Changelog

All notable changes to **RAVEIRC** — the native, cross-platform port of RAVE
(the classic DALnet channel-protection script by *sneakers @ DALnet*, since 2006).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). RAVEIRC
is in public beta (pre-1.0); expect frequent releases.

## [Unreleased]

- About dialog + website now carry the authentic RAVE heritage and credit
  (*sneakers @ DALnet*, since 2006).
- Website shows a public-beta notice.
- This changelog, also published on the website.

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
