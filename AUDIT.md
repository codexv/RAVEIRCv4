# RAVEIRC — QA / Behavior Audit

Audit of the auto kick/ban protections, commands, and recent code. Performed
against the codebase at v0.1.16.

## Method
- Full automated suite: typecheck (0 errors), **180 vitest tests**, desktop +
  web builds, `cargo build` — all green.
- **Live harness** (`scripts/livetest.ts`): runs RAVEIRC's *actual* parser +
  protection functions + command parser against a real **ngircd** (localhost on
  the droplet, via SSH tunnel) with a bot (op) and an offender. **18/18 passed.**

## Verified working (live, against a real server)
- Connection + real line parser; channel-operator detection.
- All 7 message protections actually kick the offender: **bad word, advert/
  hotlink, excessive caps, long text, mIRC trick/exploit, repeat flood, text
  flood**.
- **Intelligent Bans** — offensive nick/ident → `+b *word*!*@*` + kick on join.
- **Friend exemption** (isExempt).
- 7 commands parse to correct wire and are accepted by the server (no command
  quirks): `/join /part /topic /nick /mode /me /msg`.

## Found & fixed
1. **Intelligent-kick deviation** — `advertHit` flagged `join #channel` even when
   it was the *current* channel; RAVE only kicks hotlinks to *other* channels.
   Fixed (current-channel exemption) + tests.
2. **Missing feature** — RAVE's offensive nick/ident auto-ban was not
   implemented. Implemented: `offensiveNickHit()`, store enforcement in
   `onUserJoin`, config in TS + Rust `ProtectionsConfig` (serde-default =
   backward compatible), Settings editor; unit + integration + live tests.
3. **Gateway** kept the upstream IRC/ZNC socket open after a browser disconnect;
   now cancels both pipe directions so disconnect tears down immediately.

## Non-bugs (expected / environment)
- "Disconnect not working" through ZNC is **bouncer semantics** — disconnecting
  the client ends the client↔ZNC session; ZNC stays on the network by design.
- **Self-signed TLS** (some ZNC) is unsupported — the gateway verifies certs.
- Test-environment only (not RAVEIRC): ngircd needed `PAM = no`, has
  `MaxNickLength = 9`, and a per-IP connection cap.

## Reviewed, no defects
Transport / web IRC core, the encrypted secret store, the notes editor,
reconnect-in-place, `closeServer`, and the idle-safe `NICKSERV` identify path.

## Backlog
A full **RAVE v3.05 feature-parity audit** (separate from this bug/behavior
audit) — go feature-by-feature through the original spec vs RAVEIRC.
