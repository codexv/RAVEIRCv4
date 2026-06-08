# Code signing & notarization

The release workflow (`.github/workflows/release.yml`) signs builds when the
secrets below are present, and **builds unsigned if they're absent** — so you
can ship alpha builds today and add signing later without changing anything.

There are two independent layers:

1. **Update signing** (already set up) — proves an update came from you. Uses the
   Tauri minisign key; secrets `TAURI_SIGNING_PRIVATE_KEY` +
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are already configured. The in-app
   updater works regardless of OS signing.
2. **OS code signing** (this doc) — removes the "unidentified developer" /
   SmartScreen warnings when users first install.

---

## macOS (Developer ID + notarization)

Requires the **Apple Developer Program** ($99/yr). Add these repo secrets
(Settings → Secrets and variables → Actions):

| Secret | What it is |
|---|---|
| `APPLE_CERTIFICATE` | base64 of your **Developer ID Application** `.p12` — `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | password you set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | your Apple ID email |
| `APPLE_PASSWORD` | an **app-specific password** (appleid.apple.com → Sign-In & Security) |
| `APPLE_TEAM_ID` | your 10-char Team ID |

With these set, builds are signed with Developer ID and notarized + stapled
automatically.

## Windows (Authenticode)

Requires a code-signing certificate (OV or, for instant SmartScreen trust, EV).
Add:

| Secret | What it is |
|---|---|
| `WINDOWS_CERTIFICATE` | base64 of your `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | the `.pfx` password |

The workflow imports the cert and points the bundler at it (SHA-256, timestamped).

> EV certs often live on hardware tokens / HSMs and can't be exported to a
> `.pfx`; for those, switch to **Azure Trusted Signing** (a `signCommand` in
> `bundle.windows`) — ask and I'll wire it up.

## Linux

AppImage/`.deb` aren't code-signed the same way; the updater's minisign
signature is the integrity guarantee there. Nothing extra needed.

---

## Shipping a release

1. Bump `version` in `src-tauri/tauri.conf.json`, `package.json`,
   `src-tauri/Cargo.toml`.
2. `git tag vX.Y.Z && git push --tags`.
3. The workflow builds, (signs if secrets present), and publishes installers +
   `latest.json`. Running apps offer the update on next check.
