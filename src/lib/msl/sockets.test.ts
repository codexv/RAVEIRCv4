import { describe, it, expect } from "vitest";
import { SocketStore, type SocketIO } from "./sockets";
import { emptyCtx } from "./eval";

function setup() {
  const calls: unknown[][] = [];
  const events: [string, string][] = [];
  const reads: string[] = [];
  const ctx = emptyCtx();
  const io: SocketIO = {
    open: (...a) => calls.push(["open", ...a]),
    write: (...a) => calls.push(["write", ...a]),
    close: (...a) => calls.push(["close", ...a]),
  };
  let store: SocketStore;
  store = new SocketStore(io, (event, name) => {
    events.push([event, name]);
    if (event === "SOCKREAD") {
      // Drain all buffered lines, as a real handler would.
      for (;;) {
        store.command("sockread", "%line", ctx);
        const l = ctx.vars.get("line") ?? "";
        if (l === "") break;
        reads.push(l);
      }
    }
  });
  return { store, calls, events, reads, ctx };
}

describe("SocketStore", () => {
  it("/sockopen -e parses TLS, host and port", () => {
    const { store, calls, ctx } = setup();
    store.command("sockopen", "-e gettit irc.example.com 443", ctx);
    expect(calls).toContainEqual(["open", "gettit", "irc.example.com", 443, true]);
  });

  it("open event marks the socket active and fires SOCKOPEN", () => {
    const { store, events } = setup();
    store.command("sockopen", "s host.net 80", emptyCtx());
    store.onEvent({ name: "s", kind: "open" });
    expect(events).toContainEqual(["SOCKOPEN", "s"]);
    expect(store.ident("sock", ["s"], "status")).toBe("active");
    expect(store.ident("sock", ["s"], "port")).toBe("80");
  });

  it("SOCKREAD buffers data and /sockread pulls successive lines", () => {
    const { store, reads } = setup();
    store.command("sockopen", "s host.net 80", emptyCtx());
    store.onEvent({ name: "s", kind: "read", data: "hello\r\nworld\r\n" });
    expect(reads).toEqual(["hello", "world"]);
  });

  it("/sockwrite -n appends CRLF", () => {
    const { store, calls, ctx } = setup();
    store.command("sockwrite", "-n s GET / HTTP/1.0", ctx);
    expect(calls).toContainEqual(["write", "s", "GET / HTTP/1.0\r\n"]);
  });

  it("/sockclose closes the socket; close event fires SOCKCLOSE", () => {
    const { store, calls, events, ctx } = setup();
    store.command("sockopen", "s host.net 80", ctx);
    store.command("sockclose", "s", ctx);
    expect(calls).toContainEqual(["close", "s"]);
    // a backend close event still dispatches SOCKCLOSE
    store.onEvent({ name: "s", kind: "close", error: "reset" });
    expect(events).toContainEqual(["SOCKCLOSE", "s"]);
  });

  it("$sock(N) enumerates open sockets; unknown idents return null", () => {
    const { store, ctx } = setup();
    store.command("sockopen", "a h 80", ctx);
    store.command("sockopen", "b h 80", ctx);
    expect(store.ident("sock", ["0"])).toBe("2");
    expect(store.ident("network", [])).toBeNull();
  });
});
