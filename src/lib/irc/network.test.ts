import { describe, it, expect } from "vitest";
import { detectNetwork, serviceProfile } from "./network";

const srv = (
  name: string,
  network?: string,
): { name: string; isupport: Record<string, string> } => ({
  name,
  isupport: network ? { NETWORK: network } : {},
});

describe("detectNetwork", () => {
  it("detects DALnet by host", () => {
    expect(detectNetwork(srv("irc.dal.net"))).toBe("dalnet");
  });
  it("detects DALnet by NETWORK token", () => {
    expect(detectNetwork(srv("irc.example.org", "DALnet"))).toBe("dalnet");
  });
  it("detects Undernet", () => {
    expect(detectNetwork(srv("irc.undernet.org", "UnderNet"))).toBe("undernet");
  });
  it("detects Libera", () => {
    expect(detectNetwork(srv("irc.libera.chat", "Libera.Chat"))).toBe("libera");
  });
  it("detects Rizon, QuakeNet, EFnet, IRCnet, freenode", () => {
    expect(detectNetwork(srv("irc.rizon.net", "Rizon"))).toBe("rizon");
    expect(detectNetwork(srv("irc.quakenet.org", "QuakeNet"))).toBe("quakenet");
    expect(detectNetwork(srv("irc.efnet.org", "EFnet"))).toBe("efnet");
    expect(detectNetwork(srv("open.ircnet.net", "IRCnet"))).toBe("ircnet");
    expect(detectNetwork(srv("irc.freenode.net", "freenode"))).toBe("freenode");
  });
  it("falls back to generic", () => {
    expect(detectNetwork(srv("irc.unknown.net"))).toBe("generic");
  });
});

describe("service profiles", () => {
  it("DALnet ops via the idle-safe CHANSERV alias (not a PRIVMSG)", () => {
    const p = serviceProfile(srv("irc.dal.net"));
    expect(p.op("#makati", "bob")).toEqual(["CHANSERV OP #makati bob"]);
  });

  it("Libera ops via the idle-safe CHANSERV alias", () => {
    const p = serviceProfile(srv("irc.libera.chat", "Libera.Chat"));
    expect(p.op("#test", "bob")).toEqual(["CHANSERV OP #test bob"]);
  });

  it("Undernet ops via the X bot", () => {
    const p = serviceProfile(srv("irc.undernet.org", "UnderNet"));
    expect(p.op("#chan", "bob")).toEqual([
      "PRIVMSG X@channels.undernet.org :op #chan bob",
    ]);
  });

  it("Undernet identify uses login on X", () => {
    const p = serviceProfile(srv("irc.undernet.org", "UnderNet"));
    expect(p.identify("myuser", "secret")).toEqual([
      "PRIVMSG X@channels.undernet.org :login myuser secret",
    ]);
  });

  it("DALnet akick add maps to CHANSERV AKICK ... ADD", () => {
    const p = serviceProfile(srv("irc.dal.net"));
    expect(p.akickAdd("#makati", "*!*@spam.com")).toEqual([
      "CHANSERV AKICK #makati ADD *!*@spam.com",
    ]);
  });

  it("Undernet akick add maps to X ban", () => {
    const p = serviceProfile(srv("irc.undernet.org", "UnderNet"));
    expect(p.akickAdd("#chan", "*!*@spam.com")).toEqual([
      "PRIVMSG X@channels.undernet.org :ban #chan *!*@spam.com",
    ]);
  });

  it("invite with a nick uses raw INVITE on all networks", () => {
    const p = serviceProfile(srv("irc.libera.chat", "Libera.Chat"));
    expect(p.invite("#test", "bob")).toEqual(["INVITE bob #test"]);
  });

  it("Rizon uses atheme plain ChanServ/NickServ", () => {
    const p = serviceProfile(srv("irc.rizon.net", "Rizon"));
    expect(p.hasServices).toBe(true);
    expect(p.op("#x", "bob")).toEqual(["CHANSERV OP #x bob"]);
    // identify uses the raw NICKSERV alias (idle-safe), not a PRIVMSG.
    expect(p.identify("me", "pw")).toEqual(["NICKSERV IDENTIFY me pw"]);
  });

  it("QuakeNet routes through the Q bot and auths with AUTH", () => {
    const p = serviceProfile(srv("irc.quakenet.org", "QuakeNet"));
    expect(p.identify("me", "pw")).toEqual(["PRIVMSG Q@CServe.quakenet.org :AUTH me pw"]);
    expect(p.op("#x", "bob")).toEqual(["PRIVMSG Q@CServe.quakenet.org :op #x bob"]);
    expect(p.ms(null)).toEqual([]); // no MemoServ
  });

  it("EFnet has no services and acts via raw MODE", () => {
    const p = serviceProfile(srv("irc.efnet.org", "EFnet"));
    expect(p.hasServices).toBe(false);
    expect(p.op("#x", "bob")).toEqual(["MODE #x +o bob"]);
    expect(p.akickAdd("#x", "*!*@bad")).toEqual(["MODE #x +b *!*@bad"]);
    expect(p.identify("me", "pw")).toEqual([]);
    expect(p.cs("anything")).toEqual([]);
  });

  it("IRCnet behaves like EFnet (no services)", () => {
    const p = serviceProfile(srv("open.ircnet.net", "IRCnet"));
    expect(p.hasServices).toBe(false);
    expect(p.deop("#x", "bob")).toEqual(["MODE #x -o bob"]);
  });
});
