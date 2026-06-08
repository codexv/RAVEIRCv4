import { describe, it, expect } from "vitest";
import { evalString, emptyCtx, wildMatch } from "./eval";

const ctx = (over = {}) =>
  emptyCtx({ me: "rave", nick: "bob", chan: "#makati", params: ["hello", "world", "foo"], ...over });

describe("evalString", () => {
  it("evaluates basic identifiers", () => {
    expect(evalString("$me", ctx())).toBe("rave");
    expect(evalString("$nick on $chan", ctx())).toBe("bob on #makati");
  });

  it("resolves params $1, $2-, $0", () => {
    expect(evalString("$1", ctx())).toBe("hello");
    expect(evalString("$2-", ctx())).toBe("world foo");
    expect(evalString("$0", ctx())).toBe("3");
  });

  it("formats $asctime with mIRC tokens (TZ-independent)", () => {
    const sec = 1717804800; // some fixed unix time
    const out = evalString(`$asctime(${sec},dddd mmmm doo yyyy)`, ctx());
    const d = new Date(sec * 1000);
    expect(out).toContain(String(d.getFullYear()));
    expect(out).not.toContain("yyyy");
    expect(out).not.toContain("dddd");
    expect(evalString("$asctime(0,yyyy)", ctx())).toBe("");
  });

  it("substitutes %variables", () => {
    const c = ctx();
    c.vars.set("greeting", "hi there");
    expect(evalString("%greeting", c)).toBe("hi there");
  });

  it("applies $+ concatenation", () => {
    expect(evalString("foo $+ bar", ctx())).toBe("foobar");
    expect(evalString("$me $+ !", ctx())).toBe("rave!");
  });

  it("evaluates string functions", () => {
    expect(evalString("$upper(hi)", ctx())).toBe("HI");
    expect(evalString("$len(hello)", ctx())).toBe("5");
    expect(evalString("$left(hello,3)", ctx())).toBe("hel");
  });

  it("evaluates token functions", () => {
    expect(evalString("$gettok(a.b.c,2,46)", ctx())).toBe("b");
    expect(evalString("$numtok(a b c,32)", ctx())).toBe("3");
    expect(evalString("$istok(a b c,b,32)", ctx())).toBe("$true");
  });

  it("evaluates $iif and $calc", () => {
    expect(evalString("$iif($true,yes,no)", ctx())).toBe("yes");
    expect(evalString("$calc(2 + 3 * 4)", ctx())).toBe("14");
  });

  it("handles nested identifiers", () => {
    expect(evalString("$upper($gettok(a b c,1,32))", ctx())).toBe("A");
  });

  it("evaluates the extended identifier set", () => {
    expect(evalString("$count(banana,a)", ctx())).toBe("3");
    expect(evalString("$str(ab,3)", ctx())).toBe("ababab");
    expect(evalString("$reverse(abc)", ctx())).toBe("cba");
    expect(evalString("$abs(-7)", ctx())).toBe("7");
    expect(evalString("$round(3.14159,2)", ctx())).toBe("3.14");
    expect(evalString("$max(3,9)", ctx())).toBe("9");
    expect(evalString("$puttok(a.b.c,X,2,46)", ctx())).toBe("a.X.c");
    expect(evalString("$deltok(a.b.c,2,46)", ctx())).toBe("a.c");
    expect(evalString("$sorttok(c a b,32)", ctx())).toBe("a b c");
    expect(evalString("$base(255,10,16)", ctx())).toBe("ff");
  });
});

describe("wildMatch", () => {
  it("matches mIRC wildcards", () => {
    expect(wildMatch("*!*@host", "bob!u@host")).toBe(true);
    expect(wildMatch("h?llo", "hello")).toBe(true);
    expect(wildMatch("bye*", "hello")).toBe(false);
  });
});
