import { describe, it, expect } from "vitest";
import { parseTimerSpec, TimerManager, type TimerScheduler } from "./timers";

/** A manual clock: each tickAll() invokes every live interval once. */
function fakeClock() {
  let nextId = 1;
  const intervals = new Map<number, () => void>();
  const sched: TimerScheduler = {
    setInterval: (fn) => {
      const id = nextId++;
      intervals.set(id, fn);
      return id;
    },
    clearInterval: (h) => {
      intervals.delete(h as number);
    },
  };
  return {
    sched,
    count: () => intervals.size,
    tickAll: (times = 1) => {
      for (let i = 0; i < times; i++) {
        for (const fn of [...intervals.values()]) fn();
      }
    },
  };
}

const CTX = { serverId: 0, bufferName: "#chan" };

describe("parseTimerSpec", () => {
  it("parses reps, interval (seconds), and command", () => {
    const s = parseTimerSpec("3 5 /msg #chan hi there");
    expect(s).toEqual({ intervalMs: 5000, reps: 3, command: "/msg #chan hi there", online: false });
  });

  it("treats 0 reps as unlimited and keeps the rest of the command intact", () => {
    const s = parseTimerSpec("0 10 /amsg back");
    expect(s).toMatchObject({ reps: 0, intervalMs: 10000, command: "/amsg back" });
  });

  it("honors -m (milliseconds) and -o (online only)", () => {
    expect(parseTimerSpec("-m 1 500 /x")).toMatchObject({ intervalMs: 500, online: false });
    expect(parseTimerSpec("-o 1 2 /x")).toMatchObject({ intervalMs: 2000, online: true });
    expect(parseTimerSpec("-mo 1 250 /x")).toMatchObject({ intervalMs: 250, online: true });
  });

  it("floors absurdly small intervals", () => {
    expect(parseTimerSpec("-m 0 1 /x")).toMatchObject({ intervalMs: 10 });
  });

  it("returns an error on malformed input", () => {
    expect(parseTimerSpec("nope")).toHaveProperty("error");
    expect(parseTimerSpec("5")).toHaveProperty("error");
  });
});

describe("TimerManager", () => {
  it("fires after each interval and stops after the requested reps", () => {
    const clock = fakeClock();
    const fired: string[] = [];
    const tm = new TimerManager({ fire: (c) => fired.push(c), scheduler: clock.sched });

    tm.start({ name: "1", reps: 3, intervalMs: 1000, command: "/x", ctx: CTX });
    clock.tickAll(3);
    expect(fired).toEqual(["/x", "/x", "/x"]);
    expect(tm.get("1")).toBeUndefined(); // auto-removed after last rep
    expect(clock.count()).toBe(0);

    clock.tickAll(2); // no more firing once exhausted
    expect(fired).toHaveLength(3);
  });

  it("runs forever when reps is 0", () => {
    const clock = fakeClock();
    let n = 0;
    const tm = new TimerManager({ fire: () => n++, scheduler: clock.sched });
    tm.start({ name: "1", reps: 0, intervalMs: 1000, command: "/x", ctx: CTX });
    clock.tickAll(50);
    expect(n).toBe(50);
    expect(tm.get("1")?.repsLeft).toBe(Infinity);
  });

  it("auto-assigns a name for anonymous timers", () => {
    const tm = new TimerManager({ fire: () => {}, scheduler: fakeClock().sched });
    const a = tm.start({ reps: 1, intervalMs: 1000, command: "/x", ctx: CTX });
    const b = tm.start({ reps: 1, intervalMs: 1000, command: "/y", ctx: CTX });
    expect(a).not.toBe(b);
  });

  it("replaces a timer that reuses an existing name", () => {
    const clock = fakeClock();
    const fired: string[] = [];
    const tm = new TimerManager({ fire: (c) => fired.push(c), scheduler: clock.sched });
    tm.start({ name: "1", reps: 0, intervalMs: 1000, command: "/old", ctx: CTX });
    tm.start({ name: "1", reps: 0, intervalMs: 1000, command: "/new", ctx: CTX });
    expect(clock.count()).toBe(1); // old interval cleared
    clock.tickAll(1);
    expect(fired).toEqual(["/new"]);
  });

  it("stops a single timer and all timers", () => {
    const clock = fakeClock();
    const tm = new TimerManager({ fire: () => {}, scheduler: clock.sched });
    tm.start({ name: "a", reps: 0, intervalMs: 1000, command: "/x", ctx: CTX });
    tm.start({ name: "b", reps: 0, intervalMs: 1000, command: "/y", ctx: CTX });
    expect(tm.stop("a")).toBe(true);
    expect(tm.stop("missing")).toBe(false);
    expect(tm.list()).toHaveLength(1);
    expect(tm.stopAll()).toBe(1);
    expect(clock.count()).toBe(0);
  });

  it("scopes stopAll to a server when given an id", () => {
    const tm = new TimerManager({ fire: () => {}, scheduler: fakeClock().sched });
    tm.start({ name: "a", reps: 0, intervalMs: 1000, command: "/x", ctx: { serverId: 0, bufferName: "#a" } });
    tm.start({ name: "b", reps: 0, intervalMs: 1000, command: "/y", ctx: { serverId: 1, bufferName: "#b" } });
    expect(tm.stopAll(0)).toBe(1);
    expect(tm.list().map((t) => t.name)).toEqual(["b"]);
  });

  it("skips ticks while offline for -o timers without consuming reps", () => {
    const clock = fakeClock();
    let online = false;
    const fired: string[] = [];
    const tm = new TimerManager({
      fire: (c) => fired.push(c),
      scheduler: clock.sched,
      isOnline: () => online,
    });
    tm.start({ name: "1", reps: 2, intervalMs: 1000, command: "/x", ctx: CTX, online: true });
    clock.tickAll(3); // offline → nothing fires, reps untouched
    expect(fired).toHaveLength(0);
    expect(tm.get("1")?.repsLeft).toBe(2);
    online = true;
    clock.tickAll(2);
    expect(fired).toEqual(["/x", "/x"]);
    expect(tm.get("1")).toBeUndefined();
  });
});
