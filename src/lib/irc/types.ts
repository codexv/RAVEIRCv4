// Shared types for the RAVEIRC frontend.

/** A parsed IRC prefix as sent from the Rust engine. */
export interface Prefix {
  raw: string;
  nick: string | null;
  user: string | null;
  host: string | null;
}

/** A parsed IRC message as sent from the Rust engine. */
export interface IrcMessage {
  tags: Record<string, string>;
  prefix: Prefix | null;
  command: string;
  params: string[];
}

/** Engine events emitted on the `irc-event` Tauri channel (tagged by `kind`). */
export type IrcEvent =
  | { kind: "connecting"; serverId: number; host: string; port: number }
  | { kind: "connected"; serverId: number }
  | { kind: "registered"; serverId: number; nick: string }
  | { kind: "message"; serverId: number; raw: string; message: IrcMessage }
  | { kind: "sent"; serverId: number; raw: string }
  | { kind: "disconnected"; serverId: number; reason: string | null }
  | { kind: "error"; serverId: number; message: string };

/** Connection parameters passed to the `irc_connect` command. */
export interface ServerConfig {
  /** Friendly display name for the tree (saved-server name or network preset). */
  name?: string;
  host: string;
  port: number;
  tls: boolean;
  nick: string;
  username?: string;
  realname?: string;
  password?: string;
  saslAccount?: string;
  saslPassword?: string;
  nickservPassword?: string;
  autoIdentify?: boolean;
  autoGhost?: boolean;
  autoRelease?: boolean;
  altNicks?: string[];
  autojoin?: string[];
}

export type ServerStatus =
  | "connecting"
  | "connected"
  | "registered"
  | "disconnected";

export type BufferKind = "server" | "channel" | "query";

export type LineKind =
  | "message"
  | "self"
  | "echo"
  | "notice"
  | "action"
  | "join"
  | "part"
  | "quit"
  | "nick"
  | "kick"
  | "mode"
  | "topic"
  | "system"
  | "error"
  | "motd";

/** A single rendered line in a buffer. */
export interface Line {
  id: number;
  ts: number;
  kind: LineKind;
  from?: string;
  text: string;
}

/** A user in a channel, with their highest mode prefix and known address (IAL). */
export interface ChanUser {
  nick: string;
  /** Mode prefix character: '~','&','@','%','+' or '' for none. */
  prefix: string;
  /** Username/ident, once known (from JOIN/WHO). */
  user?: string;
  /** Hostname, once known (from JOIN/WHO). The $address/$ial equivalent. */
  host?: string;
}

/** One entry on a channel +b ban list (RPL_BANLIST / observed MODE +b). */
export interface BanEntry {
  mask: string;
  /** Who set it (nick or nick!user@host), when known. */
  by?: string;
  /** Unix seconds when set, when known. */
  ts?: number;
}

/** A buffer = a server console, a channel, or a private query. */
export interface Buffer {
  id: string;
  serverId: number;
  name: string;
  kind: BufferKind;
  lines: Line[];
  users: ChanUser[];
  topic: string;
  unread: number;
  highlight: boolean;
  joined: boolean;
  /** Peak user count seen this session (channel stats). */
  peak?: number;
  /** Per-window font override set with /font (family/size). */
  font?: import("../fonts").BufferFont;
  /** Channel +b ban list — populated on demand by the Channel dialog. */
  bans?: BanEntry[];
  /** True while the ban list is being (re)fetched. */
  bansLoading?: boolean;
  /** Active boolean channel modes (e.g. "nt"), tracked for the Channel dialog. */
  modeFlags?: string;
  /** +k channel key ("" = none). */
  modeKey?: string;
  /** +l user limit (0 = none). */
  modeLimit?: number;
}

export interface Server {
  id: number;
  name: string;
  nick: string;
  status: ServerStatus;
  /** ISUPPORT tokens (e.g. PREFIX, CHANTYPES) gathered from numeric 005. */
  isupport: Record<string, string>;
}
