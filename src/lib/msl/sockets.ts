// mIRC sockets for mSL: /sockopen /sockwrite /sockread /sockclose, $sock,
// $sockname, $sockbr, $sockerr, and on SOCKOPEN/SOCKREAD/SOCKCLOSE events.
//
// The Rust backend owns the TCP/TLS connection and streams data via the
// "socket-event" event; this store buffers it, exposes the identifiers/commands,
// and fires the mSL on-events. Pure of Tauri (io + dispatch are injected) so the
// command/buffer logic is unit-testable.

import type { EvalCtx } from "./eval";

export interface SocketIO {
  open(name: string, host: string, port: number, tls: boolean): void;
  write(name: string, data: string): void;
  close(name: string): void;
}

export interface SockEvent {
  name: string;
  kind: "open" | "read" | "close";
  data?: string;
  error?: string;
}

interface SockState {
  status: "connecting" | "active" | "closed";
  buffer: string;
  lastBr: number;
  err: string;
  host: string;
  port: number;
}

export class SocketStore {
  private socks = new Map<string, SockState>();
  /** $sockname of the socket whose event is currently being handled. */
  private current = "";

  constructor(
    private io: SocketIO,
    /** Fire an mSL on-event (SOCKOPEN/SOCKREAD/SOCKCLOSE) for a socket. */
    private dispatch: (event: string, sockName: string) => void,
  ) {}

  /** Handle a socket-event from the Rust backend. */
  onEvent(ev: SockEvent) {
    const key = ev.name.toLowerCase();
    const st = this.socks.get(key);
    if (ev.kind === "open") {
      if (st) st.status = "active";
      this.fire("SOCKOPEN", key);
    } else if (ev.kind === "read") {
      if (st) st.buffer += ev.data ?? "";
      this.fire("SOCKREAD", key);
    } else if (ev.kind === "close") {
      if (st) {
        st.status = "closed";
        st.err = ev.error ?? "";
      }
      this.fire("SOCKCLOSE", key);
      this.socks.delete(key);
    }
  }

  private fire(event: string, name: string) {
    const prev = this.current;
    this.current = name;
    try {
      this.dispatch(event, name);
    } finally {
      this.current = prev;
    }
  }

  /** Handle /sock* commands. Returns true if handled. */
  command(name: string, rest: string, ctx: EvalCtx): boolean {
    switch (name) {
      case "sockopen": {
        let r = rest.trim();
        let tls = false;
        const fm = /^-(\S+)\s+/.exec(r);
        if (fm) {
          tls = fm[1].includes("e");
          r = r.slice(fm[0].length);
        }
        const [nm, host, portStr] = r.split(/\s+/);
        const port = parseInt(portStr ?? "0", 10) || 0;
        if (nm && host && port) {
          const key = nm.toLowerCase();
          this.socks.set(key, { status: "connecting", buffer: "", lastBr: 0, err: "", host, port });
          this.io.open(key, host, port, tls);
        }
        return true;
      }
      case "sockwrite": {
        let r = rest.trim();
        let nl = false;
        const fm = /^-(\S+)\s+/.exec(r);
        if (fm) {
          nl = fm[1].includes("n");
          r = r.slice(fm[0].length);
        }
        const sp = r.indexOf(" ");
        const nm = (sp === -1 ? r : r.slice(0, sp)).toLowerCase();
        let text = sp === -1 ? "" : r.slice(sp + 1);
        if (nl) text += "\r\n";
        this.io.write(nm, text);
        return true;
      }
      case "sockclose": {
        const nm = rest.trim().toLowerCase();
        this.io.close(nm);
        this.socks.delete(nm);
        return true;
      }
      case "sockread": {
        // /sockread [-f] %var — pull one line from the current socket's buffer.
        let r = rest.trim();
        const fm = /^-\S+\s+/.exec(r);
        if (fm) r = r.slice(fm[0].length);
        const vn = r.replace(/^%/, "").toLowerCase();
        const st = this.socks.get(this.current);
        let line = "";
        if (st) {
          const idx = st.buffer.indexOf("\n");
          if (idx >= 0) {
            line = st.buffer.slice(0, idx).replace(/\r$/, "");
            st.buffer = st.buffer.slice(idx + 1);
          } else {
            line = st.buffer;
            st.buffer = "";
          }
          st.lastBr = line.length;
        }
        if (vn) {
          if (ctx.local.has(vn)) ctx.local.set(vn, line);
          else ctx.vars.set(vn, line);
        }
        return true;
      }
      default:
        return false;
    }
  }

  /** Handle $sock / $sockname / $sockbr / $sockerr. Returns value or null. */
  ident(name: string, args: string[], prop?: string): string | null {
    switch (name) {
      case "sockname":
        return this.current;
      case "sockbr":
        return String(this.socks.get(this.current)?.lastBr ?? 0);
      case "sockerr":
        return this.socks.get(this.current)?.err ? "1" : "0";
      case "sock": {
        if (args.length === 0) return this.current;
        const key = (args[0] ?? "").toLowerCase();
        // $sock(N) → Nth open socket name / count
        const n = parseInt(args[0], 10);
        if (!isNaN(n) && String(n) === key) {
          const names = [...this.socks.keys()];
          return n === 0 ? String(names.length) : names[n - 1] ?? "";
        }
        const st = this.socks.get(key);
        if (!st) return "";
        if (prop === "status") return st.status;
        if (prop === "ip" || prop === "addr") return st.host;
        if (prop === "port") return String(st.port);
        return key;
      }
      default:
        return null;
    }
  }
}
