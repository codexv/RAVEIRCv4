// Frontend mirror of the Rust RaveConfig, plus load/save helpers and defaults.

import { invoke } from "@tauri-apps/api/core";

export interface CtcpConfig {
  enabled: boolean;
  version: string;
  finger: string;
  userinfo: string;
  source: string;
  answerPing: boolean;
  answerTime: boolean;
  answerClientinfo: boolean;
}

export interface BadwordConfig {
  enabled: boolean;
  words: string[];
  ban: boolean;
  reason: string;
}

export interface CloneConfig {
  enabled: boolean;
  limit: number;
  ban: boolean;
  reason: string;
}

export interface FloodConfig {
  enabled: boolean;
  lines: number;
  seconds: number;
  ban: boolean;
  reason: string;
}

export interface CapsConfig {
  enabled: boolean;
  percent: number;
  minLength: number;
  ban: boolean;
  reason: string;
}
export interface LengthConfig {
  enabled: boolean;
  max: number;
  ban: boolean;
  reason: string;
}
export interface CtcpFloodConfig {
  enabled: boolean;
  count: number;
  seconds: number;
  ban: boolean;
  reason: string;
}
export interface RaidConfig {
  enabled: boolean;
  joins: number;
  seconds: number;
  lockMode: string;
  unlockMinutes: number;
}
export interface TricksConfig {
  enabled: boolean;
  ban: boolean;
  reason: string;
}

export interface ProtectionsConfig {
  badword: BadwordConfig;
  clone: CloneConfig;
  flood: FloodConfig;
  friends: string[];
  autoOpFriends: boolean;
  banMinutes: number;
  caps: CapsConfig;
  length: LengthConfig;
  ctcpFlood: CtcpFloodConfig;
  raid: RaidConfig;
  tricks: TricksConfig;
  autoRejoin: boolean;
  autoOp: string[];
  autoVoice: string[];
}

export interface PmGuardConfig {
  enabled: boolean;
  blockAdverts: boolean;
  blockWorms: boolean;
  repeatLimit: number;
  knownOnly: boolean;
}

export interface AntiSpamConfig {
  enabled: boolean;
  blockAdverts: boolean;
  repeatLimit: number;
  ban: boolean;
  reason: string;
}

export interface AiConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  moderate: boolean;
  autoEnforce: boolean;
  ban: boolean;
  minSeverity: number;
}

export interface RaveConfig {
  ctcp: CtcpConfig;
  /** Global default protections (fallback for channels without an override). */
  protections: ProtectionsConfig;
  /** Per-channel protection overrides, keyed by "network/#channel". */
  channelProtections: Record<string, ProtectionsConfig>;
  antispam: AntiSpamConfig;
  secureQuery: boolean;
  pm: PmGuardConfig;
  notify: string[];
  logging: boolean;
  ai: AiConfig;
  scripts: ScriptsConfig;
}

export interface ScriptsConfig {
  aliases: string;
  remote: string;
  variables: string;
}

/** AI moderation verdict from the local model. */
export interface Verdict {
  flag: boolean;
  category: string;
  severity: number;
  reason: string;
}

/** Availability of the local Ollama backend. */
export interface AiStatus {
  available: boolean;
  modelPresent: boolean;
  models: string[];
  error: string | null;
}

/** The built-in RAVE WHOIS reformat shipped in the Remote editor by default. */
export const DEFAULT_REMOTE = `; ═══ RAVE WHOIS ═══  (classic RAVE whois art — edit freely)
raw 311:*:{
  echo -a
  echo -a $chr(3) $+ 15 ---------------$chr(3) $+ 15[ $chr(3) $+ 3 RAVE Whois Report $chr(3) $+ 15 ]---------------
  echo -a $chr(2) $+ $chr(3) $+ 15 Whois On $+ $chr(2) $+ : $+ $chr(3) $+ 4 $2 $+ $chr(3) $+ 15 ( $+ $3 $+ @ $+ $4 $+ )
  echo -a $chr(3) $+ 15 Real Name: $+ $chr(3) $+ 15 $6-
  haltdef
}
raw 307:*:{ echo -a $chr(3) $+ 15 NickServ: $+ $chr(3) $+ 4 $2 $+ $chr(3) $+ 15 has identified for this nick | haltdef }
raw 275:*:{ echo -a $chr(3) $+ 15 Connection: $+ $chr(3) $+ 14 Using a secure connection (SSL) | haltdef }
raw 671:*:{ echo -a $chr(3) $+ 15 Connection: $+ $chr(3) $+ 14 Using a secure connection (SSL) | haltdef }
raw 308:*:{ echo -a $chr(3) $+ 15 Service Agent: $+ $chr(3) $+ 4 $3- | haltdef }
raw 319:*:{ echo -a $chr(3) $+ 15 Channels: $+ $chr(3) $+ 15 $3- | haltdef }
raw 312:*:{ echo -a $chr(3) $+ 15 Server: $+ $chr(3) $+ 14 $3 - $4- | haltdef }
raw 317:*:{
  echo -a $chr(3) $+ 15 Idle Time: $+ $chr(3) $+ 14 $duration($3)
  echo -a $chr(3) $+ 15 SignOn: $+ $chr(3) $+ 15 $asctime($4,dddd) $+ , $asctime($4,mmmm doo) $+ , $asctime($4,yyyy) at $asctime($4,h:nn TT)
  haltdef
}
raw 330:*:{ echo -a $chr(3) $+ 15 Account: $+ $chr(3) $+ 4 $3 | haltdef }
raw 313:*:{ echo -a $chr(3) $+ 15 IRC Oper: $+ $chr(3) $+ 4 Yes | haltdef }
raw 378:*:{ echo -a $chr(3) $+ 15 Connecting from: $6- | haltdef }
raw 379:*:{ echo -a $chr(3) $+ 15 Modes: $2- | haltdef }
raw 301:*:{ echo -a $chr(3) $+ 15 Away: $+ $chr(3) $+ 7 $3- | haltdef }
raw 318:*:{
  echo -a $chr(3) $+ 15 ---------------$chr(3) $+ 15[ $chr(3) $+ 3 End of Whois Report $chr(3) $+ 15 ]---------------
  echo -a
  haltdef
}
`;

/** Defaults mirroring the Rust \`RaveConfig::default()\` (used before load). */
export function defaultRaveConfig(): RaveConfig {
  return {
    ctcp: {
      enabled: true,
      version: "RAVEIRC",
      finger: "RAVEIRC user",
      userinfo: "RAVEIRC",
      source: "https://rave.coders.ph",
      answerPing: true,
      answerTime: true,
      answerClientinfo: true,
    },
    protections: {
      badword: { enabled: false, words: [], ban: false, reason: "Watch your language" },
      clone: { enabled: false, limit: 3, ban: false, reason: "Too many clones" },
      flood: { enabled: false, lines: 5, seconds: 3, ban: false, reason: "Stop flooding" },
      friends: [],
      autoOpFriends: false,
      banMinutes: 0,
      caps: { enabled: false, percent: 70, minLength: 10, ban: false, reason: "Stop SHOUTING" },
      length: { enabled: false, max: 400, ban: false, reason: "Line too long" },
      ctcpFlood: { enabled: false, count: 3, seconds: 5, ban: false, reason: "CTCP flood" },
      raid: { enabled: false, joins: 5, seconds: 8, lockMode: "+i", unlockMinutes: 5 },
      tricks: { enabled: false, ban: true, reason: "Exploit attempt" },
      autoRejoin: false,
      autoOp: [],
      autoVoice: [],
    },
    channelProtections: {},
    antispam: { enabled: false, blockAdverts: true, repeatLimit: 3, ban: false, reason: "No spam" },
    secureQuery: false,
    pm: { enabled: false, blockAdverts: true, blockWorms: true, repeatLimit: 4, knownOnly: false },
    notify: [],
    logging: false,
    scripts: { aliases: "", remote: DEFAULT_REMOTE, variables: "" },
    ai: {
      enabled: false,
      endpoint: "http://localhost:11434",
      model: "qwen2.5:1.5b",
      moderate: true,
      autoEnforce: false,
      ban: false,
      minSeverity: 4,
    },
  };
}

/** Key for a channel's protection override: "network/#channel" (lowercased). */
export function channelKey(network: string, channel: string): string {
  return `${network}/${channel.toLowerCase()}`;
}

export async function loadRaveConfig(): Promise<RaveConfig> {
  return await invoke<RaveConfig>("rave_get_config");
}

export async function saveRaveConfig(config: RaveConfig): Promise<void> {
  await invoke("rave_set_config", { config });
}

// ---- AI co-pilot bridge (local Ollama) -------------------------------------

export async function aiStatus(): Promise<AiStatus> {
  return await invoke<AiStatus>("ai_status");
}

export async function aiModerate(
  channel: string,
  nick: string,
  message: string,
): Promise<Verdict> {
  return await invoke<Verdict>("ai_moderate", { channel, nick, message });
}

export async function aiSummarize(channel: string, transcript: string): Promise<string> {
  return await invoke<string>("ai_summarize", { channel, transcript });
}

export async function aiAnalyze(nick: string, transcript: string): Promise<string> {
  return await invoke<string>("ai_analyze", { nick, transcript });
}
