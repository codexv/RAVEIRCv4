// Runtime platform detection. The same SvelteKit app runs as a native Tauri
// desktop app and as a hosted web/PWA (raveirc.coders.ph/chat). Desktop talks
// to IRC through the Rust backend (invoke/listen); the web build talks to the
// WebSocket↔IRC gateway instead.

/** True when running inside a Tauri webview (desktop or, later, native mobile). */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window || "isTauri" in window)
  );
}

/** True for the plain-browser web/PWA build (no Rust backend available). */
export function isWeb(): boolean {
  return !isTauri();
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
