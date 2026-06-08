import { describe, it, expect } from "vitest";
import { parseDialogs, instantiate, applyDid, didIdent } from "./dialogs";

const SRC = `
dialog mydlg {
  title "My Dialog"
  size -1 -1 200 150
  text "Name:", 1, 10 10 40 10
  edit "", 2, 55 10 130 10
  button "OK", 3, 10 130 50 14, ok
  list 4, 10 30 180 90
  check "Enable", 5, 10 125 80 10
}
`;

describe("parseDialogs", () => {
  it("parses title, size, and controls with ids/positions", () => {
    const defs = parseDialogs(SRC);
    const d = defs.get("mydlg")!;
    expect(d.title).toBe("My Dialog");
    expect(d.w).toBe(200);
    expect(d.h).toBe(150);
    expect(d.controls).toHaveLength(5);
    const edit = d.controls.find((c) => c.id === 2)!;
    expect(edit.type).toBe("edit");
    expect([edit.x, edit.y, edit.w, edit.h]).toEqual([55, 10, 130, 10]);
    const btn = d.controls.find((c) => c.id === 3)!;
    expect(btn.caption).toBe("OK");
    expect(btn.options).toBe("ok");
  });
});

describe("dialog control state", () => {
  const open = () => instantiate(parseDialogs(SRC).get("mydlg")!);

  it("/did -a adds list lines; $did .lines and .seltext work", () => {
    const d = open();
    applyDid(d, "a", 4, ["apple"]);
    applyDid(d, "a", 4, ["banana"]);
    expect(didIdent(d, 4, ["mydlg", "4"], "lines")).toBe("2");
    applyDid(d, "c", 4, ["2"]); // select line 2
    expect(didIdent(d, 4, ["mydlg", "4"], "sel")).toBe("2");
    expect(didIdent(d, 4, ["mydlg", "4"], "seltext")).toBe("banana");
    expect(didIdent(d, 4, ["mydlg", "4", "1"])).toBe("apple"); // $did(name,id,N)
  });

  it("/did -r clears, -o overwrites a line", () => {
    const d = open();
    applyDid(d, "a", 4, ["x"]);
    applyDid(d, "a", 4, ["y"]);
    applyDid(d, "o", 4, ["1", "first"]);
    expect(didIdent(d, 4, ["mydlg", "4", "1"])).toBe("first");
    applyDid(d, "r", 4, []);
    expect(didIdent(d, 4, ["mydlg", "4"], "lines")).toBe("0");
  });

  it("edit text via -a/-r and $did(name,id) returns it", () => {
    const d = open();
    applyDid(d, "ra", 2, ["hello"]);
    expect(didIdent(d, 2, ["mydlg", "2"])).toBe("hello");
  });

  it("check state via -c/-u and .state", () => {
    const d = open();
    applyDid(d, "c", 5, []);
    expect(didIdent(d, 5, ["mydlg", "5"], "state")).toBe("1");
    applyDid(d, "u", 5, []);
    expect(didIdent(d, 5, ["mydlg", "5"], "state")).toBe("0");
  });
});
