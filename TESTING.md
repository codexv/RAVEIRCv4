# RAVEIRC — Testing

Automated self-tests across both layers. Run these before manual testing.

## Frontend logic (Vitest) — 27 tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

Covers:
- **commands** — slash-command parsing (`/join`, `/me`, `/msg`, escaping, errors)
- **mirc** — colour/format rendering + HTML-escaping (XSS safety) + stripping
- **store** — event handling driven by real-format engine events: buffer/server
  creation, nicklist from NAMES, JOIN/PART, and **assertion that outbound
  commands carry a defined numeric `serverId`** (regression for the casing bug)

## Engine (Cargo) — 16 unit tests

```bash
cd src-tauri && cargo test --lib
```

Covers:
- **message** — IRC + IRCv3 tag parsing
- **ctcp** — CTCP parse + configurable replies
- **event** — `serverId` is serialized in camelCase (cross-layer contract)
- **manager** — `tauri::async_runtime::spawn` works from a sync context
  (regression for the connect crash)

## Engine ↔ real network (Cargo, ignored by default) — 2 tests

```bash
cd src-tauri && cargo test --lib "irc::connection::tests" -- --ignored --nocapture
```

Connects to **irc.libera.chat:6697 over TLS** and verifies:
- `live_tls_register` — TLS handshake + registration (numeric 001)
- `live_join_channel` — JOIN a channel + receive end-of-NAMES (366)

## Manual smoke (the GUI)

macOS WebView can't be driven by WebDriver, so the window itself is tested by
hand: `npm run tauri dev`, then connect / join / message / open Settings.
The two test layers above cover the logic the GUI sits on top of.
```
