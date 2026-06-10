// Browser IRC core for the web/PWA build. Where the desktop app uses the Rust
// backend, this connects through the WebSocket↔IRC gateway and performs the
// registration handshake (PASS / CAP+SASL / NICK / USER), keepalive PONGs,
// auto-identify and autojoin, then emits the same IrcEvents the store consumes.

import type { IrcEvent, ServerConfig } from "./types";
import { parseIrcLine } from "./ircparse";
import { gatewayUrl } from "../platform";

/** UTF-8 safe base64 for SASL PLAIN. */
function b64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

interface Conn {
  id: number;
  ws: WebSocket;
  config: ServerConfig;
  nick: string;
  altQueue: string[];
  registered: boolean;
  useSasl: boolean;
  capEnded: boolean;
  closed: boolean;
}

export class WebIrcClient {
  private cb: (ev: IrcEvent) => void = () => {};
  private conns = new Map<number, Conn>();
  private nextId = 1;

  subscribe(cb: (ev: IrcEvent) => void) {
    this.cb = cb;
  }

  private emit(ev: IrcEvent) {
    this.cb(ev);
  }

  connect(config: ServerConfig, reuseId?: number): number {
    // reuseId reconnects an existing window in place (mIRC-style): tear down the
    // old socket without removing the window, then connect under the same id.
    const id = reuseId ?? this.nextId++;
    if (reuseId != null) {
      this.nextId = Math.max(this.nextId, reuseId + 1);
      const old = this.conns.get(reuseId);
      if (old) {
        old.closed = true; // suppress the old socket's "disconnected" event
        try {
          old.ws.close();
        } catch {
          /* ignore */
        }
        this.conns.delete(reuseId);
      }
    }
    this.emit({ kind: "connecting", serverId: id, host: config.host, port: config.port });
    const url = `${gatewayUrl()}?host=${encodeURIComponent(config.host)}&port=${config.port}&tls=${config.tls ? 1 : 0}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.emit({ kind: "error", serverId: id, message: "Could not open gateway connection." });
      this.emit({ kind: "disconnected", serverId: id, reason: "gateway error" });
      return id;
    }
    const conn: Conn = {
      id,
      ws,
      config,
      nick: config.nick,
      altQueue: [...(config.altNicks ?? [])],
      registered: false,
      useSasl: !!config.saslPassword,
      capEnded: false,
      closed: false,
    };
    this.conns.set(id, conn);
    ws.onopen = () => this.onOpen(conn);
    ws.onmessage = (e) => this.onLine(conn, typeof e.data === "string" ? e.data : "");
    ws.onclose = () => this.onClose(conn, "connection closed");
    ws.onerror = () => {
      this.emit({ kind: "error", serverId: id, message: "Gateway/socket error." });
    };
    return id;
  }

  private send(c: Conn, line: string) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(line);
  }

  private onOpen(c: Conn) {
    this.emit({ kind: "connected", serverId: c.id });
    if (c.config.password) this.send(c, `PASS ${c.config.password}`);
    if (c.useSasl) this.send(c, "CAP LS 302");
    this.send(c, `NICK ${c.nick}`);
    const user = c.config.username || c.nick;
    this.send(c, `USER ${user} 0 * :${c.config.realname || "RAVEIRC user"}`);
    // No SASL → nothing else to negotiate; CAP was never started.
  }

  private capEnd(c: Conn) {
    if (!c.capEnded) {
      c.capEnded = true;
      this.send(c, "CAP END");
    }
  }

  private onLine(c: Conn, data: string) {
    for (const raw of data.split("\n")) {
      const line = raw.replace(/\r$/, "");
      if (!line) continue;
      const msg = parseIrcLine(line);
      const cmd = msg.command.toUpperCase();

      // Keepalive: answer PINGs ourselves (the store ignores PING/PONG).
      if (cmd === "PING") {
        this.send(c, `PONG :${msg.params[msg.params.length - 1] ?? ""}`);
      }

      // SASL / capability negotiation.
      if (c.useSasl && !c.registered) {
        if (cmd === "CAP") {
          const sub = (msg.params[1] || "").toUpperCase();
          const list = (msg.params[msg.params.length - 1] || "").toLowerCase();
          if ((sub === "LS" || sub === "NEW") && /\bsasl\b/.test(list)) {
            this.send(c, "CAP REQ :sasl");
          } else if (sub === "ACK" && /\bsasl\b/.test(list)) {
            this.send(c, "AUTHENTICATE PLAIN");
          } else if (sub === "NAK") {
            this.capEnd(c);
          }
        } else if (cmd === "AUTHENTICATE" && msg.params[0] === "+") {
          const acct = c.config.saslAccount || c.nick;
          this.send(c, `AUTHENTICATE ${b64(`${acct}\0${acct}\0${c.config.saslPassword ?? ""}`)}`);
        } else if (["900", "903"].includes(cmd)) {
          this.capEnd(c); // logged in / SASL success
        } else if (["902", "904", "905", "906", "907", "908"].includes(cmd)) {
          this.capEnd(c); // SASL failed — proceed unauthenticated rather than stall
        }
      }

      // Nick already in use during registration → try the next alt nick.
      if ((cmd === "433" || cmd === "432" || cmd === "436") && !c.registered) {
        const next = c.altQueue.shift() ?? `${c.nick}_`;
        c.nick = next;
        this.send(c, `NICK ${next}`);
      }

      // Welcome → registered.
      if (cmd === "001") {
        c.registered = true;
        c.nick = msg.params[0] || c.nick;
        this.emit({ kind: "registered", serverId: c.id, nick: c.nick });
        this.afterRegister(c);
      }

      // Everything else flows to the store as a normal message.
      this.emit({ kind: "message", serverId: c.id, raw: line, message: msg });
    }
  }

  private afterRegister(c: Conn) {
    if (c.config.autoIdentify && c.config.nickservPassword) {
      this.send(c, `PRIVMSG NickServ :IDENTIFY ${c.config.nickservPassword}`);
    }
    for (const ch of c.config.autojoin ?? []) {
      const chan = ch.startsWith("#") || ch.startsWith("&") ? ch : `#${ch}`;
      this.send(c, `JOIN ${chan}`);
    }
  }

  private onClose(c: Conn, reason: string) {
    if (c.closed) return;
    c.closed = true;
    this.conns.delete(c.id);
    this.emit({ kind: "disconnected", serverId: c.id, reason });
  }

  sendRaw(serverId: number, line: string) {
    const c = this.conns.get(serverId);
    if (c) this.send(c, line);
  }

  sendMessage(serverId: number, target: string, text: string) {
    const c = this.conns.get(serverId);
    if (c) this.send(c, `PRIVMSG ${target} :${text}`);
  }

  disconnect(serverId: number, quit: string) {
    const c = this.conns.get(serverId);
    if (!c) return;
    this.send(c, `QUIT :${quit}`);
    try {
      c.ws.close();
    } catch {
      /* ignore */
    }
    this.onClose(c, quit || "disconnected");
  }
}
