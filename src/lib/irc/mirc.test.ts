import { describe, it, expect } from "vitest";
import { renderMirc, stripMirc } from "./mirc";

describe("renderMirc", () => {
  it("escapes HTML to prevent injection", () => {
    const html = renderMirc("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders bold as font-weight", () => {
    const html = renderMirc("\x02bold\x02 normal");
    expect(html).toContain("font-weight:bold");
  });

  it("renders a foreground colour", () => {
    const html = renderMirc("\x034red text");
    expect(html.toLowerCase()).toContain("color:#ff0000");
  });

  it("renders foreground and background colours", () => {
    const html = renderMirc("\x034,1text");
    expect(html.toLowerCase()).toContain("color:#ff0000");
    expect(html.toLowerCase()).toContain("background-color:#000000");
  });

  it("resets formatting on reset code", () => {
    const html = renderMirc("\x02bold\x0fplain");
    expect(html).toContain("plain");
  });
});

describe("stripMirc", () => {
  it("removes colour codes", () => {
    expect(stripMirc("\x034,1hello\x03 world")).toBe("hello world");
  });

  it("removes formatting codes", () => {
    expect(stripMirc("\x02bo\x1dld\x1f!\x0f")).toBe("bold!");
  });

  it("leaves plain text unchanged", () => {
    expect(stripMirc("just text")).toBe("just text");
  });
});
