import { describe, it, expect } from "vitest";
import {
  advertHit,
  badwordHit,
  capsHit,
  lengthHit,
  trickHit,
  isCloneViolation,
  offensiveNickHit,
  isExempt,
  maskToRegex,
  FloodTracker,
  RepeatTracker,
} from "./protections";
import type { AntiSpamConfig, BadwordConfig, CapsConfig, CloneConfig, LengthConfig } from "./rave";

describe("maskToRegex", () => {
  it("matches wildcard hostmasks", () => {
    expect(maskToRegex("*!*@1.2.3.4").test("bob!u@1.2.3.4")).toBe(true);
    expect(maskToRegex("*!*@1.2.3.4").test("bob!u@5.6.7.8")).toBe(false);
    expect(maskToRegex("bob*").test("bobby")).toBe(true);
  });
});

describe("isExempt", () => {
  const friends = ["trustednick", "*!*@safe.host"];
  it("exempts a bare nick (case-insensitive)", () => {
    expect(isExempt("TrustedNick", "TrustedNick!u@h", friends)).toBe(true);
  });
  it("exempts by hostmask", () => {
    expect(isExempt("anyone", "anyone!u@safe.host", friends)).toBe(true);
  });
  it("does not exempt a stranger", () => {
    expect(isExempt("stranger", "stranger!u@bad.host", friends)).toBe(false);
  });
});

describe("offensiveNickHit", () => {
  const words = ["4hire", "spammer"];
  it("matches a trigger as a substring of the nick", () => {
    expect(offensiveNickHit("girl4hire", "user", words)).toBe("4hire");
  });
  it("matches a trigger in the ident, not just the nick", () => {
    expect(offensiveNickHit("alice", "spammerbot", words)).toBe("spammer");
  });
  it("returns null for a clean user", () => {
    expect(offensiveNickHit("alice", "user", words)).toBeNull();
  });
  it("returns null when no trigger words configured", () => {
    expect(offensiveNickHit("girl4hire", "user", [])).toBeNull();
  });
});

describe("badwordHit", () => {
  const cfg: BadwordConfig = { enabled: true, words: ["badword", "spam"], ban: false, reason: "x" };
  it("detects a configured word", () => {
    expect(badwordHit("you are a badword here", cfg)).toBe("badword");
  });
  it("ignores when disabled", () => {
    expect(badwordHit("badword", { ...cfg, enabled: false })).toBeNull();
  });
  it("is whole-word (no false positive on substrings)", () => {
    expect(badwordHit("scampi for dinner", cfg)).toBeNull();
  });
  it("strips mIRC colour codes before matching", () => {
    expect(badwordHit("\x034badword\x03", cfg)).toBe("badword");
  });
});

describe("advertHit", () => {
  const cfg: AntiSpamConfig = {
    enabled: true,
    blockAdverts: true,
    repeatLimit: 3,
    ban: false,
    reason: "x",
  };
  it("flags http URLs", () => {
    expect(advertHit("check http://evil.example/win", cfg)).toBe(true);
  });
  it("flags www. domains", () => {
    expect(advertHit("go to www.evil.example now", cfg)).toBe(true);
  });
  it("flags channel-join adverts (hotlink to another channel)", () => {
    expect(advertHit("join #freestuff for prizes", cfg)).toBe(true);
    expect(advertHit("join #other now", cfg, "#makati")).toBe(true);
  });
  it("intelligent kick: does NOT flag a join invite to the current channel", () => {
    expect(advertHit("everyone join #makati !", cfg, "#makati")).toBe(false);
    expect(advertHit("join #makati", cfg, "#makati")).toBe(false);
    // a real URL is still an advert regardless of channel
    expect(advertHit("join #makati http://spam.example/x", cfg, "#makati")).toBe(true);
  });
  it("ignores normal chat", () => {
    expect(advertHit("hello how are you", cfg)).toBe(false);
  });
  it("respects the blockAdverts toggle", () => {
    expect(advertHit("http://x.y/z", { ...cfg, blockAdverts: false })).toBe(false);
  });
});

describe("capsHit", () => {
  const cfg: CapsConfig = { enabled: true, percent: 70, minLength: 10, ban: false, reason: "x" };
  it("flags a SHOUTING line", () => {
    expect(capsHit("THIS IS ALL CAPS SHOUTING", cfg)).toBe(true);
  });
  it("ignores normal-case text", () => {
    expect(capsHit("this is a normal sentence", cfg)).toBe(false);
  });
  it("ignores short shouts under min length", () => {
    expect(capsHit("HI!", cfg)).toBe(false);
  });
  it("respects the enabled flag", () => {
    expect(capsHit("LOUD NOISES EVERYWHERE", { ...cfg, enabled: false })).toBe(false);
  });
});

describe("lengthHit", () => {
  const cfg: LengthConfig = { enabled: true, max: 20, ban: false, reason: "x" };
  it("flags an over-long line", () => {
    expect(lengthHit("a".repeat(25), cfg)).toBe(true);
  });
  it("passes a short line", () => {
    expect(lengthHit("short", cfg)).toBe(false);
  });
});

describe("trickHit", () => {
  it("flags mIRC identifier injection", () => {
    expect(trickHit("$decode(aGVsbG8=,m)")).toBe(true);
  });
  it("flags decode-worm base64 blobs", () => {
    expect(trickHit("please decode " + "A".repeat(60))).toBe(true);
  });
  it("ignores normal chat", () => {
    expect(trickHit("hey, how much does it cost? $20")).toBe(false);
  });
});

describe("isCloneViolation", () => {
  const cfg: CloneConfig = { enabled: true, limit: 3, ban: false, reason: "x" };
  it("triggers above the limit", () => {
    expect(isCloneViolation(4, cfg)).toBe(true);
    expect(isCloneViolation(3, cfg)).toBe(false);
  });
  it("never triggers when disabled", () => {
    expect(isCloneViolation(10, { ...cfg, enabled: false })).toBe(false);
  });
});

describe("FloodTracker", () => {
  it("triggers at the limit within the window", () => {
    const f = new FloodTracker();
    let t = 1000;
    expect(f.record("k", t, 3, 5)).toBe(false);
    expect(f.record("k", (t += 100), 3, 5)).toBe(false);
    expect(f.record("k", (t += 100), 3, 5)).toBe(true);
  });
  it("forgets events outside the window", () => {
    const f = new FloodTracker();
    expect(f.record("k", 0, 3, 5)).toBe(false);
    expect(f.record("k", 1000, 3, 5)).toBe(false);
    // 10s later: previous two are outside the 5s window
    expect(f.record("k", 11000, 3, 5)).toBe(false);
  });
});

describe("RepeatTracker", () => {
  it("triggers on repeated identical messages", () => {
    const r = new RepeatTracker();
    expect(r.record("k", "spam", 3)).toBe(false);
    expect(r.record("k", "spam", 3)).toBe(false);
    expect(r.record("k", "spam", 3)).toBe(true);
  });
  it("resets the count when the message changes", () => {
    const r = new RepeatTracker();
    r.record("k", "a", 3);
    r.record("k", "a", 3);
    expect(r.record("k", "b", 3)).toBe(false);
  });
});
