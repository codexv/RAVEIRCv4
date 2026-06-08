import { describe, it, expect } from "vitest";
import { HashStore } from "./hash";

describe("HashStore", () => {
  it("/hadd then $hget(table, item) returns the data", () => {
    const h = new HashStore();
    expect(h.command("hadd", "greetings bob Hello there bob")).toBe(true);
    expect(h.ident("hget", ["greetings", "bob"])).toBe("Hello there bob");
    expect(h.ident("hget", ["greetings", "nope"])).toBe("");
  });

  it("auto-creates the table and ignores -m flags", () => {
    const h = new HashStore();
    h.command("hadd", "-m50 t k v");
    expect(h.ident("hget", ["t", "k"])).toBe("v");
  });

  it("indexed access: $hget(table, N).item / .data and .size", () => {
    const h = new HashStore();
    h.command("hadd", "t a 1");
    h.command("hadd", "t b 2");
    expect(h.ident("hget", ["t", "1"], "item")).toBe("a");
    expect(h.ident("hget", ["t", "2"], "data")).toBe("2");
    expect(h.ident("hget", ["t"], "size")).toBe("2");
  });

  it("/hdel removes an item; /hfree drops the table", () => {
    const h = new HashStore();
    h.command("hadd", "t a 1");
    h.command("hadd", "t b 2");
    h.command("hdel", "t a");
    expect(h.ident("hget", ["t", "a"])).toBe("");
    expect(h.ident("hget", ["t"], "size")).toBe("1");
    h.command("hfree", "t");
    expect(h.ident("hget", ["t"], "size")).toBe("0");
  });

  it("/hinc and /hdec adjust numeric data", () => {
    const h = new HashStore();
    h.command("hadd", "t n 5");
    h.command("hinc", "t n 3");
    expect(h.ident("hget", ["t", "n"])).toBe("8");
    h.command("hdec", "t n");
    expect(h.ident("hget", ["t", "n"])).toBe("7");
  });

  it("$hfind matches item names (wildcard), N and count", () => {
    const h = new HashStore();
    h.command("hadd", "t apple 1");
    h.command("hadd", "t apricot 2");
    h.command("hadd", "t banana 3");
    expect(h.ident("hfind", ["t", "ap*", "1"])).toBe("apple");
    expect(h.ident("hfind", ["t", "ap*", "2"])).toBe("apricot");
    expect(h.ident("hfind", ["t", "ap*", "0"])).toBe("2"); // count
  });

  it("returns null for non-hash identifiers/commands", () => {
    const h = new HashStore();
    expect(h.ident("network", [])).toBeNull();
    expect(h.command("msg", "x")).toBe(false);
  });
});
