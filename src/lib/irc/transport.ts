// Unified IRC transport: the desktop app drives the Rust backend (invoke/listen);
// the web/PWA build drives the in-page WebIrcClient over the WebSocket gateway.
// The store calls these instead of invoke/listen directly, so it's identical on
// both platforms.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isWeb } from "../platform";
import type { IrcEvent, ServerConfig } from "./types";
import { WebIrcClient } from "./webclient";

let web: WebIrcClient | null = null;
function webClient(): WebIrcClient {
  return (web ??= new WebIrcClient());
}

/** Subscribe to IRC events. Returns an unsubscribe function. */
export async function subscribeIrc(cb: (ev: IrcEvent) => void): Promise<() => void> {
  if (isWeb()) {
    webClient().subscribe(cb);
    return () => {};
  }
  return listen<IrcEvent>("irc-event", (e) => cb(e.payload));
}

export async function connectServer(config: ServerConfig): Promise<number> {
  if (isWeb()) return webClient().connect(config);
  return invoke<number>("irc_connect", { config });
}

export async function sendRaw(serverId: number, line: string): Promise<void> {
  if (isWeb()) return webClient().sendRaw(serverId, line);
  await invoke("irc_send_raw", { serverId, line });
}

export async function sendMessage(serverId: number, target: string, text: string): Promise<void> {
  if (isWeb()) return webClient().sendMessage(serverId, target, text);
  await invoke("irc_send_message", { serverId, target, text });
}

export function disconnectIrc(serverId: number, quitMessage: string): void {
  if (isWeb()) {
    webClient().disconnect(serverId, quitMessage);
    return;
  }
  invoke("irc_disconnect", { serverId, quitMessage }).catch(() => {});
}
