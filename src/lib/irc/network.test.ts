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
  it("falls back to generic", () => {
    expect(detectNetwork(srv("irc.unknown.net"))).toBe("generic");
  });
});

describe("service profiles", () => {
  it("DALnet ops via ChanServ at services.dal.net", () => {
    const p = serviceProfile(srv("irc.dal.net"));
    expect(p.op("#makati", "bob")).toEqual([
      "PRIVMSG ChanServ@services.dal.net :OP #makati bob",
    ]);
  });

  it("Libera ops via plain ChanServ", () => {
    const p = serviceProfile(srv("irc.libera.chat", "Libera.Chat"));
    expect(p.op("#test", "bob")).toEqual(["PRIVMSG ChanServ :OP #test bob"]);
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

  it("DALnet akick add maps to AKICK ... ADD", () => {
    const p = serviceProfile(srv("irc.dal.net"));
    expect(p.akickAdd("#makati", "*!*@spam.com")).toEqual([
      "PRIVMSG ChanServ@services.dal.net :AKICK #makati ADD *!*@spam.com",
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
});
