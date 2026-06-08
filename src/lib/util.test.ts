import { describe, it, expect } from "vitest";
import { acronym, encryptText, decryptText, ENC_MARKER } from "./util";

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
