// Central reactive client state for RAVEIRC.
//
// Owns the list of servers and buffers, listens to engine events from Rust,
// translates them into buffer/nicklist updates, and exposes actions the UI calls.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";

import { parseInput, type CommandContext, type ServiceAction } from "./commands";
import { stripMirc } from "./mirc";
import { serviceProfile, detectNetwork } from "./network";
import { TOPIC_FRAMES, getFrame, applyFrame } from "./topicFrames";
import { appearance } from "../appearance.svelte";
import { acronym, beep, decryptText, encryptText, ENC_MARKER, uptime } from "../util";
import { MslEngine, type EventData } from "../msl/engine";
import type { MslHost } from "../msl/exec";
import { TimerManager, parseTimerSpec, type TimerCtx } from "../msl/timers";
import { HashStore } from "../msl/hash";
import { loadAutojoin } from "../channels";
import { loadProfiles, loadProfilePassword } from "../profiles";
import { loadBufferFonts, saveBufferFonts, type BufferFont } from "../fonts";
import { isTauri, isWeb } from "../platform";
import { subscribeIrc, connectServer, sendRaw, sendMessage, disconnectIrc } from "./transport";
import { FileStore } from "../msl/files";
import { SocketStore, type SockEvent } from "../msl/sockets";
import {
  parseDialogs,
  instantiate,
  applyDid,
  didIdent,
  type DialogDef,
  type OpenDialog,
} from "../msl/dialogs";
import {
  aiAnalyze,
  aiModerate,
  aiSummarize,
  channelKey,
  defaultRaveConfig,
  loadRaveConfig,
  saveRaveConfig,
  type ProtectionsConfig,
  type RaveConfig,
} from "./rave";
import {
  advertHit,
  badwordHit,
  capsHit,
  lengthHit,
  trickHit,
  isCloneViolation,
  offensiveNickHit,
  isExempt,
  maskToRegex,
  FloodTracker,
  RepeatTracker,
  type Action,
} from "./protections";
import type {
  Buffer,
  ChanUser,
  IrcEvent,
  IrcMessage,
  Line,
  LineKind,
  Server,
  ServerConfig,
} from "./types";

const MAX_LINES = 1000;
const DEFAULT_PREFIX_SYMBOLS = "~&@%+";
const DEFAULT_PREFIX_MODES = "qaohv";

let lineSeq = 0;

/** Human-readable interval for timer status lines. */
function fmtInterval(ms: number): string {
  return ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`;
}

export class IrcStore {
  servers = $state<Server[]>([]);
  buffers = $state<Buffer[]>([]);
  activeId = $state<string | null>(null);
  ready = $state(false);
  /** App version (from tauri.conf.json), shown in the UI / help. */
  appVersion = $state("");
  raveConfig = $state<RaveConfig>(defaultRaveConfig());
  scratchpadOpen = $state(false);
  scriptEditorOpen = $state(false);
  nickManagerOpen = $state(false);
  bugReportOpen = $state(false);
  aboutOpen = $state(false);
  channelManagerOpen = $state(false);
  /** /font picker dialog; fontTargetId is the buffer it applies to. */
  fontPickerOpen = $state(false);
  fontTargetId = $state<string | null>(null);
  /** Open script-defined dialogs (rendered by DialogHost). */
  dialogsOpen = $state<OpenDialog[]>([]);
  private dialogDefs = new Map<string, DialogDef>();
  /** $dname / $devent for the dialog event currently being handled. */
  private dlgCurrent = "";
  private dlgEvent = "";

  /** Session encryption passphrase (in-memory only). */
  private encKey = "";
  /** Per-window font overrides (/font), keyed by channelKey, persisted. */
  private bufferFonts: Record<string, BufferFont> = loadBufferFonts();
  /** mIRC-compatible scripting engine (aliases / on-events / variables). */
  private msl = new MslEngine();
  /** mIRC hash tables (/hadd, $hget, …), session-scoped. */
  private hash = new HashStore();
  /** mIRC file & INI I/O ($read, /write, …) — cached in memory, persisted to app-data. */
  private files = new FileStore({
    save: (name, content) => {
      invoke("script_data_save", { name, content }).catch(() => {});
    },
    remove: (name) => {
      invoke("script_data_remove", { name }).catch(() => {});
    },
  });
  /** mIRC sockets (/sockopen, $sock, on SOCK*) — Rust-backed TCP/TLS bridge. */
  private sockets = new SocketStore(
    {
      open: (name, host, port, tls) => {
        invoke("sock_open", { name, host, port, tls }).catch(() => {});
      },
      write: (name, data) => {
        invoke("sock_write", { name, data }).catch(() => {});
      },
      close: (name) => {
        invoke("sock_close", { name }).catch(() => {});
      },
    },
    (event, sockName) => {
      const sid = this.active?.serverId ?? this.servers[0]?.id ?? 0;
      this.msl.dispatch(
        event,
        this.mslData(sid, { chan: sockName, target: sockName }),
        this.mslHost(sid),
      );
    },
  );
  /** /timer scheduler — fires commands in the window they were created in. */
  private timers = new TimerManager({
    fire: (command, ctx) => this.fireTimer(command, ctx),
    isOnline: (ctx) => {
      const s = this.server(ctx.serverId);
      return s?.status === "registered" || s?.status === "connected";
    },
  });

  private unlisten: UnlistenFn | null = null;
  private flood = new FloodTracker();
  private repeat = new RepeatTracker();
  private ctcpFlood = new FloodTracker();
  private raidTracker = new FloodTracker();
  private pmRepeat = new RepeatTracker();
  private lockedChannels = new Set<string>();

  /** Start listening to engine events. Call once at app start. */
  async init() {
    if (this.unlisten) return;
    try {
      this.appVersion = await getVersion();
    } catch {
      // not in a Tauri context (e.g. tests)
    }
    this.unlisten = await subscribeIrc((ev) => this.onEvent(ev));
    // mSL raw sockets ($sock) are a desktop-only (Rust) feature.
    if (isTauri()) {
      await listen<SockEvent>("socket-event", (e) => this.sockets.onEvent(e.payload));
    }
    try {
      const cfg = await loadRaveConfig();
      if (cfg) this.raveConfig = cfg;
    } catch {
      // keep defaults if the backend isn't reachable (e.g. in tests)
    }
    const sc = this.raveConfig.scripts;
    this.msl.load(sc.aliases, sc.remote, sc.variables);
    this.dialogDefs = parseDialogs(sc.remote);
    // Preload persisted script-data files into the mSL FileStore cache.
    try {
      const data = await invoke<[string, string][]>("script_data_load");
      this.files.preload(data);
    } catch {
      // no persisted files / backend unavailable
    }
    this.ready = true;
  }

  /** Apply a new config (called by the Settings panel after saving). */
  applyConfig(config: RaveConfig) {
    this.raveConfig = config;
    this.msl.load(config.scripts.aliases, config.scripts.remote, config.scripts.variables);
    this.dialogDefs = parseDialogs(config.scripts.remote);
  }

  /** Join a channel on a specific server (Channel Manager). */
  joinChannel(serverId: number, channel: string, key?: string) {
    let chan = channel.trim();
    if (!chan) return;
    if (!/^[#&!+]/.test(chan)) chan = "#" + chan;
    this.raw(serverId, `JOIN ${chan}${key ? ` ${key}` : ""}`);
  }

  /** An mSL host bound to a server (raw send + echo to a window). */
  private mslHost(serverId: number): MslHost {
    return {
      sendRaw: (line) => this.raw(serverId, line),
      echo: (text) => {
        const b = this.active ?? this.ensureBuffer(serverId, "(server)", "server");
        this.add(b, "echo", text);
      },
      ident: (name, args, prop) => this.mslIdent(serverId, name, args, prop),
      command: (name, rest, ctx) =>
        this.hash.command(name, rest) ||
        this.files.command(name, rest) ||
        this.mslCommand(serverId, name, rest) ||
        this.sockets.command(name, rest, ctx),
    };
  }

  /** Host-backed mSL commands that need live client state (channel list, …). */
  private mslCommand(serverId: number, name: string, rest: string): boolean {
    const chans = () => this.buffers.filter((b) => b.serverId === serverId && b.kind === "channel");
    switch (name) {
      case "amsg":
        for (const b of chans()) {
          this.raw(serverId, `PRIVMSG ${b.name} :${rest}`);
          this.add(b, "self", rest, this.ownNick(serverId));
        }
        return true;
      case "ame":
        for (const b of chans()) {
          this.raw(serverId, `PRIVMSG ${b.name} :\x01ACTION ${rest}\x01`);
          this.add(b, "action", `${this.ownNick(serverId)} ${rest}`);
        }
        return true;
      case "dialog":
        this.dialogCmd(rest);
        return true;
      case "did":
        this.didCmd(rest);
        return true;
      default:
        return false;
    }
  }

  // ---- script dialogs (/dialog, /did, $did) --------------------------------

  private dialogCmd(rest: string) {
    let r = rest.trim();
    let flags = "";
    const fm = /^-(\S+)\s+/.exec(r);
    if (fm) {
      flags = fm[1];
      r = r.slice(fm[0].length);
    }
    const [name, table] = r.split(/\s+/);
    if (!name) return;
    if (flags.includes("x")) this.closeDialog(name);
    else this.openDialog(name, table ?? name);
  }

  private didCmd(rest: string) {
    let r = rest.trim();
    let flags = "";
    const fm = /^-(\S+)\s+/.exec(r);
    if (fm) {
      flags = fm[1];
      r = r.slice(fm[0].length);
    }
    const sp1 = r.indexOf(" ");
    const name = (sp1 === -1 ? r : r.slice(0, sp1)).toLowerCase();
    r = sp1 === -1 ? "" : r.slice(sp1 + 1).trim();
    const sp2 = r.indexOf(" ");
    const id = parseInt(sp2 === -1 ? r : r.slice(0, sp2), 10) || 0;
    const argsStr = sp2 === -1 ? "" : r.slice(sp2 + 1);
    const dlg = this.dialogsOpen.find((d) => d.name === name);
    if (dlg) applyDid(dlg, flags, id, argsStr.length ? argsStr.split(" ") : []);
  }

  openDialog(name: string, table: string) {
    const def = this.dialogDefs.get(table.toLowerCase());
    if (!def) return;
    const key = name.toLowerCase();
    if (this.dialogsOpen.some((d) => d.name === key)) return; // already open
    const dlg = instantiate(def);
    dlg.name = key;
    this.dialogsOpen.push(dlg);
    this.dlgFire(key, "init", "0");
  }

  closeDialog(name: string) {
    const key = name.toLowerCase();
    this.dialogsOpen = this.dialogsOpen.filter((d) => d.name !== key);
  }

  /** Fire an `on DIALOG` handler with $dname/$devent context. */
  private dlgFire(dname: string, event: string, id: string) {
    const prev = this.dlgCurrent;
    const prevE = this.dlgEvent;
    this.dlgCurrent = dname;
    this.dlgEvent = event;
    const sid = this.active?.serverId ?? this.servers[0]?.id ?? 0;
    try {
      this.msl.dispatchDialog(dname, event, id, this.mslData(sid, {}), this.mslHost(sid));
    } finally {
      this.dlgCurrent = prev;
      this.dlgEvent = prevE;
    }
  }

  // UI callbacks from DialogHost.
  dlgButton(dname: string, id: number) {
    this.dlgFire(dname, "sclick", String(id));
  }
  dlgEdit(dname: string, id: number, text: string) {
    const c = this.dialogsOpen.find((d) => d.name === dname)?.controls.find((x) => x.id === id);
    if (c) c.text = text;
    this.dlgFire(dname, "edit", String(id));
  }
  dlgSelect(dname: string, id: number, index: number) {
    const c = this.dialogsOpen.find((d) => d.name === dname)?.controls.find((x) => x.id === id);
    if (c) c.sel = index;
    this.dlgFire(dname, "sclick", String(id));
  }
  dlgCheck(dname: string, id: number, checked: boolean) {
    const c = this.dialogsOpen.find((d) => d.name === dname)?.controls.find((x) => x.id === id);
    if (c) c.checked = checked;
    this.dlgFire(dname, "sclick", String(id));
  }
  dlgClose(dname: string) {
    this.dlgFire(dname, "close", "0");
    this.closeDialog(dname);
  }

  /** Resolve a live (host-backed) mSL identifier against current client state. */
  private mslIdent(serverId: number, name: string, args: string[], prop?: string): string | null {
    const s = this.server(serverId);
    const chans = () => this.buffers.filter((b) => b.serverId === serverId && b.kind === "channel");
    switch (name) {
      case "network":
        return s?.isupport["NETWORK"] ?? "";
      case "server":
        return s?.name ?? "";
      case "me":
        return s?.nick ?? "";
      case "active":
        return this.active?.name ?? "";
      case "comchan": {
        const nick = (args[0] ?? "").toLowerCase();
        const n = parseInt(args[1] ?? "0", 10) || 0;
        const list = chans()
          .filter((b) => b.users.some((u) => u.nick.toLowerCase() === nick))
          .map((b) => b.name);
        return n === 0 ? String(list.length) : list[n - 1] ?? "";
      }
      case "chan": {
        const list = chans().map((b) => b.name);
        if (args.length === 0) return this.active?.kind === "channel" ? this.active.name : "";
        const a0 = args[0];
        if (a0.startsWith("#")) return list.find((c) => c.toLowerCase() === a0.toLowerCase()) ?? "";
        const n = parseInt(a0, 10) || 0;
        return n === 0 ? String(list.length) : list[n - 1] ?? "";
      }
      case "nick": {
        const buf = this.buffers.find(
          (b) => b.serverId === serverId && b.name.toLowerCase() === (args[0] ?? "").toLowerCase(),
        );
        if (!buf) return "";
        const n = parseInt(args[1] ?? "0", 10);
        return n === 0 ? String(buf.users.length) : buf.users[n - 1]?.nick ?? "";
      }
      case "ial":
        return this.ialLookup(serverId, args[0] ?? "", parseInt(args[1] ?? "1", 10) || 1, null);
      case "ialchan":
        return this.ialLookup(serverId, args[0] ?? "", parseInt(args[2] ?? "1", 10) || 1, args[1] ?? null);
      case "dname":
        return this.dlgCurrent;
      case "devent":
        return this.dlgEvent;
      case "dialog":
        return this.dialogsOpen.some((d) => d.name === (args[0] ?? "").toLowerCase()) ? args[0] : "";
      case "did": {
        const dlg = this.dialogsOpen.find((d) => d.name === (args[0] ?? "").toLowerCase());
        return dlg ? didIdent(dlg, parseInt(args[1] ?? "0", 10) || 0, args, prop) : "";
      }
      default:
        // Hash tables, then file I/O, then sockets ($sock/$sockname/…).
        return (
          this.hash.ident(name, args, prop) ??
          this.files.ident(name, args, prop) ??
          this.sockets.ident(name, args, prop)
        );
    }
  }

  /** $ial / $ialchan: Nth full address of a user matching a mask (0 = count). */
  private ialLookup(serverId: number, mask: string, n: number, chan: string | null): string {
    const rx = maskToRegex(mask);
    const seen = new Map<string, string>();
    for (const b of this.buffers) {
      if (b.serverId !== serverId || b.kind !== "channel") continue;
      if (chan && b.name.toLowerCase() !== chan.toLowerCase()) continue;
      for (const u of b.users) {
        const addr = u.host ? `${u.nick}!${u.user ?? "*"}@${u.host}` : u.nick;
        const key = u.nick.toLowerCase();
        if (!seen.has(key) && (rx.test(addr) || rx.test(u.nick))) seen.set(key, addr);
      }
    }
    const arr = [...seen.values()];
    return n === 0 ? String(arr.length) : arr[n - 1] ?? "";
  }

  /** Persist script %variables to disk if they changed during a script run. */
  private persistVars(_serverId: number) {
    const v = this.msl.serializeVars();
    if (v !== this.raveConfig.scripts.variables) {
      this.raveConfig.scripts.variables = v;
      saveRaveConfig(this.raveConfig).catch(() => {});
    }
  }

  /** Build event data for the scripting engine from a channel/sender context. */
  private mslData(serverId: number, over: Partial<EventData>): EventData {
    return {
      me: this.ownNick(serverId),
      nick: "",
      chan: "",
      target: "",
      address: "",
      ...over,
    };
  }

  /** Fire an mSL `on` event to user scripts. */
  private dispatchScript(serverId: number, event: string, over: Partial<EventData>) {
    this.msl.dispatch(event, this.mslData(serverId, over), this.mslHost(serverId));
    this.persistVars(serverId);
  }

  // ---- lookups -------------------------------------------------------------

  get active(): Buffer | null {
    return this.buffers.find((b) => b.id === this.activeId) ?? null;
  }

  activeServer(): Server | null {
    const b = this.active;
    return b ? this.servers.find((s) => s.id === b.serverId) ?? null : null;
  }

  private server(id: number): Server | undefined {
    return this.servers.find((s) => s.id === id);
  }

  private bufId(serverId: number, name: string): string {
    return `${serverId} ${name.toLowerCase()}`;
  }

  private serverBufId(serverId: number): string {
    return `${serverId} `;
  }

  private buffer(serverId: number, name: string): Buffer | undefined {
    return this.buffers.find((b) => b.id === this.bufId(serverId, name));
  }

  private prefixSymbols(serverId: number): string {
    const p = this.server(serverId)?.isupport["PREFIX"];
    const m = p && /\(([^)]*)\)(.*)/.exec(p);
    return m ? m[2] : DEFAULT_PREFIX_SYMBOLS;
  }

  private prefixModes(serverId: number): string {
    const p = this.server(serverId)?.isupport["PREFIX"];
    const m = p && /\(([^)]*)\)(.*)/.exec(p);
    return m ? m[1] : DEFAULT_PREFIX_MODES;
  }

  // ---- buffer/line helpers -------------------------------------------------

  private ensureBuffer(
    serverId: number,
    name: string,
    kind: Buffer["kind"],
  ): Buffer {
    const id = kind === "server" ? this.serverBufId(serverId) : this.bufId(serverId, name);
    let buf = this.buffers.find((b) => b.id === id);
    if (!buf) {
      buf = {
        id,
        serverId,
        name,
        kind,
        lines: [],
        users: [],
        topic: "",
        unread: 0,
        highlight: false,
        joined: kind === "server",
      };
      // Any window can carry a /font override (channel, query, and status).
      const f = this.bufferFonts[this.fontKey(serverId, name)];
      if (f) buf.font = f;
      this.buffers.push(buf);
    }
    return buf;
  }

  /** Storage key for a buffer's /font override ("network/name"). */
  private fontKey(serverId: number, name: string): string {
    const s = this.server(serverId);
    return channelKey(s ? detectNetwork(s) : "generic", name);
  }

  private add(buf: Buffer, kind: LineKind, text: string, from?: string) {
    const line: Line = { id: ++lineSeq, ts: Date.now(), kind, text, from };
    buf.lines.push(line);
    if (buf.lines.length > MAX_LINES) buf.lines.splice(0, buf.lines.length - MAX_LINES);
    if (buf.id !== this.activeId) {
      buf.unread++;
    }
    // Optional disk logging for channels/queries.
    if (this.raveConfig.logging && (buf.kind === "channel" || buf.kind === "query")) {
      const server = this.server(buf.serverId);
      const network = server ? detectNetwork(server) : "generic";
      const stamp = new Date(line.ts).toISOString();
      const who = from ? `<${from}> ` : "";
      invoke("log_line", {
        network,
        target: buf.name,
        line: `${stamp} [${kind}] ${who}${stripMirc(text)}`,
      }).catch(() => {});
    }
  }

  /** Add a line to a server's console buffer. */
  private addServer(serverId: number, kind: LineKind, text: string) {
    this.add(this.ensureBuffer(serverId, "(server)", "server"), kind, text);
  }

  private ownNick(serverId: number): string {
    return this.server(serverId)?.nick ?? "";
  }

  // ---- sorting -------------------------------------------------------------

  private sortUsers(buf: Buffer, serverId: number) {
    // Dedupe by nick (case-insensitive) before sorting. The user list is keyed
    // by nick in the UI, so two entries with the same nick — which a nick-change
    // onto an existing nick, a case-only rename, or a ZNC buffer replay can
    // produce — would crash the render with `each_key_duplicate`. Merge any
    // non-empty fields into the first entry so op status / host aren't lost.
    if (buf.users.length > 1) {
      const seen = new Map<string, ChanUser>();
      for (const u of buf.users) {
        const key = u.nick.toLowerCase();
        const prev = seen.get(key);
        if (prev) {
          if (!prev.prefix && u.prefix) prev.prefix = u.prefix;
          if (!prev.user && u.user) prev.user = u.user;
          if (!prev.host && u.host) prev.host = u.host;
        } else {
          seen.set(key, u);
        }
      }
      if (seen.size !== buf.users.length) buf.users = [...seen.values()];
    }
    const order = this.prefixSymbols(serverId);
    const rank = (u: ChanUser) => {
      // Empty prefix = normal user = lowest rank. Guard the indexOf("") === 0 trap.
      if (!u.prefix) return order.length;
      const i = order.indexOf(u.prefix);
      return i === -1 ? order.length : i;
    };
    buf.users.sort(
      (a, b) => rank(a) - rank(b) || a.nick.toLowerCase().localeCompare(b.nick.toLowerCase()),
    );
    if ((buf.peak ?? 0) < buf.users.length) buf.peak = buf.users.length;
  }

  // ---- event dispatch ------------------------------------------------------

  private onEvent(ev: IrcEvent) {
    // Ignore late events for a server window the user has closed (e.g. the
    // delayed "disconnected" after closeServer) so it can't be resurrected.
    if (ev.kind !== "connecting" && !this.server(ev.serverId)) return;
    switch (ev.kind) {
      case "connecting": {
        const label = this.serverNames.get(ev.serverId) || ev.host;
        let s = this.server(ev.serverId);
        if (!s) {
          s = { id: ev.serverId, name: label, nick: "", status: "connecting", isupport: {} };
          this.servers.push(s);
        } else {
          s.status = "connecting";
          s.name = label;
        }
        this.ensureBuffer(ev.serverId, "(server)", "server");
        this.addServer(ev.serverId, "system", `Connecting to ${ev.host}:${ev.port}…`);
        if (!this.activeId) this.activeId = this.serverBufId(ev.serverId);
        break;
      }
      case "connected":
        this.setStatus(ev.serverId, "connected");
        this.addServer(ev.serverId, "system", "Connected. Registering…");
        break;
      case "registered": {
        const s = this.server(ev.serverId);
        if (s) {
          s.status = "registered";
          s.nick = ev.nick;
        }
        this.addServer(ev.serverId, "system", `Registered as ${ev.nick}.`);
        // Notify/watch list: ask the server to MONITOR these nicks.
        if (this.raveConfig.notify.length > 0) {
          this.raw(ev.serverId, `MONITOR + ${this.raveConfig.notify.join(",")}`);
        }
        // Auto-join the Channel Manager's flagged channels for this network.
        if (s) {
          const net = detectNetwork(s);
          for (const key of loadAutojoin()) {
            const slash = key.indexOf("/");
            if (slash > 0 && key.slice(0, slash) === net) {
              this.joinChannel(ev.serverId, key.slice(slash + 1));
            }
          }
        }
        this.dispatchScript(ev.serverId, "CONNECT", {});
        break;
      }
      case "disconnected":
        this.setStatus(ev.serverId, "disconnected");
        this.addServer(
          ev.serverId,
          "error",
          `Disconnected${ev.reason ? `: ${ev.reason}` : ""}.`,
        );
        // Mark channels as parted.
        for (const b of this.buffers) {
          if (b.serverId === ev.serverId && b.kind === "channel") b.joined = false;
        }
        this.dispatchScript(ev.serverId, "DISCONNECT", {});
        break;
      case "error":
        this.addServer(ev.serverId, "error", ev.message);
        break;
      case "sent":
        break; // raw echo; ignored for now (commands self-echo where relevant)
      case "message":
        this.onMessage(ev.serverId, ev.message, ev.raw);
        break;
    }
  }

  private setStatus(serverId: number, status: Server["status"]) {
    const s = this.server(serverId);
    if (s) s.status = status;
  }

  // ---- IRC message handling ------------------------------------------------

  private onMessage(serverId: number, msg: IrcMessage, raw: string) {
    const cmd = msg.command;
    const from = msg.prefix?.nick ?? msg.prefix?.raw ?? "";

    // Numerics → mSL `raw` handlers. haltdef suppresses the default display.
    if (/^\d{3}$/.test(cmd)) {
      const data = this.mslData(serverId, { nick: from, target: msg.params[0] ?? "" });
      if (this.msl.dispatchRaw(cmd, msg.params, data, this.mslHost(serverId))) {
        this.persistVars(serverId);
        return;
      }
      this.persistVars(serverId);
    }

    switch (cmd) {
      case "PING":
      case "PONG":
        return; // keepalive chatter — handled in the engine, not shown
      case "PRIVMSG":
        return this.handlePrivmsg(serverId, msg, from, false);
      case "NOTICE":
        return this.handlePrivmsg(serverId, msg, from, true);
      case "JOIN":
        return this.handleJoin(serverId, msg, from);
      case "PART":
        return this.handlePart(serverId, msg, from);
      case "QUIT":
        return this.handleQuit(serverId, msg, from);
      case "NICK":
        return this.handleNick(serverId, msg, from);
      case "KICK":
        return this.handleKick(serverId, msg, from);
      case "MODE":
        return this.handleMode(serverId, msg, from);
      case "TOPIC":
        return this.handleTopic(serverId, msg, from);
      case "332":
        return this.handleTopicNumeric(serverId, msg);
      case "353":
        return this.handleNames(serverId, msg);
      case "352":
        return this.handleWho(serverId, msg);
      case "315":
        return; // end of WHO
      case "730": // RPL_MONONLINE — watched nicks came online
        return this.handleMonitor(serverId, msg, true);
      case "731": // RPL_MONOFFLINE — watched nicks went offline
        return this.handleMonitor(serverId, msg, false);
      case "366":
        return; // end of names
      case "005":
        return this.handleIsupport(serverId, msg);
      case "001":
      case "002":
      case "003":
      case "004":
      case "251":
      case "252":
      case "253":
      case "254":
      case "255":
      case "265":
      case "266":
      case "372":
      case "375":
      case "376":
      case "422":
        return this.addServer(serverId, "motd", msg.params.slice(1).join(" "));
      default:
        if (/^\d{3}$/.test(cmd)) {
          // Generic numeric -> server console (skip our own nick as first param).
          this.addServer(serverId, "system", msg.params.slice(1).join(" "));
        } else {
          this.addServer(serverId, "system", raw);
        }
    }
  }

  private isChannel(serverId: number, target: string): boolean {
    const types = this.server(serverId)?.isupport["CHANTYPES"] ?? "#&";
    return !!target && types.includes(target[0]);
  }

  private handlePrivmsg(serverId: number, msg: IrcMessage, from: string, notice: boolean) {
    const target = msg.params[0] ?? msg.params[0] ?? "";
    let text = msg.params[1] ?? "";
    const me = this.ownNick(serverId);

    // CTCP ACTION (/me)
    const ctcp = /^\x01(\w+)\s?(.*?)\x01?$/.exec(text);
    if (ctcp && ctcp[1].toUpperCase() === "ACTION") {
      const bufName = this.isChannel(serverId, target) ? target : from;
      const buf = this.ensureBuffer(serverId, bufName, this.isChannel(serverId, target) ? "channel" : "query");
      this.add(buf, "action", `${from} ${ctcp[2]}`, from);
      this.flag(buf, ctcp[2], me);
      this.dispatchScript(serverId, "ACTION", {
        nick: from,
        chan: this.isChannel(serverId, target) ? target : "",
        target: bufName,
        text: ctcp[2],
      });
      return;
    }
    if (ctcp && !notice) {
      // CTCP flood: too many CTCP queries from one user in a channel → act.
      if (this.isChannel(serverId, target)) {
        const cf = this.protectionsFor(serverId, target).ctcpFlood;
        if (cf.enabled && this.amOp(serverId, target)) {
          const addr = this.address(serverId, target, from);
          if (!isExempt(from, addr, this.raveConfig.protections.friends)) {
            const k = `${serverId}|${target}|${from}`;
            if (this.ctcpFlood.record(k, Date.now(), cf.count, cf.seconds)) {
              this.enforce(serverId, target, from, { ban: cf.ban, reason: cf.reason });
            }
          }
        }
      }
      this.addServer(serverId, "system", `[CTCP ${ctcp[1]} from ${from}]`);
      return;
    }

    const toChannel = this.isChannel(serverId, target);

    // Private-message guard (RAVE mega.pvt.*): drop spam/ads/worms in queries.
    if (!toChannel && !notice && this.pmBlocked(serverId, from, text, msg)) return;

    if (ctcp && notice) {
      // CTCP reply (VERSION/PING/etc.) -> active window.
      const dest = this.active ?? this.ensureBuffer(serverId, "(server)", "server");
      this.add(dest, "notice", `[${ctcp[1].toUpperCase()} reply] ${ctcp[2]}`, from);
      return;
    }

    // Private/service notices appear in the active window (mIRC-style) instead
    // of spawning a separate query buffer. Channel notices stay in-channel.
    if (notice && !toChannel) {
      const dest = this.active ?? this.ensureBuffer(serverId, "(server)", "server");
      this.add(dest, "notice", text, from);
      this.flag(dest, text, me);
      // NickServ asking us to identify → auto-identify if this nick is saved.
      if (this.isIdentifyRequest(from, text)) void this.maybeAutoIdentify(serverId, me);
      return;
    }

    const bufName = toChannel ? target : from;
    const kind: Buffer["kind"] = toChannel ? "channel" : "query";
    const isNewQuery = !toChannel && !this.buffer(serverId, bufName);
    const buf = this.ensureBuffer(serverId, bufName, kind);

    // Secure Query (RAVE-07): warn on a first message from an unknown sender.
    if (isNewQuery && !notice && this.raveConfig.secureQuery) {
      const addr = msg.prefix?.host ? `${from}!${msg.prefix.user ?? "*"}@${msg.prefix.host}` : undefined;
      const known =
        isExempt(from, addr, this.raveConfig.protections.friends) ||
        this.comchan(serverId, from).length > 0;
      if (!known) {
        this.add(buf, "system", `⚠ Secure Query: ${from} is unknown (no shared channels, not a friend).`);
      }
    }

    // Encrypted (🔒) messages: auto-decrypt if we hold the session key.
    if (!notice && text.startsWith(ENC_MARKER)) {
      if (this.encKey) {
        decryptText(this.encKey, text).then((pt) => {
          this.add(buf, "message", pt ? `🔒 ${pt}` : "🔒 [encrypted — wrong key]", from);
          if (pt) this.flag(buf, pt, me);
        });
      } else {
        this.add(buf, "message", "🔒 [encrypted message — /setkey to read]", from);
      }
      return;
    }

    this.add(buf, notice ? "notice" : "message", text, from);
    this.flag(buf, text, me);

    // Keep the IAL fresh from the sender's prefix, then run protections.
    if (toChannel && msg.prefix?.host) {
      const u = buf.users.find((x) => x.nick === from);
      if (u) {
        u.user = msg.prefix.user ?? u.user;
        u.host = msg.prefix.host ?? u.host;
      }
    }
    if (toChannel && !notice) this.checkMessage(serverId, target, from, text);

    // Fire mSL TEXT/NOTICE events to user scripts.
    const addr = msg.prefix?.host ? `${from}!${msg.prefix.user ?? "*"}@${msg.prefix.host}` : "";
    this.dispatchScript(serverId, notice ? "NOTICE" : "TEXT", {
      nick: from,
      chan: toChannel ? target : "",
      target: bufName,
      address: addr,
      text,
    });
  }

  /** Mark highlight if our nick is mentioned in a non-active buffer. */
  private flag(buf: Buffer, text: string, me: string) {
    if (!me) return;
    if (buf.id !== this.activeId && stripMirc(text).toLowerCase().includes(me.toLowerCase())) {
      buf.highlight = true;
      if (appearance.soundOnHighlight) beep();
    }
  }

  private handleJoin(serverId: number, msg: IrcMessage, from: string) {
    const chan = msg.params[0] ?? "";
    const me = this.ownNick(serverId);
    const buf = this.ensureBuffer(serverId, chan, "channel");
    const user = msg.prefix?.user ?? undefined;
    const host = msg.prefix?.host ?? undefined;

    if (from === me) {
      buf.joined = true;
      this.add(buf, "join", `Now talking in ${chan}`);
      if (this.activeId === this.serverBufId(serverId)) this.activeId = buf.id;
      // Populate the IAL (per-user host map) for this channel.
      this.raw(serverId, `WHO ${chan}`);
    } else {
      const existing = buf.users.find((u) => u.nick === from);
      if (existing) {
        existing.user = user;
        existing.host = host;
      } else {
        buf.users.push({ nick: from, prefix: "", user, host });
      }
      this.sortUsers(buf, serverId);
      this.add(buf, "join", `${from} (${user}@${host}) has joined ${chan}`, from);
      // Hook: channel-join protections run here (filled in by the protections module).
      this.onUserJoin(serverId, chan, from, user, host);
      this.dispatchScript(serverId, "JOIN", {
        nick: from,
        chan,
        address: host ? `${from}!${user ?? "*"}@${host}` : "",
      });
    }
  }

  /** MONITOR online/offline notifications for the notify/watch list. */
  private handleMonitor(serverId: number, msg: IrcMessage, online: boolean) {
    // params: <me> :nick!user@host,nick2!user@host,...
    const list = (msg.params[1] ?? "").split(",").map((t) => t.split("!")[0].trim()).filter(Boolean);
    const dest = this.active?.serverId === serverId ? this.active : null;
    for (const nick of list) {
      const text = `${online ? "→" : "←"} ${nick} is ${online ? "online" : "offline"}`;
      if (dest) this.add(dest, online ? "join" : "part", text, nick);
      else this.addServer(serverId, online ? "join" : "part", text);
    }
  }

  /** WHO reply (352): fill the IAL with each user's user@host. */
  private handleWho(serverId: number, msg: IrcMessage) {
    // params: <me> <channel> <user> <host> <server> <nick> <flags> :<hop realname>
    const chan = msg.params[1] ?? "";
    const user = msg.params[2];
    const host = msg.params[3];
    const nick = msg.params[5];
    if (!chan || !nick) return;
    const buf = this.buffer(serverId, chan);
    if (!buf) return;
    const u = buf.users.find((x) => x.nick === nick);
    if (u) {
      u.user = user;
      u.host = host;
    } else {
      buf.users.push({ nick, prefix: "", user, host });
      this.sortUsers(buf, serverId);
    }
  }

  /** Invoked when another user joins: anti-clone + auto-op friends. */
  protected onUserJoin(
    serverId: number,
    chan: string,
    nick: string,
    user?: string,
    host?: string,
  ) {
    const cfg = this.protectionsFor(serverId, chan);
    if (nick === this.ownNick(serverId)) return;

    // Raid / join-flood detection → channel lockdown.
    if (cfg.raid.enabled && this.amOp(serverId, chan)) {
      const rkey = `${serverId}|${chan}`;
      if (
        this.raidTracker.record(rkey, Date.now(), cfg.raid.joins, cfg.raid.seconds) &&
        !this.lockedChannels.has(rkey)
      ) {
        this.lockedChannels.add(rkey);
        this.raw(serverId, `MODE ${chan} ${cfg.raid.lockMode}`);
        const buf = this.buffer(serverId, chan);
        if (buf) this.add(buf, "error", `⚠ Raid detected — locked ${chan} (${cfg.raid.lockMode})`);
        if (cfg.raid.unlockMinutes > 0) {
          const unlock = cfg.raid.lockMode.replace(/\+/g, "-");
          setTimeout(() => {
            this.raw(serverId, `MODE ${chan} ${unlock}`);
            this.lockedChannels.delete(rkey);
          }, cfg.raid.unlockMinutes * 60_000);
        }
      }
    }

    const address = host ? `${nick}!${user ?? "*"}@${host}` : undefined;

    // Auto-op / auto-voice lists (per-channel) take priority and exempt from checks.
    if (this.amOp(serverId, chan)) {
      if (isExempt(nick, address, cfg.autoOp)) {
        this.raw(serverId, `MODE ${chan} +o ${nick}`);
        return;
      }
      if (isExempt(nick, address, cfg.autoVoice)) {
        this.raw(serverId, `MODE ${chan} +v ${nick}`);
      }
    }

    const friend = isExempt(nick, address, this.raveConfig.protections.friends);

    if (friend) {
      if (cfg.autoOpFriends && this.amOp(serverId, chan)) {
        this.raw(serverId, `MODE ${chan} +o ${nick}`);
      }
      return;
    }
    if (!this.amOp(serverId, chan)) return;

    // RAVE "Intelligent Bans": offensive nick/ident → ban the trigger word.
    const on = cfg.offensiveNick;
    if (on?.enabled && on.words.length) {
      const word = offensiveNickHit(nick, user, on.words);
      if (word) {
        const mask = `*${word}*!*@*`;
        this.raw(serverId, `MODE ${chan} +b ${mask}`);
        this.raw(serverId, `KICK ${chan} ${nick} :${on.reason || "Offensive nick/ident"}`);
        return;
      }
    }

    if (host) {
      const count = this.usersByHost(serverId, chan, host).length;
      if (isCloneViolation(count, cfg.clone)) {
        this.enforce(serverId, chan, nick, { ban: cfg.clone.ban, reason: cfg.clone.reason });
      }
    }
  }

  /** Protection settings for a channel: per-channel override, else global default. */
  protectionsFor(serverId: number, chan: string): ProtectionsConfig {
    const server = this.server(serverId);
    if (server) {
      const override = this.raveConfig.channelProtections[channelKey(detectNetwork(server), chan)];
      if (override) return override;
    }
    return this.raveConfig.protections;
  }

  /** Private-message guard: returns true if a query message should be dropped. */
  private pmBlocked(serverId: number, from: string, text: string, msg: IrcMessage): boolean {
    const pm = this.raveConfig.pm;
    if (!pm.enabled) return false;
    const addr = msg.prefix?.host
      ? `${from}!${msg.prefix.user ?? "*"}@${msg.prefix.host}`
      : undefined;
    // Never block friends or people who share a channel with you.
    if (isExempt(from, addr, this.raveConfig.protections.friends)) return false;
    if (this.comchan(serverId, from).length > 0) return false;

    const drop = (why: string) => {
      this.addServer(serverId, "error", `Blocked PM from ${from} (${why})`);
      return true;
    };
    if (pm.knownOnly) return drop("unknown sender");
    if (pm.blockAdverts && advertHit(text, { enabled: true, blockAdverts: true } as never)) {
      return drop("advert");
    }
    if (pm.blockWorms && trickHit(text)) return drop("exploit/worm");
    if (this.pmRepeat.record(`${serverId}|${from}`, stripMirc(text), pm.repeatLimit)) {
      return drop("repeat spam");
    }
    return false;
  }

  /** Run message-based protections (bad words, antispam, flood) on a line. */
  private checkMessage(serverId: number, chan: string, nick: string, text: string) {
    if (nick === this.ownNick(serverId)) return;
    if (!this.amOp(serverId, chan)) return;
    const p = this.protectionsFor(serverId, chan);
    const a = this.raveConfig.antispam;
    const address = this.address(serverId, chan, nick);
    if (isExempt(nick, address, this.raveConfig.protections.friends)) return;

    const bw = badwordHit(text, p.badword);
    if (bw) {
      return this.enforce(serverId, chan, nick, { ban: p.badword.ban, reason: p.badword.reason });
    }

    if (p.tricks.enabled && trickHit(text)) {
      return this.enforce(serverId, chan, nick, { ban: p.tricks.ban, reason: p.tricks.reason });
    }

    if (capsHit(text, p.caps)) {
      return this.enforce(serverId, chan, nick, { ban: p.caps.ban, reason: p.caps.reason });
    }

    if (lengthHit(text, p.length)) {
      return this.enforce(serverId, chan, nick, { ban: p.length.ban, reason: p.length.reason });
    }

    if (advertHit(text, a, chan)) {
      return this.enforce(serverId, chan, nick, { ban: a.ban, reason: a.reason });
    }

    const key = `${serverId}|${chan}|${nick}`;
    if (a.enabled && this.repeat.record(key, stripMirc(text), a.repeatLimit)) {
      return this.enforce(serverId, chan, nick, { ban: a.ban, reason: a.reason });
    }

    if (p.flood.enabled && this.flood.record(key, Date.now(), p.flood.lines, p.flood.seconds)) {
      return this.enforce(serverId, chan, nick, { ban: p.flood.ban, reason: p.flood.reason });
    }

    // AI moderation (local Ollama) runs last, asynchronously — fire and forget.
    this.aiCheck(serverId, chan, nick, text);
  }

  /** Local-AI moderation: classify a message and flag/act on a verdict. */
  private aiCheck(serverId: number, chan: string, nick: string, text: string) {
    const ai = this.raveConfig.ai;
    if (!ai.enabled || !ai.moderate) return;
    aiModerate(chan, nick, stripMirc(text))
      .then((v) => {
        if (!v.flag || v.severity < ai.minSeverity) return;
        // Re-validate: state may have changed during the async call.
        if (!this.amOp(serverId, chan)) return;
        const addr = this.address(serverId, chan, nick);
        if (isExempt(nick, addr, this.raveConfig.protections.friends)) return;
        const buf = this.buffer(serverId, chan);
        const label = `🤖 AI: ${v.category} (severity ${v.severity}) — ${v.reason}`;
        if (ai.autoEnforce) {
          this.enforce(serverId, chan, nick, { ban: ai.ban, reason: v.reason || "AI moderation" });
          if (buf) this.add(buf, "error", `${label} → kicked ${nick}`);
        } else if (buf) {
          this.add(buf, "error", `${label} — ${nick} (flagged; not actioned)`);
        }
      })
      .catch(() => {
        /* Ollama offline or model missing: stay silent (advisory feature). */
      });
  }

  /** Are we (our own nick) op or higher in this channel? */
  private amOp(serverId: number, chan: string): boolean {
    const me = this.ownNick(serverId);
    const u = this.buffer(serverId, chan)?.users.find((x) => x.nick === me);
    if (!u || !u.prefix) return false;
    const symbols = this.prefixSymbols(serverId);
    const opIdx = symbols.indexOf("@");
    return opIdx !== -1 && symbols.indexOf(u.prefix) <= opIdx;
  }

  /** Enforce an action against a nick: optional (timed) ban then kick. */
  private enforce(serverId: number, chan: string, nick: string, action: Action) {
    if (action.ban) {
      const address = this.address(serverId, chan, nick);
      const hostPart = address?.split("@")[1];
      const mask = hostPart ? `*!*@${hostPart}` : `${nick}!*@*`;
      this.raw(serverId, `MODE ${chan} +b ${mask}`);
      // Auto-unban after the configured duration (0 = permanent).
      const mins = this.protectionsFor(serverId, chan).banMinutes;
      if (mins > 0) {
        setTimeout(() => this.raw(serverId, `MODE ${chan} -b ${mask}`), mins * 60_000);
      }
    }
    this.raw(serverId, `KICK ${chan} ${nick} :${action.reason}`);
  }

  // ---- IAL (Internal Address List) accessors -------------------------------

  /** A user's known address in a channel ($address equivalent), or undefined. */
  address(serverId: number, chan: string, nick: string): string | undefined {
    const u = this.buffer(serverId, chan)?.users.find((x) => x.nick === nick);
    return u?.host ? `${u.nick}!${u.user ?? "*"}@${u.host}` : undefined;
  }

  /** All nicks in a channel sharing the given host (clone detection). */
  usersByHost(serverId: number, chan: string, host: string): string[] {
    return (
      this.buffer(serverId, chan)?.users.filter((u) => u.host === host).map((u) => u.nick) ?? []
    );
  }

  /** Channels (on a server) where the given nick is also present ($comchan). */
  comchan(serverId: number, nick: string): string[] {
    return this.buffers
      .filter(
        (b) =>
          b.serverId === serverId &&
          b.kind === "channel" &&
          b.users.some((u) => u.nick === nick),
      )
      .map((b) => b.name);
  }

  private handlePart(serverId: number, msg: IrcMessage, from: string) {
    const chan = msg.params[0] ?? msg.params[0] ?? "";
    const reason = msg.params[1] ?? "";
    const buf = this.buffer(serverId, chan);
    if (!buf) return;
    buf.users = buf.users.filter((u) => u.nick !== from);
    if (from === this.ownNick(serverId)) buf.joined = false;
    this.add(buf, "part", `${from} has left ${chan}${reason ? ` (${reason})` : ""}`, from);
    this.dispatchScript(serverId, "PART", { nick: from, chan });
  }

  private handleQuit(serverId: number, msg: IrcMessage, from: string) {
    const reason = msg.params[0] ?? "";
    for (const buf of this.buffers) {
      if (buf.serverId !== serverId || buf.kind !== "channel") continue;
      if (buf.users.some((u) => u.nick === from)) {
        buf.users = buf.users.filter((u) => u.nick !== from);
        this.add(buf, "quit", `${from} has quit${reason ? ` (${reason})` : ""}`, from);
      }
    }
    this.dispatchScript(serverId, "QUIT", { nick: from, text: reason });
  }

  private handleNick(serverId: number, msg: IrcMessage, from: string) {
    const newNick = msg.params[0] ?? msg.params[0] ?? "";
    const isSelf = from === this.ownNick(serverId);
    if (isSelf) {
      const s = this.server(serverId);
      if (s) s.nick = newNick;
      // Always surface your own nick change (don't suppress it), even when you
      // aren't in a shared channel — it lands in the server console.
      this.addServer(serverId, "nick", `You are now known as ${newNick}`);
      // Re-identify if the new nick is a saved auto-identify nick.
      void this.maybeAutoIdentify(serverId, newNick);
    }
    for (const buf of this.buffers) {
      if (buf.serverId !== serverId || buf.kind !== "channel") continue;
      const u = buf.users.find((x) => x.nick === from);
      if (u) {
        u.nick = newNick;
        this.sortUsers(buf, serverId);
        this.add(buf, "nick", `${from} is now known as ${newNick}`, from);
      }
    }
    this.dispatchScript(serverId, "NICK", { nick: from, newnick: newNick });
  }

  /** Recent auto-identifies, keyed by "serverId|nick", to avoid re-spamming. */
  private identifyCooldown = new Map<string, number>();
  /** Connect-time identity (in-memory) — auto-identify fallback for the connect nick. */
  private connectIdentity = new Map<number, { nick: string; password: string }>();

  /** Friendly display names for server windows (saved-server / preset name). */
  private serverNames = new Map<number, string>();

  private rememberIdentity(serverId: number, config: ServerConfig) {
    if (config.name) {
      this.serverNames.set(serverId, config.name);
      // The web transport emits "connecting" synchronously before this runs, so
      // update the already-created server window too.
      const s = this.server(serverId);
      if (s) s.name = config.name;
    }
    if (config.nickservPassword && config.autoIdentify !== false) {
      this.connectIdentity.set(serverId, { nick: config.nick, password: config.nickservPassword });
    } else {
      this.connectIdentity.delete(serverId);
    }
  }

  /** True if a services notice is asking us to identify our (registered) nick. */
  private isIdentifyRequest(from: string, text: string): boolean {
    if (!/nickserv|nickserv@services|^services\./i.test(from)) return false;
    const t = text.toLowerCase();
    return (
      t.includes("identify") ||
      t.includes("this nickname is registered") ||
      (t.includes("registered") && (t.includes("nick") || t.includes("password")))
    );
  }

  /**
   * Auto-identify to services when `nick` matches a saved profile that has
   * auto-identify on (mIRC-style on-nick / on-NickServ-request). The password
   * comes from RAVE's encrypted secret store, or the connect-time password.
   */
  private async maybeAutoIdentify(serverId: number, nick: string) {
    const s = this.server(serverId);
    if (!s) return;
    const key = `${serverId}|${nick.toLowerCase()}`;
    if (Date.now() - (this.identifyCooldown.get(key) ?? 0) < 15000) return;

    // Prefer a saved profile (password from the encrypted secret store); fall
    // back to the connect-time password held in memory.
    let password = "";
    const prof = loadProfiles().find(
      (p) => p.autoIdentify && p.nick.toLowerCase() === nick.toLowerCase(),
    );
    if (prof) password = await loadProfilePassword(prof.id);
    if (!password) {
      const ci = this.connectIdentity.get(serverId);
      if (ci && ci.nick.toLowerCase() === nick.toLowerCase()) password = ci.password;
    }
    if (!password) return;

    this.identifyCooldown.set(key, Date.now());
    for (const line of serviceProfile(s).identify(nick, password)) this.raw(serverId, line);
    this.addServer(serverId, "system", `Auto-identifying ${nick} to services…`);
  }

  private handleKick(serverId: number, msg: IrcMessage, from: string) {
    const chan = msg.params[0] ?? "";
    const target = msg.params[1] ?? "";
    const reason = msg.params[2] ?? "";
    const buf = this.buffer(serverId, chan);
    if (!buf) return;
    buf.users = buf.users.filter((u) => u.nick !== target);
    if (target === this.ownNick(serverId)) {
      buf.joined = false;
      // Auto-rejoin after a short delay if enabled for this channel.
      if (this.protectionsFor(serverId, chan).autoRejoin) {
        setTimeout(() => this.raw(serverId, `JOIN ${chan}`), 1500);
      }
    }
    this.add(buf, "kick", `${target} was kicked by ${from}${reason ? ` (${reason})` : ""}`, from);
    this.dispatchScript(serverId, "KICK", { nick: from, chan, knick: target, text: reason });
  }

  private handleTopic(serverId: number, msg: IrcMessage, from: string) {
    const chan = msg.params[0] ?? "";
    const topic = msg.params[1] ?? "";
    const buf = this.buffer(serverId, chan);
    if (!buf) return;
    buf.topic = topic;
    this.add(buf, "topic", `${from} changed the topic to: ${topic}`, from);
  }

  private handleTopicNumeric(serverId: number, msg: IrcMessage) {
    const chan = msg.params[1] ?? "";
    const topic = msg.params[2] ?? "";
    const buf = this.ensureBuffer(serverId, chan, "channel");
    buf.topic = topic;
    this.add(buf, "topic", `Topic for ${chan}: ${topic}`);
  }

  private handleNames(serverId: number, msg: IrcMessage) {
    // 353: <me> <=|*|@> <#chan> :nick list
    const chan = msg.params[2] ?? "";
    const names = (msg.params[3] ?? "").split(" ").filter(Boolean);
    const symbols = this.prefixSymbols(serverId);
    const buf = this.ensureBuffer(serverId, chan, "channel");
    for (const raw of names) {
      let i = 0;
      while (i < raw.length && symbols.includes(raw[i])) i++;
      const prefix = i > 0 ? raw[0] : "";
      const nick = raw.slice(i);
      if (!nick) continue;
      const existing = buf.users.find((u) => u.nick === nick);
      if (existing) existing.prefix = prefix;
      else buf.users.push({ nick, prefix });
    }
    this.sortUsers(buf, serverId);
  }

  private handleIsupport(serverId: number, msg: IrcMessage) {
    const s = this.server(serverId);
    if (!s) return;
    // params: <me> TOKEN[=value] ... :are supported by this server
    for (const tok of msg.params.slice(1, -1)) {
      const [k, v] = tok.split("=");
      if (k) s.isupport[k] = v ?? "";
    }
  }

  private handleMode(serverId: number, msg: IrcMessage, from: string) {
    const target = msg.params[0] ?? "";
    if (!this.isChannel(serverId, target)) {
      this.addServer(serverId, "mode", `${from} sets mode ${msg.params.slice(1).join(" ")}`);
      return;
    }
    const buf = this.buffer(serverId, target);
    if (!buf) return;
    const modeStr = msg.params[1] ?? "";
    const args = msg.params.slice(2);
    const modes = this.prefixModes(serverId);
    const symbols = this.prefixSymbols(serverId);

    let adding = true;
    let argi = 0;
    for (const ch of modeStr) {
      if (ch === "+") {
        adding = true;
        continue;
      }
      if (ch === "-") {
        adding = false;
        continue;
      }
      const mi = modes.indexOf(ch);
      if (mi !== -1) {
        // prefix mode: consumes a nick argument
        const nick = args[argi++];
        const u = buf.users.find((x) => x.nick === nick);
        if (u) {
          const sym = symbols[mi];
          if (adding) {
            // adopt highest of current/new
            if (symbols.indexOf(sym) < symbols.indexOf(u.prefix) || u.prefix === "") u.prefix = sym;
          } else if (u.prefix === sym) {
            u.prefix = "";
          }
        }
      } else if ("beIkflLjq".includes(ch)) {
        // modes that take a parameter (approximate common set)
        if (adding || "beIklfLjq".includes(ch)) argi++;
      }
    }
    this.sortUsers(buf, serverId);
    this.add(buf, "mode", `${from} sets mode ${[modeStr, ...args].join(" ")}`, from);
    this.dispatchScript(serverId, "MODE", { nick: from, chan: target, text: [modeStr, ...args].join(" ") });
  }

  // ---- actions (called by UI) ----------------------------------------------

  async connect(config: ServerConfig): Promise<number> {
    const id = await connectServer(config);
    this.rememberIdentity(id, config);
    return id;
  }

  /**
   * Reconnect an existing server window to `config` (mIRC: /server in the current
   * status window). On web the window persists (same id); on desktop the backend
   * assigns ids, so we replace the window in place.
   */
  async reconnect(serverId: number, config: ServerConfig): Promise<number> {
    if (isWeb()) {
      const id = await connectServer(config, serverId);
      this.rememberIdentity(id, config);
      return id;
    }
    this.closeServer(serverId);
    const id = await connectServer(config);
    this.rememberIdentity(id, config);
    return id;
  }

  async sendInput(text: string, override?: Buffer): Promise<void> {
    const buf = override ?? this.active;
    if (!buf) return;
    const server = this.server(buf.serverId);
    const connected = server?.status === "registered" || server?.status === "connected";
    const target = buf.kind === "server" ? undefined : buf.name;

    // Don't send a plain message into a channel you've left — warn in-window.
    if (!text.startsWith("/") && buf.kind === "channel" && !buf.joined) {
      this.add(buf, "error", `You're not in ${buf.name} — /join ${buf.name} to rejoin.`);
      return;
    }

    // mIRC `//cmd`: evaluate $identifiers/%variables, then run as a command.
    // (Single `/cmd` is sent literally, as in mIRC.)
    if (text.startsWith("//")) {
      const body = text.slice(2);
      const data = this.mslData(buf.serverId, {
        chan: buf.kind === "channel" ? buf.name : "",
        target: buf.name,
        nick: this.ownNick(buf.serverId),
      });
      return this.sendInput("/" + this.msl.evalExpr(body, data, this.mslHost(buf.serverId)), buf);
    }

    // /timer and /timers are handled before aliases/built-ins because their
    // argument is itself a command line (e.g. `/timer 0 5 /msg #c hi`).
    if (text.startsWith("/") && !text.startsWith("//")) {
      const sp0 = text.indexOf(" ");
      const word = (sp0 === -1 ? text.slice(1) : text.slice(1, sp0)).toLowerCase();
      if (word === "timers" || word.startsWith("timer")) {
        const rest0 = sp0 === -1 ? "" : text.slice(sp0 + 1);
        if (this.handleTimer(word, rest0, buf)) return;
      }
    }

    // User-defined mSL aliases take priority over built-in slash commands.
    if (text.startsWith("/") && !text.startsWith("//")) {
      const sp = text.indexOf(" ");
      const name = (sp === -1 ? text.slice(1) : text.slice(1, sp)).toLowerCase();
      const rest = sp === -1 ? "" : text.slice(sp + 1);
      if (this.msl.hasAlias(name)) {
        const data = this.mslData(buf.serverId, {
          chan: buf.kind === "channel" ? buf.name : "",
          target: buf.name,
          nick: this.ownNick(buf.serverId),
        });
        this.msl.runAlias(name, rest, data, this.mslHost(buf.serverId));
        this.persistVars(buf.serverId);
        return;
      }
    }

    const result = parseInput(text, { connected: !!connected, target } as CommandContext);

    switch (result.type) {
      case "noop":
        return;
      case "error":
        this.add(buf, "error", result.message);
        return;
      case "raw":
        for (const line of result.lines) await this.raw(buf.serverId, line);
        return;
      case "message": {
        await sendMessage(buf.serverId, result.target, result.text);
        const dest = this.ensureBuffer(
          buf.serverId,
          result.target,
          this.isChannel(buf.serverId, result.target) ? "channel" : "query",
        );
        this.add(dest, "self", result.text, this.ownNick(buf.serverId));
        return;
      }
      case "action": {
        await this.raw(buf.serverId, `PRIVMSG ${result.target} :\x01ACTION ${result.text}\x01`);
        const dest = this.ensureBuffer(
          buf.serverId,
          result.target,
          this.isChannel(buf.serverId, result.target) ? "channel" : "query",
        );
        this.add(dest, "action", `${this.ownNick(buf.serverId)} ${result.text}`);
        return;
      }
      case "notice": {
        await this.raw(buf.serverId, `NOTICE ${result.target} :${result.text}`);
        this.add(buf, "notice", `-> -${result.target}- ${result.text}`);
        return;
      }
      case "client":
        return this.clientCommand(result.action, result.arg, buf);
      case "service":
        return this.resolveService(buf, result.action, result.args);
    }
  }

  /** Handle /timer[name] and /timers. Returns true if the input was a timer command. */
  private handleTimer(word: string, rest: string, buf: Buffer): boolean {
    const isList = word === "timers";
    const name = isList ? "" : word.slice("timer".length);
    const trimmed = rest.trim();

    if (trimmed.toLowerCase() === "off") {
      if (isList || name === "") {
        const n = this.timers.stopAll();
        this.add(buf, "system", n ? `Stopped ${n} timer${n === 1 ? "" : "s"}.` : "No active timers.");
      } else {
        const ok = this.timers.stop(name);
        this.add(buf, ok ? "system" : "error", ok ? `Timer ${name} stopped.` : `No timer named ${name}.`);
      }
      return true;
    }

    // `/timers` (or `/timer` with nothing useful) → list active timers.
    if (isList || trimmed === "") {
      this.listTimers(buf);
      return true;
    }

    const spec = parseTimerSpec(rest);
    if ("error" in spec) {
      this.add(buf, "error", spec.error);
      return true;
    }
    const finalName = this.timers.start({
      name,
      reps: spec.reps,
      intervalMs: spec.intervalMs,
      command: spec.command,
      online: spec.online,
      ctx: { serverId: buf.serverId, bufferName: buf.name },
    });
    const reps = spec.reps === 0 ? "∞" : `${spec.reps}×`;
    this.add(buf, "system", `Timer ${finalName} started: ${reps} every ${fmtInterval(spec.intervalMs)} → ${spec.command}`);
    return true;
  }

  private listTimers(buf: Buffer) {
    const list = this.timers.list();
    if (!list.length) {
      this.add(buf, "system", "No active timers.");
      return;
    }
    this.add(buf, "system", `${list.length} active timer${list.length === 1 ? "" : "s"}:`);
    for (const t of list) {
      const reps = t.repsLeft === Infinity ? "∞" : `${t.repsLeft} left`;
      this.add(buf, "system", `  ${t.name}: ${reps}, every ${fmtInterval(t.intervalMs)} → ${t.command}`);
    }
  }

  /** Run a timer's command in the window it was created in (evaluating $/% at fire time). */
  private fireTimer(command: string, ctx: TimerCtx) {
    const buf =
      this.buffers.find((b) => b.serverId === ctx.serverId && b.name === ctx.bufferName) ??
      this.ensureBuffer(ctx.serverId, "(server)", "server");

    let line = command;
    if (line.includes("$") || line.includes("%")) {
      const data = this.mslData(ctx.serverId, {
        chan: buf.kind === "channel" ? buf.name : "",
        target: buf.name,
        nick: this.ownNick(ctx.serverId),
      });
      try {
        line = this.msl.evalExpr(line, data, this.mslHost(ctx.serverId));
      } catch {
        // fall back to sending the command literally if evaluation fails
      }
    }
    // Swallow send errors (e.g. firing while disconnected) so a timer never
    // produces an unhandled rejection; use `-o` to auto-skip while offline.
    void this.sendInput(line, buf).catch(() => {});
  }

  /** Resolve a network-aware services action into raw command lines and send. */
  private async resolveService(buf: Buffer, action: ServiceAction, args: string[]) {
    const server = this.server(buf.serverId);
    if (!server) return;
    const profile = serviceProfile(server);
    const me = this.ownNick(buf.serverId);

    // Resolve the target channel: an explicit #channel arg wins, else the
    // active channel buffer.
    const chanArgIdx = args.findIndex((a) => this.isChannel(buf.serverId, a));
    const channel =
      chanArgIdx >= 0 ? args[chanArgIdx] : buf.kind === "channel" ? buf.name : undefined;
    const rest = chanArgIdx >= 0 ? args.filter((_, i) => i !== chanArgIdx) : args;
    const needChan = (): string | null => channel ?? null;

    let lines: string[] = [];
    switch (action) {
      case "identify": {
        const [account, password] =
          rest.length >= 2 ? [rest[0], rest.slice(1).join(" ")] : [me, rest[0]];
        lines = profile.identify(account, password);
        this.add(buf, "system", `Identifying to ${profile.label} services…`);
        break;
      }
      case "op":
      case "deop":
      case "voice":
      case "devoice": {
        const ch = needChan();
        if (!ch) return this.add(buf, "error", `/${action} needs a channel.`);
        const nick = rest[0] ?? me;
        lines = profile[action](ch, nick);
        break;
      }
      case "invite": {
        const ch = needChan();
        if (!ch) return this.add(buf, "error", "/invite needs a channel.");
        lines = profile.invite(ch, rest[0]);
        break;
      }
      case "unban": {
        const ch = needChan();
        if (!ch) return this.add(buf, "error", "/unban needs a channel.");
        lines = profile.unban(ch, rest[0]);
        break;
      }
      case "akick": {
        const ch = needChan();
        if (!ch) return this.add(buf, "error", "/akick needs a channel.");
        const sub = (rest[0] ?? "").toLowerCase();
        const mask = rest.slice(1).join(" ");
        if (sub === "add" && mask) lines = profile.akickAdd(ch, mask);
        else if (sub === "del" && mask) lines = profile.akickDel(ch, mask);
        else if (sub === "list") lines = profile.akickList(ch);
        else return this.add(buf, "error", "Usage: /akick <add|del|list> [mask]");
        break;
      }
      case "info": {
        const ch = needChan();
        if (!ch) return this.add(buf, "error", "/csinfo needs a channel.");
        lines = profile.info(ch);
        break;
      }
      case "cs":
        lines = profile.cs(args.join(" "));
        break;
      case "ns":
        lines = profile.ns(args.join(" "));
        break;
      case "ms":
        lines = profile.ms(args.length ? args.join(" ") : null);
        break;
    }

    if (lines.length === 0) {
      this.add(buf, "error", `${profile.label} has no service for /${action}.`);
      return;
    }
    for (const line of lines) await this.raw(buf.serverId, line);
  }

  private async raw(serverId: number, line: string) {
    try {
      await sendRaw(serverId, line);
    } catch (e) {
      this.addServer(serverId, "error", String(e));
    }
  }

  /** /font [size] [name] — set this window's chat font; /font reset clears it.
   *  Works in any window — channel, query, and the server/status window. */
  private setFont(buf: Buffer, arg: string) {
    const a = arg.trim();
    if (!a) {
      // No args → open the font face/size picker for this window.
      this.fontTargetId = buf.id;
      this.fontPickerOpen = true;
      return;
    }
    if (/^(reset|default|off)$/i.test(a)) {
      buf.font = undefined;
      this.persistFont(buf);
      this.add(buf, "system", `Font reset to default for ${buf.name}.`);
      return;
    }
    const toks = a.split(/\s+/);
    const font: BufferFont = { ...(buf.font ?? {}) };
    if (/^\d{1,3}$/.test(toks[0])) {
      font.size = Math.min(72, Math.max(6, parseInt(toks[0], 10)));
      toks.shift();
    }
    if (toks.length) font.family = toks.join(" ");
    buf.font = font;
    this.persistFont(buf);
    this.add(
      buf,
      "system",
      `Font for ${buf.name}: ${font.family ?? "default"}${font.size ? ` ${font.size}px` : ""}.`,
    );
  }

  /** Persist (or clear) a buffer's /font override to localStorage. */
  private persistFont(buf: Buffer) {
    const key = this.fontKey(buf.serverId, buf.name);
    if (buf.font && (buf.font.family || buf.font.size)) this.bufferFonts[key] = buf.font;
    else delete this.bufferFonts[key];
    saveBufferFonts(this.bufferFonts);
  }

  /** The buffer the /font picker is editing (null if none / closed). */
  get fontTarget(): Buffer | null {
    return this.buffers.find((b) => b.id === this.fontTargetId) ?? null;
  }

  /** Apply a font chosen in the picker to the target window (empty family = default). */
  applyPickedFont(family: string, size: number | undefined) {
    const buf = this.fontTarget;
    if (!buf) return;
    const font: BufferFont = {};
    if (family.trim()) font.family = family.trim();
    if (size) font.size = size;
    buf.font = font.family || font.size ? font : undefined;
    this.persistFont(buf);
  }

  private clientCommand(action: string, arg: string | undefined, buf: Buffer) {
    switch (action) {
      case "clear":
        buf.lines = [];
        return;
      case "close":
        this.closeBuffer(buf.id);
        return;
      case "query":
        if (arg) {
          const q = this.ensureBuffer(buf.serverId, arg, "query");
          this.select(q.id);
        }
        return;
      case "scanip":
        this.scanIp(buf, arg ?? "");
        return;
      case "catchup":
        this.aiCatchup(buf, arg);
        return;
      case "analyze":
        this.aiAnalyzeUser(buf, arg);
        return;
      case "gkick":
      case "gban":
        this.globalAction(buf.serverId, action, arg ?? "");
        return;
      case "uptime":
        this.add(buf, "system", `RAVEIRC uptime: ${uptime()}`);
        return;
      case "acronym": {
        const hit = acronym(arg ?? "");
        this.add(buf, "system", hit ? `${arg} = ${hit}` : `No acronym for "${arg}".`);
        return;
      }
      case "chanstats": {
        if (buf.kind !== "channel") return this.add(buf, "error", "Not a channel.");
        this.add(
          buf,
          "system",
          `${buf.name}: ${buf.users.length} users now, peak ${buf.peak ?? buf.users.length} this session.`,
        );
        return;
      }
      case "font":
        return this.setFont(buf, arg ?? "");
      case "scratchpad":
        this.scratchpadOpen = true;
        return;
      case "editor":
        this.scriptEditorOpen = true;
        return;
      case "topicart":
        return this.topicArt(buf, arg);
      case "setkey":
        this.encKey = (arg ?? "").trim();
        this.add(buf, "system", this.encKey ? "Encryption key set for this session." : "Encryption key cleared.");
        return;
      case "enc":
        this.sendEncrypted(buf, arg ?? "");
        return;
      case "help":
        this.add(buf, "system", `RAVEIRC v${this.appVersion || "?"} — mIRC-compatible operator client`);
        this.add(
          buf,
          "system",
          "Commands: /join /part /msg /me /nick /topic /kick /mode /whois /query /clear /close /raw /quit · " +
            "Services: /op /deop /voice /devoice /invite /unban /akick /identify /cs /ns /ms · " +
            "Tools: /scanip /memo /memos /uptime /acronym /chanstats /scratchpad /editor /font · " +
            "Timers: /timer[name] [-mo] <reps> <interval> <cmd> · /timers · /timer<name> off · " +
            "Topic art: /topicart list · /topicart <id> <text> · " +
            "Scripting: aliases-as-$id, hash (/hadd $hget), files ($read /write), sockets (/sockopen $sock) · " +
            "Crypto: /setkey /enc · Ops: /gkick /gban /away /back · " +
            "AI: /catchup [n] /analyze <nick> · " +
            "Keys: Ctrl+B/U/I/K/O/R format · Alt+1-9 windows · Ctrl+Tab cycle · //cmd evaluates",
        );
        return;
    }
  }

  /** Decorative topic designer (RAVE rv.topic.*): wrap text in an art frame and set it. */
  private topicArt(buf: Buffer, arg: string | undefined) {
    if (buf.kind !== "channel") {
      this.add(buf, "error", "Open a channel to design its topic.");
      return;
    }
    const rest = (arg ?? "").trim();
    const sp = rest.indexOf(" ");
    const id = (sp === -1 ? rest : rest.slice(0, sp)).toLowerCase();
    const text = sp === -1 ? "" : rest.slice(sp + 1).trim();

    if (!id || id === "list") {
      this.add(buf, "system", "Topic frames — /topicart <id> <text> (welcome uses the channel name):");
      for (const f of TOPIC_FRAMES) {
        const preview = applyFrame(f, f.id === "welcome" ? buf.name : "…").replace(/\x03\d{1,2}(,\d{1,2})?/g, "");
        this.add(buf, "system", `  ${f.id} (${f.label}): ${preview}`);
      }
      return;
    }

    const frame = getFrame(id);
    if (!frame) {
      this.add(buf, "error", `Unknown topic frame "${id}". Try /topicart list.`);
      return;
    }
    const body = frame.id === "welcome" ? buf.name : text;
    if (!body) {
      this.add(buf, "error", `Usage: /topicart ${frame.id} <text>`);
      return;
    }
    this.raw(buf.serverId, `TOPIC ${buf.name} :${applyFrame(frame, body)}`);
  }

  /** Global kick/ban: act on a nick across every common channel where we're op. */
  private globalAction(serverId: number, action: "gkick" | "gban", rest: string) {
    const parts = rest.split(" ");
    const nick = parts[0];
    const reason = parts.slice(1).join(" ") || "Global removal";
    if (!nick) return;
    const chans = this.comchan(serverId, nick).filter((c) => this.amOp(serverId, c));
    if (chans.length === 0) {
      const b = this.active;
      if (b) this.add(b, "error", `No common channels with ${nick} where you're op.`);
      return;
    }
    for (const chan of chans) {
      if (action === "gban") this.banUser(serverId, chan, nick);
      this.kickUser(serverId, chan, nick, reason);
    }
    const b = this.active;
    if (b) this.add(b, "system", `${action === "gban" ? "Global-banned" : "Global-kicked"} ${nick} from ${chans.length} channel(s).`);
  }

  /** Encrypt and send a message to the active target (AES-GCM, shared key). */
  private async sendEncrypted(buf: Buffer, text: string) {
    if (!this.encKey) return this.add(buf, "error", "Set a key first: /setkey <passphrase>");
    if (buf.kind === "server" || !text.trim()) {
      return this.add(buf, "error", "Usage: /enc <text>  (in a channel or query)");
    }
    const blob = await encryptText(this.encKey, text);
    await sendMessage(buf.serverId, buf.name, blob);
    this.add(buf, "self", `🔒 ${text}`, this.ownNick(buf.serverId));
  }

  /** ScanIP (RAVE-06): search a channel's IAL for nick/host matches. */
  private scanIp(buf: Buffer, pattern: string) {
    const tokens = pattern.split(" ").filter(Boolean);
    let chan = buf.kind === "channel" ? buf.name : undefined;
    let pat = pattern.trim();
    if (tokens.length && this.isChannel(buf.serverId, tokens[0])) {
      chan = tokens[0];
      pat = tokens.slice(1).join(" ");
    }
    if (!chan) return this.add(buf, "error", "/scanip needs a channel.");
    if (!pat) return this.add(buf, "error", "Usage: /scanip [#channel] <pattern>");

    const cbuf = this.buffer(buf.serverId, chan);
    if (!cbuf) return this.add(buf, "error", `Not on ${chan}.`);

    const rx = maskToRegex(pat.includes("*") || pat.includes("?") ? pat : `*${pat}*`);
    const matches = cbuf.users.filter((u) => {
      const addr = `${u.nick}!${u.user ?? "*"}@${u.host ?? "*"}`;
      return rx.test(u.nick) || rx.test(addr);
    });

    this.add(buf, "system", `ScanIP ${chan} "${pat}" — ${matches.length} match(es):`);
    for (const u of matches) {
      this.add(buf, "system", `  ${u.prefix}${u.nick}  (${u.user ?? "?"}@${u.host ?? "?"})`);
    }
  }

  /** Lines worth feeding to the AI as conversation context. */
  private transcriptLines(buf: Buffer): { from?: string; text: string }[] {
    return buf.lines.filter((l) => ["message", "self", "action", "notice"].includes(l.kind));
  }

  /** /catchup — summarize recent activity in the active buffer via local AI. */
  private aiCatchup(buf: Buffer, arg?: string) {
    if (!this.raveConfig.ai.enabled) {
      return this.add(buf, "error", "AI is off. Enable it in Settings → AI.");
    }
    const n = Math.min(Math.max(parseInt(arg ?? "", 10) || 40, 5), 200);
    const recent = this.transcriptLines(buf).slice(-n);
    if (recent.length === 0) return this.add(buf, "system", "Nothing to summarize yet.");
    const transcript = recent.map((l) => `${l.from ?? "*"}: ${stripMirc(l.text)}`).join("\n");
    this.add(buf, "system", `🤖 Summarizing the last ${recent.length} lines…`);
    aiSummarize(buf.name, transcript)
      .then((summary) => {
        this.add(buf, "system", "🤖 Catch-up:");
        for (const line of summary.split("\n")) if (line.trim()) this.add(buf, "system", line);
      })
      .catch((e) => this.add(buf, "error", `AI unavailable: ${e}`));
  }

  /** /analyze <nick> — assess a user's recent behavior via local AI. */
  private aiAnalyzeUser(buf: Buffer, nick?: string) {
    if (!this.raveConfig.ai.enabled) {
      return this.add(buf, "error", "AI is off. Enable it in Settings → AI.");
    }
    if (!nick) return this.add(buf, "error", "Usage: /analyze <nick>");
    const lines = this.transcriptLines(buf).filter((l) => l.from === nick);
    if (lines.length === 0) {
      return this.add(buf, "error", `No recent messages from ${nick} in this buffer.`);
    }
    const transcript = lines.map((l) => stripMirc(l.text)).join("\n");
    this.add(buf, "system", `🤖 Analyzing ${nick}…`);
    aiAnalyze(nick, transcript)
      .then((assessment) => this.add(buf, "system", `🤖 ${nick}: ${assessment}`))
      .catch((e) => this.add(buf, "error", `AI unavailable: ${e}`));
  }

  // ---- selection & buffer mgmt ---------------------------------------------

  select(id: string) {
    this.activeId = id;
    const buf = this.buffers.find((b) => b.id === id);
    if (buf) {
      buf.unread = 0;
      buf.highlight = false;
    }
  }

  closeBuffer(id: string) {
    const buf = this.buffers.find((b) => b.id === id);
    if (!buf) return;
    if (buf.kind === "channel" && buf.joined) {
      this.raw(buf.serverId, `PART ${buf.name}`);
    }
    this.buffers = this.buffers.filter((b) => b.id !== id);
    if (this.activeId === id) {
      this.activeId = this.buffers.find((b) => b.serverId === buf.serverId)?.id ?? this.buffers[0]?.id ?? null;
    }
  }

  disconnectServer(serverId: number) {
    disconnectIrc(serverId, "RAVEIRC");
  }

  /** Close a server window entirely: drop it and all its buffers, then disconnect. */
  closeServer(serverId: number) {
    const s = this.server(serverId);
    const live = !!s && s.status !== "disconnected";
    const wasActiveServer = this.active?.serverId === serverId;
    // Remove from the UI FIRST so the synchronous (web) "disconnected" event is
    // ignored by onEvent's stale-server guard and can't re-create the window.
    this.buffers = this.buffers.filter((b) => b.serverId !== serverId);
    this.servers = this.servers.filter((sv) => sv.id !== serverId);
    if (wasActiveServer || !this.buffers.some((b) => b.id === this.activeId)) {
      this.activeId = this.buffers[0]?.id ?? null;
    }
    if (live) disconnectIrc(serverId, "RAVEIRC");
  }

  /** Clear a buffer's scrollback by id. */
  clearBuffer(id: string) {
    const buf = this.buffers.find((b) => b.id === id);
    if (buf) buf.lines = [];
  }

  /** Leave a channel but keep its window open. */
  leaveChannel(serverId: number, chan: string) {
    this.raw(serverId, `PART ${chan}`);
  }

  /** Re-join a channel we previously parted. */
  rejoinChannel(serverId: number, chan: string) {
    this.raw(serverId, `JOIN ${chan}`);
  }

  // ---- network-aware services shortcuts (Services menu) --------------------

  /** Add a user to a channel access list at a named role, network-aware. */
  svcAccessAdd(serverId: number, chan: string, role: string, target: string) {
    const s = this.server(serverId);
    if (!s) return;
    const net = detectNetwork(s);
    const p = serviceProfile(s);
    const R = role.toUpperCase();
    let cmd: string;
    if (net === "dalnet") {
      cmd = `${R} ${chan} ADD ${target}`; // ChanServ SOP/AOP/VOP/HOP/MANAGER
    } else if (net === "undernet") {
      const lvl = { VOP: 25, HOP: 50, AOP: 100, SOP: 400, MANAGER: 450 }[R] ?? 100;
      cmd = `ADDUSER ${chan} ${target} ${lvl}`; // X bot
    } else {
      cmd = `ACCESS ${chan} ADD ${target} ${R}`; // atheme template role
    }
    for (const line of p.cs(cmd)) this.raw(serverId, line);
  }

  /** Remove a user from a channel access list, network-aware. */
  svcAccessDel(serverId: number, chan: string, role: string, target: string) {
    const s = this.server(serverId);
    if (!s) return;
    const net = detectNetwork(s);
    const p = serviceProfile(s);
    let cmd: string;
    if (net === "dalnet") cmd = `${role.toUpperCase()} ${chan} DEL ${target}`;
    else if (net === "undernet") cmd = `REMUSER ${chan} ${target}`;
    else cmd = `ACCESS ${chan} DEL ${target}`;
    for (const line of p.cs(cmd)) this.raw(serverId, line);
  }

  /** List a channel's access entries, network-aware. */
  svcAccessList(serverId: number, chan: string) {
    const s = this.server(serverId);
    if (!s) return;
    const net = detectNetwork(s);
    const p = serviceProfile(s);
    const cmd =
      net === "dalnet" ? `LISTOPS ${chan}` : net === "undernet" ? `ACCESS ${chan} *` : `FLAGS ${chan}`;
    for (const line of p.cs(cmd)) this.raw(serverId, line);
  }

  /** AKick add/del/list/wipe, network-aware. */
  svcAkick(serverId: number, chan: string, sub: string, mask = "") {
    const s = this.server(serverId);
    if (!s) return;
    const net = detectNetwork(s);
    const p = serviceProfile(s);
    let cmd: string;
    if (net === "undernet" || net === "quakenet") {
      // X/Q use persistent BAN; no wipe — list/add/del
      if (sub === "add") cmd = `BAN ${chan} ${mask}`;
      else if (sub === "del") cmd = `UNBAN ${chan} ${mask}`;
      else cmd = `BANLIST ${chan}`;
    } else {
      cmd = `AKICK ${chan} ${sub.toUpperCase()}${mask ? ` ${mask}` : ""}`;
    }
    for (const line of p.cs(cmd)) this.raw(serverId, line);
  }

  /** Register a channel (you must hold ops). */
  svcRegister(serverId: number, chan: string, password = "") {
    const s = this.server(serverId);
    if (!s) return;
    const net = detectNetwork(s);
    const p = serviceProfile(s);
    if (net === "undernet") {
      this.addServer(serverId, "system", "Undernet channels are registered on cservice.undernet.org (web).");
      return;
    }
    if (net === "quakenet") {
      this.addServer(serverId, "system", "QuakeNet channels are requested via /msg Q REQUESTOWNER (or the website).");
      return;
    }
    const cmd = net === "dalnet" ? `REGISTER ${chan} ${password} RAVEIRC channel` : `REGISTER ${chan}`;
    for (const line of p.cs(cmd)) this.raw(serverId, line);
  }

  /** Mass-deop / mass-kick non-access users (DALnet ChanServ). */
  svcMass(serverId: number, chan: string, kind: "mdeop" | "mkick") {
    const s = this.server(serverId);
    if (!s) return;
    if (detectNetwork(s) !== "dalnet") {
      this.addServer(serverId, "system", `${kind.toUpperCase()} is a DALnet ChanServ feature.`);
      return;
    }
    for (const line of serviceProfile(s).cs(`${kind.toUpperCase()} ${chan}`)) this.raw(serverId, line);
  }

  /** NickServ ghost/regain a nick (network-aware). */
  svcGhost(serverId: number, nick: string, password: string, regain = false) {
    const s = this.server(serverId);
    if (!s) return;
    const net = detectNetwork(s);
    if (net === "undernet" || net === "quakenet") {
      this.addServer(serverId, "system", "This network has no nick ownership (auth via the X/Q bot login).");
      return;
    }
    if (net === "efnet" || net === "ircnet") {
      this.addServer(serverId, "system", `${serviceProfile(s).label} has no nick services.`);
      return;
    }
    const verb = regain && net !== "dalnet" ? "REGAIN" : "GHOST";
    for (const line of serviceProfile(s).ns(`${verb} ${nick} ${password}`.trim())) this.raw(serverId, line);
  }

  // ---- per-user actions (right-click nicklist menu) ------------------------

  whoisUser(serverId: number, nick: string) {
    this.raw(serverId, `WHOIS ${nick}`);
  }

  /** Change our nick on a server. */
  changeNick(serverId: number, nick: string) {
    if (nick.trim()) this.raw(serverId, `NICK ${nick.trim()}`);
  }

  openQuery(serverId: number, nick: string) {
    const q = this.ensureBuffer(serverId, nick, "query");
    this.select(q.id);
  }

  /** Direct channel mode change on a user (e.g. +o, -o, +v). */
  setUserMode(serverId: number, chan: string, add: boolean, mode: string, nick: string) {
    this.raw(serverId, `MODE ${chan} ${add ? "+" : "-"}${mode} ${nick}`);
  }

  kickUser(serverId: number, chan: string, nick: string, reason = "") {
    this.raw(serverId, `KICK ${chan} ${nick}${reason ? ` :${reason}` : ""}`);
  }

  /** Ban a user by host mask (from IAL), falling back to a nick mask. */
  banUser(serverId: number, chan: string, nick: string) {
    const addr = this.address(serverId, chan, nick);
    const hostPart = addr?.split("@")[1];
    const mask = hostPart ? `*!*@${hostPart}` : `${nick}!*@*`;
    this.raw(serverId, `MODE ${chan} +b ${mask}`);
  }

  kickBan(serverId: number, chan: string, nick: string, reason = "") {
    this.banUser(serverId, chan, nick);
    this.kickUser(serverId, chan, nick, reason);
  }

  /** Send a CTCP request (VERSION/PING/etc.) to a nick. */
  ctcpRequest(serverId: number, nick: string, command: string) {
    this.raw(serverId, `PRIVMSG ${nick} :${command}`);
  }

  /** AI: analyze a user's recent messages in a channel buffer. */
  analyzeUser(serverId: number, chan: string, nick: string) {
    const buf = this.buffer(serverId, chan);
    if (buf) this.aiAnalyzeUser(buf, nick);
  }

  /** Buffers belonging to a server, server console first. */
  serverBuffers(serverId: number): Buffer[] {
    return this.buffers
      .filter((b) => b.serverId === serverId)
      .sort((a, b) => {
        if (a.kind === "server") return -1;
        if (b.kind === "server") return 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
  }

  /** All buffers in switchbar order (each server's console then its windows). */
  orderedBuffers(): Buffer[] {
    return this.servers.flatMap((s) => this.serverBuffers(s.id));
  }

  /** Switch to the Nth window (0-based), mIRC Alt+1..9 style. */
  selectByIndex(n: number) {
    const all = this.orderedBuffers();
    if (n >= 0 && n < all.length) this.select(all[n].id);
  }

  /** Cycle to the next/previous window (Ctrl+Tab / Ctrl+Shift+Tab). */
  cycleBuffer(dir: 1 | -1) {
    const all = this.orderedBuffers();
    if (all.length === 0) return;
    const cur = all.findIndex((b) => b.id === this.activeId);
    const next = (cur + dir + all.length) % all.length;
    this.select(all[next].id);
  }
}

export const irc = new IrcStore();
