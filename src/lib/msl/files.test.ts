import { describe, it, expect } from "vitest";
import { FileStore } from "./files";

describe("FileStore", () => {
  it("/write appends lines; $read(file, N) reads the Nth; $lines counts", () => {
    const f = new FileStore();
    f.command("write", "notes.txt first line");
    f.command("write", "notes.txt second line");
    expect(f.ident("read", ["notes.txt", "1"])).toBe("first line");
    expect(f.ident("read", ["notes.txt", "2"])).toBe("second line");
    expect(f.ident("lines", ["notes.txt"])).toBe("2");
    expect(f.ident("read", ["notes.txt", "0"])).toBe("2"); // $read(file,0) = line count
  });

  it("/write -c clears, -l overwrites a line, -d deletes a line", () => {
    const f = new FileStore();
    f.command("write", "f.txt a");
    f.command("write", "f.txt b");
    f.command("write", "f.txt c");
    f.command("write", "-l2 f.txt B");
    expect(f.ident("read", ["f.txt", "2"])).toBe("B");
    f.command("write", "-d1 f.txt");
    expect(f.ident("read", ["f.txt", "1"])).toBe("B");
    f.command("write", "-c f.txt fresh");
    expect(f.ident("lines", ["f.txt"])).toBe("1");
    expect(f.ident("read", ["f.txt", "1"])).toBe("fresh");
  });

  it("path prefixes collapse to a basename (sandbox)", () => {
    const f = new FileStore();
    f.command("write", "data.txt hi");
    // $scriptdir is "" in the engine, so a script writes "scriptdir+name" → basename
    expect(f.ident("read", ["C:\\mirc\\data.txt", "1"])).toBe("hi");
    expect(f.ident("read", ["/home/u/data.txt", "1"])).toBe("hi");
  });

  it("$isfile reflects existence", () => {
    const f = new FileStore();
    expect(f.ident("isfile", ["x.txt"])).toBe("$false");
    f.command("write", "x.txt y");
    expect(f.ident("isfile", ["x.txt"])).toBe("$true");
    f.command("remove", "x.txt");
    expect(f.ident("isfile", ["x.txt"])).toBe("$false");
  });

  it("/writeini + $readini round-trip, including update in place", () => {
    const f = new FileStore();
    f.command("writeini", "c.ini Settings nick Rave");
    f.command("writeini", "c.ini Settings mode +i");
    expect(f.ident("readini", ["c.ini", "Settings", "nick"])).toBe("Rave");
    expect(f.ident("readini", ["c.ini", "Settings", "mode"])).toBe("+i");
    f.command("writeini", "c.ini Settings nick Acronix");
    expect(f.ident("readini", ["c.ini", "Settings", "nick"])).toBe("Acronix");
    expect(f.ident("readini", ["c.ini", "Settings", "missing"])).toBe("");
  });

  it("$read(file, w, wildcard) searches lines", () => {
    const f = new FileStore();
    f.command("write", "list.txt apple");
    f.command("write", "list.txt banana");
    expect(f.ident("read", ["list.txt", "w", "ban*"])).toBe("banana");
  });

  it("returns null for non-file identifiers/commands", () => {
    const f = new FileStore();
    expect(f.ident("network", [])).toBeNull();
    expect(f.command("msg", "x")).toBe(false);
  });
});
