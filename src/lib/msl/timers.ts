// mIRC-style /timer support.
//
// Schedules a command to run after an interval, a given number of times
// (0 = forever), in the context of the window it was created in. The actual
// firing + identifier evaluation lives in the store; this module only owns
// scheduling, repetition counting, and lifecycle so it stays pure/testable.

/** The window a timer was created in — used to resolve $chan/$me at fire time. */
export interface TimerCtx {
  serverId: number;
  bufferName: string;
}

/** Pluggable clock so tests can drive ticks without real time. */
export interface TimerScheduler {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface ActiveTimer {
  name: string;
  /** Original repetitions requested (0 = unlimited). */
  reps: number;
  /** Remaining repetitions (Infinity = unlimited). */
  repsLeft: number;
  intervalMs: number;
  command: string;
  ctx: TimerCtx;
  /** -o : only fire while the server is connected. */
  online: boolean;
  handle: unknown;
}

export interface TimerSpec {
  intervalMs: number;
  reps: number;
  command: string;
  online: boolean;
}

const MIN_INTERVAL_MS = 10;

/**
 * Parse the argument portion of a `/timer` command (everything after the
 * `timer[name]` word): `[-mo] <reps> <interval> <command>`.
 *  - `-m` interval is in milliseconds (default seconds)
 *  - `-o` only fire while connected
 */
export function parseTimerSpec(rest: string): TimerSpec | { error: string } {
  let s = rest.trim();
  let ms = false;
  let online = false;

  while (s.startsWith("-")) {
    const sp = s.indexOf(" ");
    const flag = sp === -1 ? s : s.slice(0, sp);
    if (!/^-[mo]+$/.test(flag)) break;
    if (flag.includes("m")) ms = true;
    if (flag.includes("o")) online = true;
    s = sp === -1 ? "" : s.slice(sp + 1).trim();
  }

  const m = /^(\d+)\s+(\d+)\s+([\s\S]+)$/.exec(s);
  if (!m) return { error: "Usage: /timer[name] [-mo] <reps> <interval> <command>" };

  const reps = parseInt(m[1], 10);
  const interval = parseInt(m[2], 10);
  const command = m[3];
  const intervalMs = Math.max(ms ? interval : interval * 1000, MIN_INTERVAL_MS);
  return { intervalMs, reps, command, online };
}

export interface TimerManagerOptions {
  /** Run a timer's command in its captured context. */
  fire: (command: string, ctx: TimerCtx) => void;
  /** Clock; defaults to the global setInterval/clearInterval. */
  scheduler?: TimerScheduler;
  /** Whether a context's server is currently connected (for -o timers). */
  isOnline?: (ctx: TimerCtx) => boolean;
}

export class TimerManager {
  private timers = new Map<string, ActiveTimer>();
  private seq = 0;
  private fire: (command: string, ctx: TimerCtx) => void;
  private scheduler: TimerScheduler;
  private isOnline: (ctx: TimerCtx) => boolean;

  constructor(opts: TimerManagerOptions) {
    this.fire = opts.fire;
    this.scheduler = opts.scheduler ?? {
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    };
    this.isOnline = opts.isOnline ?? (() => true);
  }

  /** Start (or replace) a timer. Returns the resolved name. */
  start(opts: {
    name?: string;
    reps: number;
    intervalMs: number;
    command: string;
    ctx: TimerCtx;
    online?: boolean;
  }): string {
    const name = opts.name && opts.name.length ? opts.name : String(++this.seq);
    this.stop(name); // reusing a name replaces the existing timer (mIRC behavior)

    const timer: ActiveTimer = {
      name,
      reps: opts.reps,
      repsLeft: opts.reps === 0 ? Infinity : opts.reps,
      intervalMs: opts.intervalMs,
      command: opts.command,
      ctx: opts.ctx,
      online: !!opts.online,
      handle: null,
    };
    timer.handle = this.scheduler.setInterval(() => this.tick(name), opts.intervalMs);
    this.timers.set(name, timer);
    return name;
  }

  private tick(name: string) {
    const t = this.timers.get(name);
    if (!t) return;
    // -o timers skip ticks (without consuming a rep) while disconnected.
    if (t.online && !this.isOnline(t.ctx)) return;

    this.fire(t.command, t.ctx);

    if (t.repsLeft !== Infinity) {
      t.repsLeft--;
      if (t.repsLeft <= 0) this.stop(name);
    }
  }

  /** Stop a single timer by name. Returns true if it existed. */
  stop(name: string): boolean {
    const t = this.timers.get(name);
    if (!t) return false;
    if (t.handle != null) this.scheduler.clearInterval(t.handle);
    this.timers.delete(name);
    return true;
  }

  /** Stop every timer (optionally only those on a given server). Returns count stopped. */
  stopAll(serverId?: number): number {
    let n = 0;
    for (const name of [...this.timers.keys()]) {
      if (serverId !== undefined && this.timers.get(name)!.ctx.serverId !== serverId) continue;
      if (this.stop(name)) n++;
    }
    return n;
  }

  get(name: string): ActiveTimer | undefined {
    return this.timers.get(name);
  }

  list(): ActiveTimer[] {
    return [...this.timers.values()];
  }
}
