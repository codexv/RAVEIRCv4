//! Configuration for the native RAVE modules.
//!
//! This is the modern replacement for RAVE's scattered `vars.ini` / `%variable`
//! state: a single typed, serializable config tree, editable from the UI and
//! shared (behind an `RwLock`) with every server connection.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// Root config for all RAVE modules. Extended as modules are ported.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RaveConfig {
    pub ctcp: CtcpConfig,
    /// Global default channel protections (used by channels without an override).
    pub protections: ProtectionsConfig,
    /// Per-channel protection overrides, keyed by "network/#channel".
    pub channel_protections: HashMap<String, ProtectionsConfig>,
    pub antispam: AntiSpamConfig,
    /// Secure Query (RAVE-07): warn on private messages from unknown senders
    /// (not a friend, no shared channel).
    pub secure_query: bool,
    pub pm: PmGuardConfig,
    /// Notify/watch list: nicks to alert on when they come online (MONITOR).
    pub notify: Vec<String>,
    /// Write channel/query logs to disk.
    pub logging: bool,
    pub ai: AiConfig,
    /// User mSL scripts (mIRC-compatible): aliases, remote (events), variables.
    pub scripts: ScriptsConfig,
}

/// User scripting sections (mIRC-style aliases / remote / variables).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ScriptsConfig {
    pub aliases: String,
    pub remote: String,
    pub variables: String,
}

impl Default for ScriptsConfig {
    fn default() -> Self {
        Self {
            aliases: String::new(),
            remote: DEFAULT_REMOTE.to_string(),
            variables: String::new(),
        }
    }
}

/// Built-in RAVE WHOIS reformat shipped in the Remote editor by default.
const DEFAULT_REMOTE: &str = r#"; ═══ RAVE WHOIS ═══  (classic RAVE whois art — edit freely)
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
"#;

/// Private-message guard (RAVE mega.pvt.*): filter spam/ads/worms in queries.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PmGuardConfig {
    pub enabled: bool,
    /// Drop private messages containing advert URLs / channel invites.
    pub block_adverts: bool,
    /// Drop private messages containing exploit/decode-worm payloads.
    pub block_worms: bool,
    /// Drop after this many repeated identical PMs from one sender.
    pub repeat_limit: u32,
    /// Only accept PMs from friends or people sharing a channel.
    pub known_only: bool,
}
impl Default for PmGuardConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            block_adverts: true,
            block_worms: true,
            repeat_limit: 4,
            known_only: false,
        }
    }
}

/// Local-first AI co-pilot settings (Ollama). Off until the user opts in.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AiConfig {
    /// Master switch for all AI features.
    pub enabled: bool,
    /// Ollama base URL (local by default — nothing leaves the machine).
    pub endpoint: String,
    /// Model name (must be pulled in Ollama). Defaults to a lightweight model
    /// well-suited to short-message classification; swappable for a larger one.
    pub model: String,
    /// Run AI moderation on channel messages.
    pub moderate: bool,
    /// Act (kick/ban) on AI flags. When false, flags are surfaced only.
    pub auto_enforce: bool,
    /// Add a +b ban when auto-enforcing.
    pub ban: bool,
    /// Minimum severity (1-5) required to flag/act.
    pub min_severity: u8,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            endpoint: "http://localhost:11434".to_string(),
            // Lightweight (~1 GB), best quality-per-size for JSON classification.
            model: "qwen2.5:1.5b".to_string(),
            moderate: true,
            auto_enforce: false,
            ban: false,
            min_severity: 4,
        }
    }
}

/// Channel protection settings (RAVE-02/03). Acted on by the frontend, which
/// holds live channel/IAL state. All auto-kick behaviour is opt-in (off).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ProtectionsConfig {
    pub badword: BadwordConfig,
    pub clone: CloneConfig,
    pub flood: FloodConfig,
    /// Nicks or hostmasks exempt from all protections.
    pub friends: Vec<String>,
    /// Auto-op friends when they join a channel you have ops in.
    pub auto_op_friends: bool,
    /// Auto-remove protection bans after this many minutes (0 = permanent).
    pub ban_minutes: u32,
    pub caps: CapsConfig,
    pub length: LengthConfig,
    pub ctcp_flood: CtcpFloodConfig,
    pub raid: RaidConfig,
    pub tricks: TricksConfig,
    /// Auto-rejoin a channel after being kicked.
    pub auto_rejoin: bool,
    /// Nicks/masks to auto-op when they join (you must hold ops).
    pub auto_op: Vec<String>,
    /// Nicks/masks to auto-voice when they join.
    pub auto_voice: Vec<String>,
}

/// Excessive-capitals kick.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CapsConfig {
    pub enabled: bool,
    /// Percent of letters that must be uppercase to trigger (0-100).
    pub percent: u8,
    /// Ignore lines shorter than this.
    pub min_length: u32,
    pub ban: bool,
    pub reason: String,
}
impl Default for CapsConfig {
    fn default() -> Self {
        Self { enabled: false, percent: 70, min_length: 10, ban: false, reason: "Stop SHOUTING".into() }
    }
}

/// Over-long line kick.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LengthConfig {
    pub enabled: bool,
    pub max: u32,
    pub ban: bool,
    pub reason: String,
}
impl Default for LengthConfig {
    fn default() -> Self {
        Self { enabled: false, max: 400, ban: false, reason: "Line too long".into() }
    }
}

/// CTCP-flood kick (too many CTCPs from one user in a window).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CtcpFloodConfig {
    pub enabled: bool,
    pub count: u32,
    pub seconds: u32,
    pub ban: bool,
    pub reason: String,
}
impl Default for CtcpFloodConfig {
    fn default() -> Self {
        Self { enabled: false, count: 3, seconds: 5, ban: false, reason: "CTCP flood".into() }
    }
}

/// Join-flood / raid detection with channel lockdown.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RaidConfig {
    pub enabled: bool,
    /// Joins within `seconds` that trigger lockdown.
    pub joins: u32,
    pub seconds: u32,
    /// Mode to set on the channel during a raid (e.g. "+i" or "+mi").
    pub lock_mode: String,
    /// Auto-clear the lock after this many minutes (0 = manual).
    pub unlock_minutes: u32,
}
impl Default for RaidConfig {
    fn default() -> Self {
        Self { enabled: false, joins: 5, seconds: 8, lock_mode: "+i".into(), unlock_minutes: 5 }
    }
}

/// Anti-trick: block known mIRC crash/exploit and decode-worm payloads.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TricksConfig {
    pub enabled: bool,
    pub ban: bool,
    pub reason: String,
}
impl Default for TricksConfig {
    fn default() -> Self {
        Self { enabled: false, ban: true, reason: "Exploit attempt".into() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BadwordConfig {
    pub enabled: bool,
    pub words: Vec<String>,
    pub ban: bool,
    pub reason: String,
}

impl Default for BadwordConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            words: vec![],
            ban: false,
            reason: "Watch your language".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CloneConfig {
    pub enabled: bool,
    /// Maximum allowed connections from the same host in one channel.
    pub limit: u32,
    pub ban: bool,
    pub reason: String,
}

impl Default for CloneConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            limit: 3,
            ban: false,
            reason: "Too many clones".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FloodConfig {
    pub enabled: bool,
    /// Number of lines within `seconds` that counts as flooding.
    pub lines: u32,
    pub seconds: u32,
    pub ban: bool,
    pub reason: String,
}

impl Default for FloodConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            lines: 5,
            seconds: 3,
            ban: false,
            reason: "Stop flooding".to_string(),
        }
    }
}

/// AntiSpam settings (RAVE-05). Acted on by the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AntiSpamConfig {
    pub enabled: bool,
    /// Kick on advertised URLs / channel invites in messages.
    pub block_adverts: bool,
    /// Repeated identical-message threshold before acting.
    pub repeat_limit: u32,
    pub ban: bool,
    pub reason: String,
}

impl Default for AntiSpamConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            block_adverts: true,
            repeat_limit: 3,
            ban: false,
            reason: "No spam".to_string(),
        }
    }
}

/// CTCP auto-responder config (modern rewrite of RAVE-01's hardcoded replies).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CtcpConfig {
    /// Master switch for automatic CTCP replies.
    pub enabled: bool,
    /// VERSION reply text (the part after "VERSION ").
    pub version: String,
    /// FINGER reply text.
    pub finger: String,
    /// USERINFO reply text.
    pub userinfo: String,
    /// SOURCE reply text.
    pub source: String,
    /// Reply to CTCP PING (lag measurement) requests.
    pub answer_ping: bool,
    /// Reply to CTCP TIME requests with local time.
    pub answer_time: bool,
    /// Reply to CTCP CLIENTINFO with the supported command list.
    pub answer_clientinfo: bool,
}

impl Default for CtcpConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            version: format!("RAVEIRC v{} — cross-platform IRC", env!("CARGO_PKG_VERSION")),
            finger: "RAVEIRC user".to_string(),
            userinfo: "RAVEIRC — https://rave.coders.ph".to_string(),
            source: "https://rave.coders.ph".to_string(),
            answer_ping: true,
            answer_time: true,
            answer_clientinfo: true,
        }
    }
}
