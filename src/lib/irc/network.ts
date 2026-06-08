// Network-aware IRC services layer.
//
// Different networks expose channel/nick services completely differently:
//   - DALnet  : ChanServ/NickServ/MemoServ @services.dal.net, verb-style (OP/AKICK)
//   - Libera  : atheme ChanServ/NickServ, verb-style (OP/FLAGS/AKICK)
//   - Undernet: no ChanServ — everything goes through the "X" bot (login/op/ban)
//
// This module detects the network and produces the correct raw command lines for
// a common set of operator actions. The original RAVE split these across
// RAVE-00 (DALnet) and RAVE-NET (Freenode); here it's one typed abstraction.

import type { Server } from "./types";

export type NetworkId = "dalnet" | "undernet" | "libera" | "generic";

export interface ServiceProfile {
  id: NetworkId;
  label: string;
  /** Whether this network has channel services at all. */
  hasServices: boolean;
  /** Authenticate to nick/account services. */
  identify(account: string, password: string): string[];
  op(channel: string, nick: string): string[];
  deop(channel: string, nick: string): string[];
  voice(channel: string, nick: string): string[];
  devoice(channel: string, nick: string): string[];
  /** Invite self (nick omitted) or another user into a channel. */
  invite(channel: string, nick?: string): string[];
  /** Unban self (target omitted) or a mask/nick. */
  unban(channel: string, target?: string): string[];
  akickAdd(channel: string, mask: string): string[];
  akickDel(channel: string, mask: string): string[];
  akickList(channel: string): string[];
  info(channel: string): string[];
  /** Raw passthrough to ChanServ / NickServ / MemoServ. */
  cs(args: string): string[];
  ns(args: string): string[];
  ms(args: string | null): string[];
}

const privmsg = (target: string, body: string): string => `PRIVMSG ${target} :${body}`;

/** ChanServ/atheme-style profile, parameterized by service targets. */
function athemeStyle(
  id: NetworkId,
  label: string,
  t: { cs: string; ns: string; ms: string },
): ServiceProfile {
  return {
    id,
    label,
    hasServices: true,
    identify: (account, password) =>
      [privmsg(t.ns, `IDENTIFY ${account} ${password}`.trim())],
    op: (c, n) => [privmsg(t.cs, `OP ${c} ${n}`)],
    deop: (c, n) => [privmsg(t.cs, `DEOP ${c} ${n}`)],
    voice: (c, n) => [privmsg(t.cs, `VOICE ${c} ${n}`)],
    devoice: (c, n) => [privmsg(t.cs, `DEVOICE ${c} ${n}`)],
    invite: (c, n) => [n ? `INVITE ${n} ${c}` : privmsg(t.cs, `INVITE ${c}`)],
    unban: (c, target) => [privmsg(t.cs, `UNBAN ${c}${target ? ` ${target}` : ""}`)],
    akickAdd: (c, m) => [privmsg(t.cs, `AKICK ${c} ADD ${m}`)],
    akickDel: (c, m) => [privmsg(t.cs, `AKICK ${c} DEL ${m}`)],
    akickList: (c) => [privmsg(t.cs, `AKICK ${c} LIST`)],
    info: (c) => [privmsg(t.cs, `INFO ${c}`)],
    cs: (args) => [privmsg(t.cs, args)],
    ns: (args) => [privmsg(t.ns, args)],
    ms: (args) => [privmsg(t.ms, args ?? "READ")],
  };
}

const DALNET = athemeStyle("dalnet", "DALnet", {
  cs: "ChanServ@services.dal.net",
  ns: "NickServ@services.dal.net",
  ms: "MemoServ@services.dal.net",
});

const LIBERA = athemeStyle("libera", "Libera.Chat", {
  cs: "ChanServ",
  ns: "NickServ",
  ms: "MemoServ",
});

/** Undernet routes everything through the X bot; no ChanServ/NickServ. */
const UNDERNET_X = "X@channels.undernet.org";
const UNDERNET: ServiceProfile = {
  id: "undernet",
  label: "Undernet",
  hasServices: true,
  identify: (account, password) => [privmsg(UNDERNET_X, `login ${account} ${password}`)],
  op: (c, n) => [privmsg(UNDERNET_X, `op ${c} ${n}`)],
  deop: (c, n) => [privmsg(UNDERNET_X, `deop ${c} ${n}`)],
  voice: (c, n) => [privmsg(UNDERNET_X, `voice ${c} ${n}`)],
  devoice: (c, n) => [privmsg(UNDERNET_X, `devoice ${c} ${n}`)],
  invite: (c, n) => [n ? `INVITE ${n} ${c}` : privmsg(UNDERNET_X, `invite ${c}`)],
  unban: (c, target) => [privmsg(UNDERNET_X, `unban ${c}${target ? ` ${target}` : ""}`)],
  akickAdd: (c, m) => [privmsg(UNDERNET_X, `ban ${c} ${m}`)],
  akickDel: (c, m) => [privmsg(UNDERNET_X, `unban ${c} ${m}`)],
  akickList: (c) => [privmsg(UNDERNET_X, `banlist ${c}`)],
  info: (c) => [privmsg(UNDERNET_X, `chaninfo ${c}`)],
  cs: (args) => [privmsg(UNDERNET_X, args)],
  ns: (args) => [privmsg(UNDERNET_X, args)],
  ms: () => [],
};

/** Generic fallback: plain ChanServ/NickServ, best-effort. */
const GENERIC = athemeStyle("generic", "Generic", {
  cs: "ChanServ",
  ns: "NickServ",
  ms: "MemoServ",
});
GENERIC.id = "generic";
GENERIC.label = "Generic";

const PROFILES: Record<NetworkId, ServiceProfile> = {
  dalnet: DALNET,
  undernet: UNDERNET,
  libera: LIBERA,
  generic: GENERIC,
};

/** Detect the network from ISUPPORT NETWORK token or the server hostname. */
export function detectNetwork(server: Pick<Server, "name" | "isupport">): NetworkId {
  const net = (server.isupport["NETWORK"] ?? "").toLowerCase();
  const host = (server.name ?? "").toLowerCase();
  const hay = `${net} ${host}`;

  if (hay.includes("dalnet") || host.includes("dal.net")) return "dalnet";
  if (hay.includes("undernet")) return "undernet";
  if (hay.includes("libera")) return "libera";
  return "generic";
}

/** Get the service profile for a server. */
export function serviceProfile(server: Pick<Server, "name" | "isupport">): ServiceProfile {
  return PROFILES[detectNetwork(server)];
}
