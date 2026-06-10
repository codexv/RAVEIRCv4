# RAVEIRC — Handoff / Onboarding for any Claude instance

This is the single-page brain dump so a fresh Claude can take over without
re-discovering everything. Read this first.

## What it is
RAVEIRC is a native, cross-platform IRC client — a ground-up port of **RAVE**,
the classic DALnet channel-protection mIRC script by **sneakers @ DALnet**
(since 2006; the maintainer here, "acronix", is the same person). Currently
**public beta** (pre-1.0).

- **GitHub:** `codexv/RAVEIRCv4` (public; required public so the in-app updater + site downloads work).
- **Local dev path (Mac):** `/Volumes/STORAGE/WORKDESK/APPS/RAVEv4`
- **Site:** https://raveirc.coders.ph · **Mobile/PWA:** https://raveirc.coders.ph/chat · **Changelog:** /changelog.html

## Stack
Tauri v2 (Rust backend) + SvelteKit 5 with **Svelte 5 runes** ($state/$derived/
$effect/$props), Vite, TypeScript, Vitest. `@sveltejs/adapter-static` (SPA).

## Two runtime targets (one codebase)
- **Desktop (Tauri):** the Rust backend does the IRC TCP/TLS sockets, registration,
  SASL, keepalive, auto-reconnect. Frontend talks to it via `invoke`/`listen`.
- **Web/PWA:** built with `npm run build:web` (sets `BASE_PATH=/chat`). A Vite
  `define` sets `__WEB_BUILD__` → `isWeb()` in `src/lib/platform.ts`. In web mode
  the frontend uses an in-page IRC client (`src/lib/irc/webclient.ts`) over a
  **WebSocket↔IRC gateway** instead of Rust.

The seam is **`src/lib/irc/transport.ts`** (`connectServer`/`sendRaw`/
`sendMessage`/`disconnectIrc`/`subscribeIrc`). The store calls these, never
`invoke`/`listen` directly for IRC.

## Key files
- `src/lib/irc/store.svelte.ts` — central reactive state (servers, buffers, all
  event handling + protection enforcement). The big one.
- `src/lib/irc/commands.ts` — `parseInput()` (editbox slash-commands → actions).
- `src/lib/irc/protections.ts` — pure detection (badword/advert/caps/length/
  trick/clone/flood/repeat + **offensiveNickHit**) + trackers. Enforcement lives
  in `store.onUserJoin` / `handlePrivmsg`.
- `src/lib/irc/network.ts` — per-network service profiles. **Identify uses the raw
  `NICKSERV` alias (idle-safe, like mIRC /ns), not PRIVMSG** — important for ZNC.
- `src/lib/irc/webclient.ts` + `ircparse.ts` — web IRC core + line parser.
- `src/lib/secrets.ts` — **AES-GCM encrypted credential store in localStorage**
  (replaced the OS keychain in v0.1.14). `profiles.ts` + `servers.ts` use it.
- `src/lib/irc/rave.ts` + `src-tauri/src/rave/config.rs` — `RaveConfig`/
  `ProtectionsConfig` (keep TS and Rust shapes in sync; Rust uses serde
  `default` so adding a field is backward-compatible).
- `src-tauri/src/irc/{connection,manager}.rs`, `src-tauri/src/lib.rs` — Rust IRC
  + command registrations.
- `site/` — marketing site (static). `gateway/raveirc-gw.py` — the WS↔IRC gateway.
- `scripts/livetest.ts` — live integration harness (see Testing).

## Build / test
```
npm run check        # svelte-check typecheck (must be 0 errors)
npm test             # vitest — 180 tests, must stay green
npm run build        # desktop web assets (root base) → build/
npm run build:web    # PWA build (BASE_PATH=/chat) → build/
(cd src-tauri && cargo build --lib)   # syncs Cargo.lock / checks Rust
```

## Release process (desktop, via CI)
1. Bump version in THREE files: `package.json` (line 3), `src-tauri/tauri.conf.json`
   (line 4), `src-tauri/Cargo.toml` (line 3) — e.g. `sed -i '' '3s/...//'`.
2. `(cd src-tauri && cargo build --lib)` to update `Cargo.lock`.
3. Move `[Unreleased]` → the new version section in `CHANGELOG.md`; deploy it
   to the droplet (see below).
4. `git commit` (Co-Authored-By: Claude Opus 4.8), `git tag vX.Y.Z`, push `main` + tag.
5. GitHub Actions `.github/workflows/release.yml` builds macOS/Windows/Linux.
   Watch: `gh run watch <id> --repo codexv/RAVEIRCv4 --exit-status`.
6. **macOS DMG step is flaky** (`bundle_dmg.sh`). If only macOS fails:
   `gh run rerun <id> --repo codexv/RAVEIRCv4 --failed`.
7. `latest.json` is published → desktop auto-updater endpoint. Release notes link
   to the changelog. (PWA updates via its service worker, not releases.)

Commit message footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
Work/commit on `main` (the project releases directly from main by tag).

## The droplet (198.211.101.53)
DigitalOcean Ubuntu, **1 vCPU / 2 GB** (too small to build Tauri — do desktop
builds locally / in CI). SSH: `acronix@198.211.101.53` (key auth, passwordless
sudo). Note: its hostname is `irc.coders.ph` and it also hosts unrelated
`hackpixels.com` Caddy sites — leave those alone.

Runs (all `systemctl is-active` = active):
- **Caddy** (`/etc/caddy/Caddyfile`): `raveirc.coders.ph` → root `/var/www/raveirc`
  (marketing site) + `/chat/*` SPA (the PWA build) + `@gw path /gw` →
  `reverse_proxy 127.0.0.1:8099` (the gateway, WS upgrade auto-handled). Auto-TLS.
- **raveirc-gw** (systemd): `/opt/raveirc-gw/raveirc-gw.py` in a venv with
  `websockets`, on `127.0.0.1:8099`. Source of truth is repo `gateway/`.
- **ngircd**: a **localhost-only test ircd** (`127.0.0.1:6667`, `PAM = no`,
  `MaxConnectionsIP = 0`) used only by the live harness — not production.

`~/RAVEIRC` on the droplet = a copy of the website files (this doc included).

## DNS
Cloudflare (zone `coders.ph`). API token on the Mac at `~/.cf_token`.
`raveirc.coders.ph` is an **A record → 198.211.101.53, DNS-only (unproxied)** so
Caddy can manage its own Let's Encrypt cert.

## Deploy commands (run from the Mac repo)
```
# Marketing site:
scp site/index.html site/changelog.html site/appicon.svg CHANGELOG.md acronix@198.211.101.53:/var/www/raveirc/
scp site/fonts/*.woff2 acronix@198.211.101.53:/var/www/raveirc/fonts/

# PWA (/chat):
npm run build:web && tar czf /tmp/chat.tgz -C build .
scp /tmp/chat.tgz acronix@198.211.101.53:/tmp/
ssh acronix@198.211.101.53 'rm -rf /var/www/raveirc/chat && mkdir -p /var/www/raveirc/chat && tar xzf /tmp/chat.tgz -C /var/www/raveirc/chat'

# Gateway:
scp gateway/raveirc-gw.py acronix@198.211.101.53:/opt/raveirc-gw/ && ssh acronix@198.211.101.53 'sudo systemctl restart raveirc-gw'
```
**Workflow note:** the maintainer tests on the **PWA**, so redeploy `/chat` after
frontend changes; batch desktop releases.

## Live testing (real IRC behavior)
Real public networks block the droplet's VPS IP / require SASL, so test against
the local ngircd:
```
ssh -N -L 6667:127.0.0.1:6667 acronix@198.211.101.53 &   # tunnel
npx tsx scripts/livetest.ts                               # 18/18 expected
```
The harness drives RAVEIRC's real parser + protection + command code with a bot
(op) + an offender. Gotchas: ngircd `MaxNickLength = 9` (use short test nicks),
needs `PAM = no`, restart it to clear lingering connections.

## Known caveats / gotchas
- **ZNC:** "Disconnect" only ends the client↔ZNC session — ZNC stays on the
  network (bouncer semantics), not a bug. Use the server password field
  (`PASS user/network:password`) to connect through ZNC.
- **Self-signed TLS** (some ZNC): the gateway verifies certs, so self-signed
  fails. Not yet supported.
- **Secrets are obfuscation-grade**, not keychain-grade — the key lives with the
  app (documented in `secrets.ts`). Old keychain passwords don't migrate.
- **`src-tauri/target`** (~8 GB) and `node_modules` are gitignored build cache —
  a fresh `git clone` is tiny; `cargo clean` reclaims the space.
- macOS BSD `grep` needs `-E` for alternation and `-a` for files with mIRC
  control bytes (e.g. `store.svelte.ts`).

## State as of this writing (v0.1.16 released)
Committed on `main` and live on the PWA but **not yet in a desktop release**:
RAVE "Intelligent Bans" (offensive nick/ident auto-ban), the intelligent-kick
current-channel exemption, saved-server "Save changes" editing, and the
`<*status>` ZNC-virtual-user suppression. Roll `v0.1.17` to ship them.
Open backlog item: a RAVE v3.05 feature-parity audit.
