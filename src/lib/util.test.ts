import { describe, it, expect } from "vitest";
import { acronym, encryptText, decryptText, ENC_MARKER, dedupeById } from "./util";

describe("dedupeById", () => {
  let n = 0;
  const mint = () => "minted" + n++;
  it("keeps the first of each duplicate id", () => {
    const out = dedupeById([{ id: "a", v: 1 }, { id: "a", v: 2 }, { id: "b", v: 3 }], mint);
    expect(out.map((x) => x.v)).toEqual([1, 2, 3]); // all kept, but...
    expect(out.map((x) => x.id)).not.toEqual(["a", "a", "b"]); // ...the dup got a fresh id
    expect(new Set(out.map((x) => x.id)).size).toBe(3); // ids are now unique
  });
  it("mints ids for blank ones", () => {
    const out = dedupeById([{ id: "" }, { id: "" }], mint);
    expect(new Set(out.map((x) => x.id)).size).toBe(2);
    expect(out.every((x) => x.id)).toBe(true);
  });
  it("leaves an already-unique list untouched", () => {
    const list = [{ id: "x" }, { id: "y" }];
    expect(dedupeById(list, mint)).toEqual(list);
  });
});

describe("acronym", () => {
  it("expands known acronyms (case/punctuation-insensitive)", () => {
    expect(acronym("brb")).toBe("be right back");
    expect(acronym("BRB!")).toBe("be right back");
  });
  it("returns null for unknown", () => {
    expect(acronym("zzzznope")).toBeNull();
  });
});

describe("encryption", () => {
  it("round-trips a message with the same passphrase", async () => {
    const blob = await encryptText("hunter2", "secret meeting at 9");
    expect(blob.startsWith(ENC_MARKER)).toBe(true);
    expect(blob).not.toContain("secret meeting");
    const out = await decryptText("hunter2", blob);
    expect(out).toBe("secret meeting at 9");
  });

  it("fails to decrypt with the wrong key", async () => {
    const blob = await encryptText("right", "top secret");
    expect(await decryptText("wrong", blob)).toBeNull();
  });

  it("ignores non-encrypted payloads", async () => {
    expect(await decryptText("k", "just plain text")).toBeNull();
  });
});
