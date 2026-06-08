// Parse editbox input ("/join #x", plain text, "/me ...") into engine actions.

export type CommandResult =
  | { type: "raw"; lines: string[] }
  | { type: "message"; target: string; text: string }
  | { type: "action"; target: string; text: string }
  | { type: "notice"; target: string; text: string }
  | {
      type: "client";
      action:
        | "clear"
        | "close"
        | "query"
        | "help"
        | "scanip"
        | "catchup"
        | "analyze"
        | "gkick"
        | "gban"
        | "uptime"
        | "acronym"
        | "chanstats"
        | "scratchpad"
        | "editor"
        | "topicart"
        | "setkey"
        | "enc";
      arg?: string;
    }
  | { type: "service"; action: ServiceAction; args: string[] }
  | { type: "error"; message: string }
  | { type: "noop" };

/** Network-aware services actions resolved by the store via the network profile. */
export type ServiceAction =
  | "identify"
  | "op"
  | "deop"
  | "voice"
  | "devoice"
  | "invite"
  | "unban"
  | "akick"
  | "info"
  | "cs"
  | "ns"
  | "ms";

export interface CommandContext {
  /** Whether the active buffer has a live server. */
  connected: boolean;
  /** The active channel/nick, if the active buffer targets one. */
  target?: string;
}

/** Parse a line of editbox input. Lines starting with `/` are commands. */
export function parseInput(input: string, ctx: CommandContext): CommandResult {
  const trimmed = input.replace(/\r?\n$/, "");
  if (trimmed === "") return { type: "noop" };

  // Non-slash => plain message to the active target. (`//` is handled upstream:
  // it evaluates identifiers/variables, mIRC-style, before reaching here.)
  if (!trimmed.startsWith("/")) {
    if (!ctx.target) return { type: "error", message: "No channel or query is active." };
    if (!ctx.connected) return { type: "error", message: "Not connected." };
    return { type: "message", target: ctx.target, text: trimmed };
  }

  const space = trimmed.indexOf(" ");
  const cmd = (space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)).toLowerCase();
  const rest = space === -1 ? "" : trimmed.slice(space + 1);
  const args = rest.length ? rest.split(" ") : [];

  const needConn = (): CommandResult | null =>
    ctx.connected ? null : { type: "error", message: "Not connected." };

  switch (cmd) {
    case "raw":
    case "quote":
      return needConn() ?? { type: "raw", lines: [rest] };

    case "msg":
    case "m": {
      const e = needConn();
      if (e) return e;
      if (args.length < 2) return { type: "error", message: "Usage: /msg <target> <text>" };
      return { type: "message", target: args[0], text: args.slice(1).join(" ") };
    }

    case "notice": {
      const e = needConn();
      if (e) return e;
      if (args.length < 2) return { type: "error", message: "Usage: /notice <target> <text>" };
      return { type: "notice", target: args[0], text: args.slice(1).join(" ") };
    }

    case "me": {
      const e = needConn();
      if (e) return e;
      if (!ctx.target) return { type: "error", message: "No active channel or query." };
      if (!rest) return { type: "error", message: "Usage: /me <action>" };
      return { type: "action", target: ctx.target, text: rest };
    }

    case "say": {
      const e = needConn();
      if (e) return e;
      if (!ctx.target) return { type: "error", message: "No active channel or query." };
      return { type: "message", target: ctx.target, text: rest };
    }

    case "action": {
      const e = needConn();
      if (e) return e;
      if (args.length < 2) return { type: "error", message: "Usage: /action <target> <text>" };
      return { type: "action", target: args[0], text: args.slice(1).join(" ") };
    }

    case "join":
    case "j":
      return (
        needConn() ??
        (args[0]
          ? { type: "raw", lines: [`JOIN ${args.join(" ")}`] }
          : { type: "error", message: "Usage: /join <#channel>" })
      );

    case "part":
    case "leave": {
      const e = needConn();
      if (e) return e;
      const chan = args[0] ?? ctx.target;
      if (!chan) return { type: "error", message: "Usage: /part [#channel] [reason]" };
      const reason = args[0] ? args.slice(1).join(" ") : rest;
      return { type: "raw", lines: [`PART ${chan}${reason ? ` :${reason}` : ""}`] };
    }

    case "nick":
      return (
        needConn() ??
        (args[0]
          ? { type: "raw", lines: [`NICK ${args[0]}`] }
          : { type: "error", message: "Usage: /nick <newnick>" })
      );

    case "topic": {
      const e = needConn();
      if (e) return e;
      if (!ctx.target) return { type: "error", message: "No active channel." };
      return { type: "raw", lines: [rest ? `TOPIC ${ctx.target} :${rest}` : `TOPIC ${ctx.target}`] };
    }

    case "topicart":
    case "topicdesign":
      return needConn() ?? { type: "client", action: "topicart", arg: rest };

    case "kick": {
      const e = needConn();
      if (e) return e;
      if (!ctx.target || !args[0])
        return { type: "error", message: "Usage: /kick <nick> [reason]" };
      const reason = args.slice(1).join(" ");
      return { type: "raw", lines: [`KICK ${ctx.target} ${args[0]}${reason ? ` :${reason}` : ""}`] };
    }

    case "mode":
      return (
        needConn() ??
        (args.length
          ? { type: "raw", lines: [`MODE ${rest}`] }
          : { type: "error", message: "Usage: /mode <target> <modes>" })
      );

    case "whois":
      return (
        needConn() ??
        (args[0]
          ? { type: "raw", lines: [`WHOIS ${args[0]}`] }
          : { type: "error", message: "Usage: /whois <nick>" })
      );

    case "names":
      return needConn() ?? { type: "raw", lines: [`NAMES ${args[0] ?? ctx.target ?? ""}`] };

    case "query":
    case "q":
      return args[0]
        ? { type: "client", action: "query", arg: args[0] }
        : { type: "error", message: "Usage: /query <nick>" };

    case "uptime":
      return { type: "client", action: "uptime" };
    case "acronym":
    case "ac":
      return args[0]
        ? { type: "client", action: "acronym", arg: args[0] }
        : { type: "error", message: "Usage: /acronym <term>" };
    case "chanstats":
    case "stats":
      return { type: "client", action: "chanstats" };
    case "scratchpad":
    case "notes":
      return { type: "client", action: "scratchpad" };
    case "editor":
    case "aliases":
    case "remote":
      return { type: "client", action: "editor" };
    case "setkey":
      return args[0]
        ? { type: "client", action: "setkey", arg: rest }
        : { type: "error", message: "Usage: /setkey <passphrase>  (blank clears)" };
    case "enc":
    case "encrypt":
      return needConn() ?? { type: "client", action: "enc", arg: rest };

    case "clear":
      return { type: "client", action: "clear" };

    case "close":
    case "wc":
      return { type: "client", action: "close" };

    case "help":
      return { type: "client", action: "help" };

    case "quit":
      return needConn() ?? { type: "raw", lines: [`QUIT${rest ? ` :${rest}` : ""}`] };

    // ---- network-aware services (resolved by the store via the net profile) ----
    case "identify":
    case "id":
      return (
        needConn() ??
        (args.length
          ? { type: "service", action: "identify", args }
          : { type: "error", message: "Usage: /identify [account] <password>" })
      );

    case "op":
    case "deop":
    case "voice":
    case "devoice":
      return needConn() ?? { type: "service", action: cmd as ServiceAction, args };

    case "invite":
      return needConn() ?? { type: "service", action: "invite", args };

    case "unban":
      return needConn() ?? { type: "service", action: "unban", args };

    case "akick":
      return (
        needConn() ??
        (args[0]
          ? { type: "service", action: "akick", args }
          : { type: "error", message: "Usage: /akick <add|del|list> [mask]" })
      );

    case "cs":
    case "chanserv":
      return needConn() ?? { type: "service", action: "cs", args };
    case "ns":
    case "nickserv":
      return needConn() ?? { type: "service", action: "ns", args };
    case "ms":
    case "memoserv":
      return needConn() ?? { type: "service", action: "ms", args };
    case "csinfo":
      return needConn() ?? { type: "service", action: "info", args };

    case "memo":
      return (
        needConn() ??
        (args.length >= 2
          ? { type: "service", action: "ms", args: ["SEND", ...args] }
          : { type: "error", message: "Usage: /memo <nick> <message>" })
      );
    case "memos":
      return needConn() ?? { type: "service", action: "ms", args: ["LIST"] };

    case "scanip":
    case "scan":
      return rest
        ? { type: "client", action: "scanip", arg: rest }
        : { type: "error", message: "Usage: /scanip [#channel] <pattern>" };

    case "away":
      return needConn() ?? { type: "raw", lines: [`AWAY${rest ? ` :${rest}` : ""}`] };
    case "back":
      return needConn() ?? { type: "raw", lines: ["AWAY"] };

    case "gkick":
      return (
        needConn() ??
        (args[0]
          ? { type: "client", action: "gkick", arg: rest }
          : { type: "error", message: "Usage: /gkick <nick> [reason]" })
      );
    case "gban":
      return (
        needConn() ??
        (args[0]
          ? { type: "client", action: "gban", arg: rest }
          : { type: "error", message: "Usage: /gban <nick> [reason]" })
      );

    case "catchup":
      return { type: "client", action: "catchup", arg: rest };
    case "analyze":
      return args[0]
        ? { type: "client", action: "analyze", arg: args[0] }
        : { type: "error", message: "Usage: /analyze <nick>" };

    default:
      // Unknown slash command -> pass through as raw (mIRC-like behaviour).
      return needConn() ?? { type: "raw", lines: [`${cmd.toUpperCase()} ${rest}`.trim()] };
  }
}
