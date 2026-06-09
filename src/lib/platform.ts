// Runtime platform detection. The same SvelteKit app runs as a native Tauri
// desktop app and as a hosted web/PWA (raveirc.coders.ph/chat). Desktop talks
// to IRC through the Rust backend (invoke/listen); the web build talks to the
// WebSocket↔IRC gateway instead.

// Whether this bundle was built for the web/PWA target. Injected by Vite's
// `define` (true only when BASE_PATH is set, i.e. `npm run build:web`). It's a
// build-time decision — not runtime — so unit tests (jsdom, no Tauri) still use
// the desktop/Tauri code path and its mocked invoke/listen.
declare const __WEB_BUILD__: boolean | undefined;
const WEB_BUILD: boolean = typeof __WEB_BUILD__ !== "undefined" ? !!__WEB_BUILD__ : false;

/** True for the plain-browser web/PWA build (no Rust backend available). */
export function isWeb(): boolean {
  return WEB_BUILD;
}

/** True for the native (Tauri) build — desktop now, mobile later. */
export function isTauri(): boolean {
  return !WEB_BUILD;
}

/**
 * WebSocket gateway base URL for the web build. Same-origin /gw by default so it
 * works wherever the PWA is hosted; overridable for local dev via Vite env.
 */
export function gatewayUrl(): string {
  const override =
    typeof import.meta !== "undefined" ? (import.meta as { env?: Record<string, string> }).env?.VITE_GATEWAY_URL : "";
  if (override) return override;
  if (typeof location === "undefined") return "wss://raveirc.coders.ph/gw";
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/gw`;
}
