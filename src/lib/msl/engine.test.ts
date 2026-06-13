import { describe, it, expect } from "vitest";
import { MslEngine, type EventData } from "./engine";
import type { MslHost } from "./exec";

function harness() {
  const sent: string[] = [];
  const echoed: string[] = [];
  const host: MslHost = { sendRaw: (l) => sent.push(l), echo: (t) => echoed.push(t) };
  return { sent, echoed, host };
}

const data = (over: Partial<EventData> = {}): EventData => ({
  me: "rave",
  nick: "bob",
  chan: "#makati",
  target: "#makati",
  address: "bob!u@host",
  ...over,
});

describe("MslEngine aliases", () => {
  it("runs a one-liner alias", () => {
    const e = new MslEngine();
    e.load("alias hi /msg $chan hello $nick", "", "");
    const { sent, host } = harness();
    expect(e.runAlias("hi", "", data(), host)).toBe(true);
    expect(sent).toContain("PRIVMSG #makati :hello bob");
  });

  it("routes msg/notice/me through the echoing host methods when present", () => {
    // Regression: an alias for /notice (e.g. /n) was silent — it only sent raw
    // and never echoed locally, unlike mIRC and the built-in /notice command.
    const e = new MslEngine();
    e.load("alias n /notice $1 $2-\nalias mm /msg $1 $2-\nalias act /me $1-", "", "");
    const calls: string[] = [];
    const host: MslHost = {
      sendRaw: (l) => calls.push("RAW:" + l),
      echo: () => {},
      message: (t, x) => calls.push(`MSG:${t}:${x}`),
      notice: (t, x) => calls.push(`NOTICE:${t}:${x}`),
      action: (t, x) => calls.push(`ACTION:${t}:${x}`),
    };
    e.runAlias("n", "bob hello there", data(), host);
    e.runAlias("mm", "#makati hi all", data(), host);
    e.runAlias("act", "waves", data(), host);
    expect(calls).toContain("NOTICE:bob:hello there");
    expect(calls).toContain("MSG:#makati:hi all");
    expect(calls).toContain("ACTION:#makati:waves");
    // Nothing fell through to a silent raw send.
    expect(calls.some((c) => c.startsWith("RAW:"))).toBe(false);
  });

  it("falls back to sendRaw for msg/notice when the host has no echo methods", () => {
    const e = new MslEngine();
    e.load("alias n /notice $1 $2-", "", "");
    const { sent, host } = harness(); // bare host: sendRaw + echo only
    e.runAlias("n", "bob hi", data(), host);
    expect(sent).toContain("NOTICE bob :hi");
  });

  it("resolves a user alias used as an identifier ($alias) with its return value", () => {
    const e = new MslEngine();
    e.load(
      "alias double return $calc($1 * 2)\nalias show /echo -a $double(21)",
      "",
      "",
    );
    const { echoed, host } = harness();
    e.runAlias("show", "", data(), host);
    expect(echoed).toContain("42");
  });

  it("resolves host-backed identifiers ($network) via MslHost.ident", () => {
    const e = new MslEngine();
    e.load("alias n /echo -a net is $network", "", "");
    const echoed: string[] = [];
    const host: MslHost = {
      sendRaw: () => {},
      echo: (t) => echoed.push(t),
      ident: (name) => (name === "network" ? "DALnet" : null),
    };
    e.runAlias("n", "", data(), host);
    expect(echoed).toContain("net is DALnet");
  });

  it("routes host-backed commands through MslHost.command", () => {
    const e = new MslEngine();
    e.load("alias h /hadd table key value", "", "");
    const cmds: string[] = [];
    const host: MslHost = {
      sendRaw: (l) => cmds.push("RAW:" + l),
      echo: () => {},
      command: (name, rest) => {
        if (name === "hadd") {
          cmds.push("HADD:" + rest);
          return true;
        }
        return false;
      },
    };
    e.runAlias("h", "", data(), host);
    expect(cmds).toEqual(["HADD:table key value"]);
  });

  it("alias-as-identifier passes args and composes; unknown stays empty", () => {
    const e = new MslEngine();
    e.load(
      "alias greet return Hello $1 from $me\nalias g /echo -a ( $greet(bob) ) ( $nope(x) )",
      "",
      "",
    );
    const { echoed, host } = harness();
    e.runAlias("g", "", data(), host);
    expect(echoed).toContain("( Hello bob from rave ) (  )");
  });

  it("[ ] brackets build dynamic variable names in /set and reads", () => {
    const e = new MslEngine();
    // %u. [ $+ [ $nick ] ] → %u.bob ; set it then echo it back
    e.load("alias t { set %u. [ $+ [ $nick ] ] hi | echo -a got %u. [ $+ [ $nick ] ] }", "", "");
    const { echoed, host } = harness();
    e.runAlias("t", "", data(), host);
    expect(echoed).toContain("got hi");
  });

  it("runs a block alias with if/else", () => {
    const e = new MslEngine();
    e.load(
      "alias check {\n  if ($1 == admin) { /msg $chan yes }\n  else { /msg $chan no }\n}",
      "",
      "",
    );
    const { sent, host } = harness();
    e.runAlias("check", "admin", data(), host);
    e.runAlias("check", "guest", data(), host);
    expect(sent).toEqual(["PRIVMSG #makati :yes", "PRIVMSG #makati :no"]);
  });

  it("supports variables (set/inc)", () => {
    const e = new MslEngine();
    e.load("alias bump {\n  inc %count\n  /msg $chan count is %count\n}", "", "%count 4");
    const { sent, host } = harness();
    e.runAlias("bump", "", data(), host);
    expect(sent).toContain("PRIVMSG #makati :count is 5");
  });

  it("returns false for unknown alias", () => {
    const e = new MslEngine();
    e.load("", "", "");
    expect(e.runAlias("nope", "", data(), harness().host)).toBe(false);
  });
});

describe("MslEngine events", () => {
  it("fires on TEXT with a match and channel filter", () => {
    const e = new MslEngine();
    e.load("", "on *:TEXT:!ping:#:{ /msg $chan pong to $nick }", "");
    const { sent, host } = harness();
    e.dispatch("TEXT", data({ text: "!ping" }), host);
    expect(sent).toContain("PRIVMSG #makati :pong to bob");
  });

  it("does not fire when the match text differs", () => {
    const e = new MslEngine();
    e.load("", "on *:TEXT:!ping:#:{ /msg $chan pong }", "");
    const { sent, host } = harness();
    e.dispatch("TEXT", data({ text: "hello" }), host);
    expect(sent).toHaveLength(0);
  });

  it("handles raw numeric events and haltdef", () => {
    const e = new MslEngine();
    e.load("", "raw 311:*:{ /echo -a $2 is $3 $+ @ $+ $4 | haltdef }", "");
    const { echoed, host } = harness();
    const halted = e.dispatchRaw(
      "311",
      ["me", "bob", "ident", "host.com", "*", "Bob Smith"],
      data(),
      host,
    );
    expect(halted).toBe(true);
    expect(echoed).toContain("bob is ident@host.com");
  });

  it("echo with only a flag echoes a blank line (not the literal flag)", () => {
    const e = new MslEngine();
    e.load("", "raw 311:*:{\n  echo -a\n  echo -a name $2\n  haltdef\n}", "");
    const { echoed, host } = harness();
    e.dispatchRaw("311", ["me", "bob", "u", "h"], data(), host);
    expect(echoed).toEqual(["", "name bob"]);
  });

  it("fires on KICK with $knick and on NICK with $newnick", () => {
    const e = new MslEngine();
    e.load(
      "",
      "on *:KICK:#:{ /msg $chan bye $knick (by $nick) }\non *:NICK:{ /echo -a $nick now $newnick }",
      "",
    );
    const { sent, echoed, host } = harness();
    e.dispatch("KICK", { ...data(), nick: "op", knick: "troll" }, host);
    e.dispatch("NICK", { ...data(), nick: "old", newnick: "new" }, host);
    expect(sent).toContain("PRIVMSG #makati :bye troll (by op)");
    expect(echoed).toContain("old now new");
  });

  it("dispatches DIALOG events to matching on DIALOG handlers (name:event:id)", () => {
    const e = new MslEngine();
    e.load("", "on *:DIALOG:mydlg:sclick:3:{ /echo -a clicked OK }", "");
    const { echoed, host } = harness();
    e.dispatchDialog("mydlg", "sclick", "3", data(), host);
    e.dispatchDialog("mydlg", "sclick", "4", data(), host); // different id: no match
    e.dispatchDialog("other", "sclick", "3", data(), host); // different dialog: no match
    expect(echoed).toEqual(["clicked OK"]);
  });

  it("fires on JOIN with a channel filter", () => {
    const e = new MslEngine();
    e.load("", "on *:JOIN:#:{ /notice $nick welcome to $chan }", "");
    const { sent, host } = harness();
    e.dispatch("JOIN", data({ nick: "newbie", text: "" }), host);
    expect(sent).toContain("NOTICE newbie :welcome to #makati");
  });
});
