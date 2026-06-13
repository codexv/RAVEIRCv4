import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IrcEvent, IrcMessage } from "./types";

// --- Mock the Tauri bridge so we can drive events and capture invoke calls ---
const h = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  // Listeners keyed by event name (the store registers irc-event + socket-event).
  handlers: {} as Record<string, (e: { payload: unknown }) => void>,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: h.invokeMock,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (name: string, cb: (e: { payload: unknown }) => void) => {
    h.handlers[name] = cb;
    return Promise.resolve(() => {});
  },
}));

import { IrcStore } from "./store.svelte";
import { defaultRaveConfig } from "./rave";

/** Emit an engine event into the store under test. */
function emit(ev: IrcEvent) {
  h.handlers["irc-event"]({ payload: ev });
}

/** Build a parsed IRC message like the Rust engine sends. */
function msg(
  command: string,
  params: string[],
  nick: string | null = null,
  addr: { user?: string; host?: string } = {},
): IrcMessage {
  const user = addr.user ?? "u";
  const host = addr.host ?? "h";
  return {
    tags: {},
    prefix: nick
      ? { raw: `${nick}!${user}@${host}`, nick, user, host }
      : { raw: "irc.dal.net", nick: null, user: null, host: null },
    command,
    params,
  };
}

describe("IrcStore event handling", () => {
  let irc: IrcStore;

  beforeEach(async () => {
    h.invokeMock.mockReset();
    h.invokeMock.mockImplementation((cmd: string) =>
      Promise.resolve(cmd === "rave_get_config" ? defaultRaveConfig() : undefined),
    );
    irc = new IrcStore();
    await irc.init();
  });

  /** Make us an op in a channel we've joined (so protections can act). */
  function joinAsOp(chan: string) {
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", [chan], "rave") });
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("353", ["rave", "=", chan, "@rave"]),
    });
    // Live enforcement tests want protections active immediately. End the
    // post-registration ZNC-playback grace window so messages count as live.
    endPlayback();
  }

  /** Clear the per-server playback-suppression window (test-only access). */
  function endPlayback(serverId = 1) {
    (irc as unknown as { playbackUntil: Map<number, number> }).playbackUntil.set(serverId, 0);
  }

  it("creates a server + console buffer with a numeric serverId", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });

    expect(irc.servers).toHaveLength(1);
    expect(irc.servers[0].id).toBe(1);

    const consoleBuf = irc.buffers.find((b) => b.kind === "server");
    expect(consoleBuf).toBeDefined();
    // The bug that broke every command: serverId must be a real number.
    expect(consoleBuf!.serverId).toBe(1);
    expect(typeof consoleBuf!.serverId).toBe("number");
  });

  it("records nick + status on registration", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });

    expect(irc.servers[0].status).toBe("registered");
    expect(irc.servers[0].nick).toBe("rave");
  });

  it("sends /join with a DEFINED serverId (regression for missing serverId)", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });

    await irc.sendInput("/join #makati");

    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", {
      serverId: 1,
      line: "JOIN #makati",
    });
    const [, args] = h.invokeMock.mock.calls.at(-1)!;
    expect((args as { serverId: unknown }).serverId).toBe(1);
    expect((args as { serverId: unknown }).serverId).not.toBeUndefined();
  });

  it("opens a channel buffer and marks it joined on self-JOIN", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });

    const chan = irc.buffers.find((b) => b.kind === "channel" && b.name === "#makati");
    expect(chan).toBeDefined();
    expect(chan!.joined).toBe(true);
    // self-join switches the active buffer to the channel
    expect(irc.active?.name).toBe("#makati");
  });

  it("populates the nicklist with prefixes from NAMES (353)", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("353", ["rave", "=", "#makati", "@chanop rave +voiced"]),
    });

    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    const op = chan.users.find((u) => u.nick === "chanop");
    const voiced = chan.users.find((u) => u.nick === "voiced");
    expect(op?.prefix).toBe("@");
    expect(voiced?.prefix).toBe("+");
    expect(chan.users.find((u) => u.nick === "rave")).toBeDefined();
  });

  it("sorts the nicklist ops-first, normal users last", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("353", ["rave", "=", "#makati", "znormal @opguy +voiceguy anormal"]),
    });

    const order = irc.buffers.find((b) => b.name === "#makati")!.users.map((u) => u.nick);
    expect(order[0]).toBe("opguy"); // @ first
    expect(order[1]).toBe("voiceguy"); // + next
    // normal users come after the voiced user, alphabetically
    expect(order.indexOf("voiceguy")).toBeLessThan(order.indexOf("anormal"));
    expect(order.indexOf("voiceguy")).toBeLessThan(order.indexOf("znormal"));
    expect(order.indexOf("anormal")).toBeLessThan(order.indexOf("znormal"));
  });

  it("never lists the same nick twice (case-insensitive) — guards each_key_duplicate", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    // NAMES lists "Bob"; a later JOIN/WHO arrives as "bob" (different case).
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("353", ["rave", "=", "#makati", "@Bob rave"]),
    });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "bob") });

    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    const bobs = chan.users.filter((u) => u.nick.toLowerCase() === "bob");
    expect(bobs).toHaveLength(1);
    expect(bobs[0].prefix).toBe("@"); // op status preserved through the merge

    // A nick-change onto an already-present nick must not duplicate either.
    emit({ kind: "message", serverId: 1, raw: "", message: msg("NICK", ["BOB"], "rave") });
    const finalBobs = irc.buffers
      .find((b) => b.name === "#makati")!
      .users.filter((u) => u.nick.toLowerCase() === "bob");
    expect(finalBobs).toHaveLength(1);
  });

  it("adds an incoming channel message to the right buffer", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("PRIVMSG", ["#makati", "hello channel"], "bob"),
    });

    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    const line = chan.lines.find((l) => l.text === "hello channel");
    expect(line).toBeDefined();
    expect(line!.from).toBe("bob");
  });

  it("sends a plain message via irc_send_message with a defined serverId", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });

    await irc.sendInput("hi everyone");

    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_message", {
      serverId: 1,
      target: "#makati",
      text: "hi everyone",
    });
  });

  it("resolves /op to network-aware ChanServ on DALnet", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });

    await irc.sendInput("/op bob");

    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", {
      serverId: 1,
      line: "CHANSERV OP #makati bob",
    });
  });

  it("/op with no nick ops yourself", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });

    await irc.sendInput("/op");

    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", {
      serverId: 1,
      line: "CHANSERV OP #makati rave",
    });
  });

  it("resolves /identify to NickServ", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });

    await irc.sendInput("/identify hunter2");

    // Raw NICKSERV alias (idle-safe), not a PRIVMSG to NickServ.
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", {
      serverId: 1,
      line: "NICKSERV IDENTIFY rave hunter2",
    });
  });

  it("tracks user@host in the IAL from JOINs (clone detection)", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("JOIN", ["#makati"], "clone1", { host: "1.2.3.4" }),
    });
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("JOIN", ["#makati"], "clone2", { host: "1.2.3.4" }),
    });
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("JOIN", ["#makati"], "other", { host: "5.6.7.8" }),
    });

    expect(irc.usersByHost(1, "#makati", "1.2.3.4").sort()).toEqual(["clone1", "clone2"]);
    expect(irc.address(1, "#makati", "clone1")).toBe("clone1!u@1.2.3.4");
    expect(irc.comchan(1, "clone1")).toEqual(["#makati"]);
  });

  it("fills the IAL from WHO (352) replies", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    // 352: <me> <chan> <user> <host> <server> <nick> <flags> :<hop realname>
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("352", ["rave", "#makati", "ident", "host.isp.net", "srv", "bob", "H", "0 Bob"]),
    });
    expect(irc.address(1, "#makati", "bob")).toBe("bob!ident@host.isp.net");
  });

  it("kicks a non-friend for a bad word when we are op", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    const cfg = defaultRaveConfig();
    cfg.protections.badword = { enabled: true, words: ["badword"], ban: false, reason: "lang" };
    irc.applyConfig(cfg);
    joinAsOp("#makati");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "troll") });

    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("PRIVMSG", ["#makati", "you badword"], "troll"),
    });

    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", {
      serverId: 1,
      line: "KICK #makati troll :lang",
    });
  });

  it("does NOT kick a friend for a bad word", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    const cfg = defaultRaveConfig();
    cfg.protections.badword = { enabled: true, words: ["badword"], ban: false, reason: "lang" };
    cfg.protections.friends = ["buddy"];
    irc.applyConfig(cfg);
    joinAsOp("#makati");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "buddy") });

    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("PRIVMSG", ["#makati", "you badword"], "buddy"),
    });

    const kicks = h.invokeMock.mock.calls.filter(
      (c) => c[0] === "irc_send_raw" && String((c[1] as { line: string }).line).startsWith("KICK"),
    );
    expect(kicks).toHaveLength(0);
  });

  it("bans+kicks excess clones on join when configured", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    const cfg = defaultRaveConfig();
    cfg.protections.clone = { enabled: true, limit: 2, ban: true, reason: "clones" };
    irc.applyConfig(cfg);
    joinAsOp("#makati");

    // three users from the same host; the 3rd exceeds limit 2
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "c1", { host: "9.9.9.9" }) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "c2", { host: "9.9.9.9" }) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "c3", { host: "9.9.9.9" }) });

    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", {
      serverId: 1,
      line: "MODE #makati +b *!*@9.9.9.9",
    });
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", {
      serverId: 1,
      line: "KICK #makati c3 :clones",
    });
  });

  it("ScanIP reports IAL matches in a channel", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "bob", { host: "1.2.3.4" }) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "eve", { host: "1.2.3.4" }) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "carol", { host: "9.9.9.9" }) });

    await irc.sendInput("/scanip 1.2.3.4");

    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    const summary = chan.lines.find((l) => l.text.includes('ScanIP #makati "1.2.3.4"'));
    expect(summary?.text).toContain("2 match(es)");
    // scan detail lines are indented with two spaces
    const details = chan.lines.filter((l) => l.text.startsWith("  ")).map((l) => l.text);
    expect(details.some((t) => t.includes("bob"))).toBe(true);
    expect(details.some((t) => t.includes("eve"))).toBe(true);
    expect(details.some((t) => t.includes("carol"))).toBe(false);
  });

  it("Secure Query warns on a PM from an unknown sender when enabled", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    const cfg = defaultRaveConfig();
    cfg.secureQuery = true;
    irc.applyConfig(cfg);

    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("PRIVMSG", ["rave", "hi want free stuff?"], "stranger"),
    });

    const q = irc.buffers.find((b) => b.kind === "query" && b.name === "stranger")!;
    expect(q.lines.some((l) => l.text.includes("Secure Query") && l.text.includes("unknown"))).toBe(
      true,
    );
  });

  it("AI auto-enforce kicks on a flagged verdict above the severity threshold", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    const cfg = defaultRaveConfig();
    cfg.ai = {
      enabled: true,
      endpoint: "http://localhost:11434",
      model: "llama3.2:1b",
      moderate: true,
      autoEnforce: true,
      ban: false,
      minSeverity: 4,
    };
    irc.applyConfig(cfg);
    h.invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "rave_get_config") return Promise.resolve(defaultRaveConfig());
      if (cmd === "ai_moderate")
        return Promise.resolve({ flag: true, category: "scam", severity: 5, reason: "phishing" });
      return Promise.resolve(undefined);
    });
    joinAsOp("#makati");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "troll") });

    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("PRIVMSG", ["#makati", "free crypto, dm me"], "troll"),
    });
    await new Promise((r) => setTimeout(r, 0)); // let the async AI verdict resolve

    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", {
      serverId: 1,
      line: "KICK #makati troll :phishing",
    });
  });

  it("AI flag-only mode does NOT kick", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    const cfg = defaultRaveConfig();
    cfg.ai = {
      enabled: true,
      endpoint: "http://localhost:11434",
      model: "llama3.2:1b",
      moderate: true,
      autoEnforce: false,
      ban: false,
      minSeverity: 4,
    };
    irc.applyConfig(cfg);
    h.invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "rave_get_config") return Promise.resolve(defaultRaveConfig());
      if (cmd === "ai_moderate")
        return Promise.resolve({ flag: true, category: "spam", severity: 5, reason: "ad" });
      return Promise.resolve(undefined);
    });
    joinAsOp("#makati");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "troll") });
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("PRIVMSG", ["#makati", "buy now"], "troll"),
    });
    await new Promise((r) => setTimeout(r, 0));

    const kicks = h.invokeMock.mock.calls.filter(
      (c) => c[0] === "irc_send_raw" && String((c[1] as { line: string }).line).startsWith("KICK"),
    );
    expect(kicks).toHaveLength(0);
    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.lines.some((l) => l.text.includes("flagged"))).toBe(true);
  });

  it("routes a private notice to the active window (no new query buffer)", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    // active is now #makati after self-join
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("NOTICE", ["rave", "You are now identified."], "NickServ"),
    });

    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.lines.some((l) => l.text.includes("You are now identified."))).toBe(true);
    // no separate "nickserv" query buffer was spawned
    expect(irc.buffers.find((b) => b.name.toLowerCase() === "nickserv")).toBeUndefined();
  });

  it("keeps a channel-targeted notice in that channel", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#other"], "rave") });
    irc.select("1 #makati"); // make #makati active
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("NOTICE", ["#other", "channel notice"], "bob"),
    });

    const other = irc.buffers.find((b) => b.name === "#other")!;
    expect(other.lines.some((l) => l.text.includes("channel notice"))).toBe(true);
  });

  it("applies per-channel protection overrides (one channel only)", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    const cfg = defaultRaveConfig();
    // global bad-word stays OFF; only #makati gets an override that enables it
    const override = structuredClone(defaultRaveConfig().protections);
    override.badword = { enabled: true, words: ["badword"], ban: false, reason: "lang" };
    cfg.channelProtections["dalnet/#makati"] = override;
    irc.applyConfig(cfg);
    joinAsOp("#makati");
    joinAsOp("#other");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "t1") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#other"], "t2") });

    emit({ kind: "message", serverId: 1, raw: "", message: msg("PRIVMSG", ["#makati", "a badword"], "t1") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("PRIVMSG", ["#other", "a badword"], "t2") });

    const lines = h.invokeMock.mock.calls
      .filter((c) => c[0] === "irc_send_raw")
      .map((c) => (c[1] as { line: string }).line);
    expect(lines).toContain("KICK #makati t1 :lang"); // override active here
    expect(lines.some((l) => l.startsWith("KICK #other"))).toBe(false); // global default off
  });

  it("auto-ops a matching user on join", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    const cfg = defaultRaveConfig();
    cfg.protections.autoOp = ["trustedop"];
    cfg.protections.autoVoice = ["*!*@regulars.host"];
    irc.applyConfig(cfg);
    joinAsOp("#makati");

    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "trustedop") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "reg", { host: "regulars.host" }) });

    const lines = h.invokeMock.mock.calls
      .filter((c) => c[0] === "irc_send_raw")
      .map((c) => (c[1] as { line: string }).line);
    expect(lines).toContain("MODE #makati +o trustedop");
    expect(lines).toContain("MODE #makati +v reg");
  });

  it("global-kicks a nick from all common channels where we're op", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#a");
    joinAsOp("#b");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#a"], "spammer") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#b"], "spammer") });

    await irc.sendInput("/gkick spammer bye now");

    const lines = h.invokeMock.mock.calls
      .filter((c) => c[0] === "irc_send_raw")
      .map((c) => (c[1] as { line: string }).line);
    expect(lines).toContain("KICK #a spammer :bye now");
    expect(lines).toContain("KICK #b spammer :bye now");
  });

  it("evaluates // commands mIRC-style (//whois $me)", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });

    await irc.sendInput("//whois $me");

    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "WHOIS rave" });
  });

  it("does NOT evaluate identifiers for a single slash (literal)", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });

    await irc.sendInput("/whois $me");

    // single slash sends $me literally (not expanded)
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "WHOIS $me" });
  });

  it("removes a user from the nicklist on PART", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "bob") });
    let chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.users.find((u) => u.nick === "bob")).toBeDefined();

    emit({ kind: "message", serverId: 1, raw: "", message: msg("PART", ["#makati"], "bob") });
    chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.users.find((u) => u.nick === "bob")).toBeUndefined();
  });

  it("intelligent ban: bans the trigger word + kicks an offensive nick on join", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    irc.raveConfig.protections.offensiveNick = { enabled: true, words: ["4hire"], reason: "no ads" };
    joinAsOp("#makati");
    h.invokeMock.mockClear();
    emit({
      kind: "message",
      serverId: 1,
      raw: "",
      message: msg("JOIN", ["#makati"], "girl4hire", { user: "ad", host: "h.com" }),
    });
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati +b *4hire*!*@*" });
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "KICK #makati girl4hire :no ads" });
  });

  it("shows your own nick change in the server console (not suppressed)", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("NICK", ["rave2"], "rave") });
    const srv = irc.buffers.find((b) => b.kind === "server")!;
    expect(srv.lines.some((l) => l.text.includes("You are now known as rave2"))).toBe(true);
  });

  it("closeServer drops the server + its buffers and ignores late events", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    expect(irc.servers).toHaveLength(1);
    expect(irc.buffers.some((b) => b.name === "#makati")).toBe(true);

    irc.closeServer(1);
    expect(irc.servers).toHaveLength(0);
    expect(irc.buffers.filter((b) => b.serverId === 1)).toHaveLength(0);

    // A late "disconnected" must not resurrect the closed window.
    emit({ kind: "disconnected", serverId: 1, reason: "ping timeout" });
    expect(irc.servers).toHaveLength(0);
    expect(irc.buffers.filter((b) => b.serverId === 1)).toHaveLength(0);
  });

  // ---- Channel Central dialog: topic + ban list --------------------------

  it("populates the ban list from RPL_BANLIST (367) and ends on 368", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("367", ["rave", "#makati", "*!*@bad.com", "op", "1700000000"]) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("367", ["rave", "#makati", "troll!*@*"]) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("368", ["rave", "#makati"]) });
    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.bans?.map((b) => b.mask)).toEqual(["*!*@bad.com", "troll!*@*"]);
    expect(chan.bans?.[0]).toMatchObject({ by: "op", ts: 1700000000 });
    expect(chan.listLoading?.b).toBe(false);
  });

  it("openChannelDialog requests +b and sets the dialog id", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati");
    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    h.invokeMock.mockClear();
    irc.openChannelDialog(chan.id);
    expect(irc.channelDialogId).toBe(chan.id);
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati +b" });
    expect(chan.listLoading?.b).toBe(true);
  });

  it("tracks observed MODE +b / -b on the live ban list", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("MODE", ["#makati", "+b", "x!*@*"], "op") });
    let chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.bans?.map((b) => b.mask)).toEqual(["x!*@*"]);
    emit({ kind: "message", serverId: 1, raw: "", message: msg("MODE", ["#makati", "-b", "x!*@*"], "op") });
    chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.bans?.map((b) => b.mask)).toEqual([]);
  });

  it("removeBan / setChannelTopic send the right raw lines", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati");
    h.invokeMock.mockClear();
    irc.removeBan(1, "#makati", "x!*@*");
    irc.setChannelTopic(1, "#makati", "new topic");
    await Promise.resolve();
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati -b x!*@*" });
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "TOPIC #makati :new topic" });
  });

  it("populates exception (+e) and invite (+I) lists from 348/349 and 346/347", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("348", ["rave", "#makati", "good!*@host"]) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("349", ["rave", "#makati"]) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("346", ["rave", "#makati", "friend!*@*"]) });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("347", ["rave", "#makati"]) });
    const chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.excepts?.map((b) => b.mask)).toEqual(["good!*@host"]);
    expect(chan.invites?.map((b) => b.mask)).toEqual(["friend!*@*"]);
    // Live MODE +e / +I are tracked too.
    emit({ kind: "message", serverId: 1, raw: "", message: msg("MODE", ["#makati", "+e", "e2!*@*"], "op") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("MODE", ["#makati", "-I", "friend!*@*"], "op") });
    const c2 = irc.buffers.find((b) => b.name === "#makati")!;
    expect(c2.excepts?.map((b) => b.mask)).toEqual(["good!*@host", "e2!*@*"]);
    expect(c2.invites?.map((b) => b.mask)).toEqual([]);
  });

  it("timed ban: sets +b, records an expiry, and auto-unbans after the delay", () => {
    vi.useFakeTimers();
    try {
      emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
      emit({ kind: "registered", serverId: 1, nick: "rave" });
      joinAsOp("#makati");
      h.invokeMock.mockClear();
      irc.timedBan(1, "#makati", "troll!*@*", 60);
      expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati +b troll!*@*" });
      expect(irc.banExpiry(1, "#makati", "troll!*@*")).toBeGreaterThan(0);
      h.invokeMock.mockClear();
      vi.advanceTimersByTime(60_000);
      expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati -b troll!*@*" });
      expect(irc.banExpiry(1, "#makati", "troll!*@*")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("/ban -u600 builds a host mask and sets a timed ban", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati");
    // Give the IAL a host for the offender.
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "troll", { host: "evil.com" }) });
    endPlayback();
    h.invokeMock.mockClear();
    await irc.sendInput("/ban -u600 troll");
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati +b *!*@evil.com" });
    expect(irc.banExpiry(1, "#makati", "*!*@evil.com")).toBeGreaterThan(0);
  });

  it("tracks channel modes from RPL_CHANNELMODEIS (324) and live MODE changes", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati");
    emit({ kind: "message", serverId: 1, raw: "", message: msg("324", ["rave", "#makati", "+ntkl", "sekret", "50"]) });
    let chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.modeFlags).toBe("nt");
    expect(chan.modeKey).toBe("sekret");
    expect(chan.modeLimit).toBe(50);

    // Live: +m adds, -k clears the key, -l clears the limit.
    emit({ kind: "message", serverId: 1, raw: "", message: msg("MODE", ["#makati", "+m-k", "sekret"], "op") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("MODE", ["#makati", "-l"], "op") });
    chan = irc.buffers.find((b) => b.name === "#makati")!;
    expect(chan.modeFlags).toBe("mnt");
    expect(chan.modeKey).toBe("");
    expect(chan.modeLimit).toBe(0);
  });

  it("setChannelMode / key / limit send the right raw lines", async () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati");
    h.invokeMock.mockClear();
    irc.setChannelMode(1, "#makati", "m", true);
    irc.setChannelLimit(1, "#makati", 25);
    irc.setChannelKey(1, "#makati", "hunter2");
    await Promise.resolve();
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati +m" });
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati +l 25" });
    expect(h.invokeMock).toHaveBeenCalledWith("irc_send_raw", { serverId: 1, line: "MODE #makati +k hunter2" });
  });

  // ---- ZNC playback: don't enforce protections on replayed buffer --------

  it("does NOT enforce protections during the post-registration playback window", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    // op up WITHOUT clearing the playback window (don't use joinAsOp here)
    emit({ kind: "message", serverId: 1, raw: "", message: msg("JOIN", ["#makati"], "rave") });
    emit({ kind: "message", serverId: 1, raw: "", message: msg("353", ["rave", "=", "#makati", "@rave"]) });
    irc.raveConfig.antispam.enabled = true;
    irc.raveConfig.antispam.repeatLimit = 2;
    h.invokeMock.mockClear();
    // A flood of identical lines that WOULD normally trip the repeat guard.
    for (let i = 0; i < 5; i++) {
      emit({ kind: "message", serverId: 1, raw: "", message: msg("PRIVMSG", ["#makati", "BUY NOW"], "spammer", { host: "h" }) });
    }
    const banned = h.invokeMock.mock.calls.some(
      ([c, a]) => c === "irc_send_raw" && String((a as { line?: string }).line).includes("+b"),
    );
    expect(banned).toBe(false); // suppressed: looks like ZNC replay
  });

  it("treats a message with an old server-time tag as replay (no enforcement)", () => {
    emit({ kind: "connecting", serverId: 1, host: "irc.dal.net", port: 6697 });
    emit({ kind: "registered", serverId: 1, nick: "rave" });
    joinAsOp("#makati"); // clears the time-window grace, so only the tag matters
    irc.raveConfig.antispam.enabled = true;
    irc.raveConfig.antispam.repeatLimit = 2;
    h.invokeMock.mockClear();
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    for (let i = 0; i < 5; i++) {
      const m = msg("PRIVMSG", ["#makati", "BUY NOW"], "spammer", { host: "h" });
      m.tags = { time: old };
      emit({ kind: "message", serverId: 1, raw: "", message: m });
    }
    const banned = h.invokeMock.mock.calls.some(
      ([c, a]) => c === "irc_send_raw" && String((a as { line?: string }).line).includes("+b"),
    );
    expect(banned).toBe(false);
  });
});
