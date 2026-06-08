# RAVEIRC

**A modern, cross-platform IRC client with a battle-tested operator toolkit baked in.**

RAVEIRC is a ground-up rebuild of the legendary **RAVE IRC** script suite — a mature DALnet channel-protection and operator toolkit originally written in mIRC scripting — reborn as a fast, native, cross-platform desktop application. No emulator, no legacy runtime: every feature is reimplemented natively.

---

## What it is

For two decades, IRC power users and channel operators relied on heavyweight Windows-only clients loaded with custom scripts to manage, protect, and moderate their channels. RAVEIRC takes that hard-won operator knowledge and rebuilds it as a single, polished, modern app that runs everywhere.

It's an IRC client for people who actually *run* channels — not just chat in them.

---

## Platforms

| Platform | Status |
|----------|--------|
| 🍎 macOS (Apple Silicon + Intel) | Supported |
| 🪟 Windows 10/11 | Supported |
| 🐧 Linux (deb / AppImage) | Supported |

One codebase, native performance on all three, thanks to a **Tauri** architecture (Rust core + web UI) — tiny installers and low memory footprint for an always-on chat app.

---

## Key features

### Core IRC client
- Multi-server, multi-channel with a clean server/channel tree
- Full TLS/SSL, SASL authentication, and IRCv3 capabilities
- mIRC-style color & formatting rendering
- Smart, searchable message buffers and nick lists
- Command parsing (`/join`, `/msg`, `/mode`, …) with input history

### The RAVE operator toolkit (native)
- **Channel protections** — anti-clone, flood control, and configurable bad-word filtering
- **AntiSpam engine** — a native port of the classic AntiSpam Bot, auto-detecting and acting on spam/advert floods
- **Services integration** — one-click ChanServ / NickServ / MemoServ menus for DALnet, Freenode, and more
- **ScanIP** — scan a channel's internal address list to spot clones and ban-evaders
- **Secure Query & MemoExpress** — managed private messaging and memo workflows
- **Friends & blacklist management** — allow-lists, temp friends, and a visual blacklist editor
- **CTCP & ping tools** — version replies, lag/ping measurement, and intel logging

### Modern touches the original never had
- A real settings UI (no editing `.ini` files by hand)
- Hot-reloadable configuration
- Each protection module independently toggleable and testable
- Cross-platform, actively maintained, open architecture

---

## Tech stack

- **Shell:** Tauri 2 (Rust)
- **IRC engine:** Async Rust (Tokio + rustls), custom RFC 1459/2812 + IRCv3 parser
- **UI:** Svelte 5 + TypeScript + Vite
- **Distribution:** Native installers — `.dmg` (macOS), `.msi`/`.exe` (Windows), `.deb`/`.AppImage` (Linux)

---

## Heritage

RAVEIRC v4 continues the lineage of the original **RAVE IRC** script (©2002, by *acronix* on DALnet) — preserving its operator workflows and protection logic while modernizing the foundation for the next generation of IRC.

---

## For the web team

**Suggested app-list entry:**

> **RAVEIRC** — Cross-platform IRC client with a built-in operator & channel-protection toolkit. Mac, Windows, Linux. A modern, native rebuild of the classic RAVE IRC script suite.

- **Category:** Communication / Networking
- **Status:** In development
- **Platforms:** macOS, Windows, Linux
- **Tagline:** *"IRC for people who run channels."*
