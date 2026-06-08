import { describe, it, expect } from "vitest";
import { parseInput } from "./commands";

const ctx = (over = {}) => ({ connected: true, target: "#chan", ...over });

describe("parseInput", () => {
  it("treats plain text as a message to the active target", () => {
    expect(parseInput("hello there", ctx())).toEqual({
      type: "message",
      target: "#chan",
      text: "hello there",
    });
  });

  // `//` is mIRC-style evaluate-then-run, handled in the store before parseInput,
  // so it's covered by the store tests rather than here.

  it("parses /join", () => {
    expect(parseInput("/join #makati", ctx())).toEqual({
      type: "raw",
      lines: ["JOIN #makati"],
    });
  });

  it("parses /me into an action", () => {
    expect(parseInput("/me waves", ctx())).toEqual({
      type: "action",
      target: "#chan",
      text: "waves",
    });
  });

  it("parses /msg with explicit target", () => {
    expect(parseInput("/msg bob hi there", ctx())).toEqual({
      type: "message",
      target: "bob",
      text: "hi there",
    });
  });

  it("parses /part with default channel", () => {
    expect(parseInput("/part later", ctx())).toEqual({
      type: "raw",
      lines: ["PART later"],
    });
  });

  it("parses /nick", () => {
    expect(parseInput("/nick newnick", ctx())).toEqual({
      type: "raw",
      lines: ["NICK newnick"],
    });
  });

  it("blocks sending when not connected", () => {
    const r = parseInput("hello", ctx({ connected: false }));
    expect(r.type).toBe("error");
  });

  it("errors on plain text with no target", () => {
    const r = parseInput("hello", ctx({ target: undefined }));
    expect(r.type).toBe("error");
  });

  it("routes unknown slash commands to raw", () => {
    expect(parseInput("/whowas bob", ctx())).toEqual({
      type: "raw",
      lines: ["WHOWAS bob"],
    });
  });

  it("returns client actions for /clear and /query", () => {
    expect(parseInput("/clear", ctx())).toEqual({ type: "client", action: "clear" });
    expect(parseInput("/query bob", ctx())).toEqual({
      type: "client",
      action: "query",
      arg: "bob",
    });
  });
});
