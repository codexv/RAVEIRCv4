import { describe, it, expect } from "vitest";
import { TOPIC_FRAMES, getFrame, applyFrame } from "./topicFrames";

describe("topic frames", () => {
  it("every frame has a unique id and a {} text slot", () => {
    const ids = new Set<string>();
    for (const f of TOPIC_FRAMES) {
      expect(f.template).toContain("{}");
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
    }
  });

  it("applyFrame substitutes the text into the slot", () => {
    expect(applyFrame(getFrame("d2")!, "Makati")).toBe("©º°¨¨°º© Makati ©º°¨¨°º©");
  });

  it("getFrame is case-insensitive and returns undefined for unknown ids", () => {
    expect(getFrame("D2")?.id).toBe("d2");
    expect(getFrame("nope")).toBeUndefined();
  });

  it("colour frames embed the mIRC colour control byte", () => {
    expect(applyFrame(getFrame("c1")!, "x")).toContain("\x03");
  });
});
