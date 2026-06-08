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

  it("fires on JOIN with a channel filter", () => {
    const e = new MslEngine();
    e.load("", "on *:JOIN:#:{ /notice $nick welcome to $chan }", "");
    const { sent, host } = harness();
    e.dispatch("JOIN", data({ nick: "newbie", text: "" }), host);
    expect(sent).toContain("NOTICE newbie :welcome to #makati");
  });
});
