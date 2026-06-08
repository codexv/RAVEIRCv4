//! CTCP auto-responder — modern rewrite of RAVE-01's CTCP handling.
//!
//! Parses inbound CTCP queries and produces configured replies. Replies are
//! sent as NOTICEs wrapped in `\x01` per the CTCP spec.

use std::time::{SystemTime, UNIX_EPOCH};

use super::config::CtcpConfig;

/// The CTCP delimiter byte.
pub const DELIM: char = '\u{1}';

/// A parsed CTCP query split into command and argument.
pub struct Ctcp<'a> {
    pub command: String,
    pub arg: &'a str,
}

/// Extract a CTCP query from a PRIVMSG payload, if it is one.
/// Returns `None` for normal text or for ACTION (handled as a message).
pub fn parse(payload: &str) -> Option<Ctcp<'_>> {
    let inner = payload.strip_prefix(DELIM)?;
    let inner = inner.strip_suffix(DELIM).unwrap_or(inner);
    if inner.is_empty() {
        return None;
    }
    let (cmd, arg) = match inner.split_once(' ') {
        Some((c, a)) => (c, a),
        None => (inner, ""),
    };
    let command = cmd.to_ascii_uppercase();
    if command == "ACTION" {
        return None;
    }
    Some(Ctcp { command, arg })
}

/// Build the CTCP reply payload (without the `\x01` wrapper) for a query,
/// or `None` if this query type should not be answered.
pub fn reply(cfg: &CtcpConfig, ctcp: &Ctcp) -> Option<String> {
    if !cfg.enabled {
        return None;
    }
    match ctcp.command.as_str() {
        "VERSION" => Some(format!("VERSION {}", cfg.version)),
        "FINGER" => Some(format!("FINGER {}", cfg.finger)),
        "USERINFO" => Some(format!("USERINFO {}", cfg.userinfo)),
        "SOURCE" => Some(format!("SOURCE {}", cfg.source)),
        "PING" if cfg.answer_ping => Some(format!("PING {}", ctcp.arg)),
        "TIME" if cfg.answer_time => Some(format!("TIME {}", utc_now())),
        "CLIENTINFO" if cfg.answer_clientinfo => Some(
            "CLIENTINFO ACTION CLIENTINFO FINGER PING SOURCE TIME USERINFO VERSION".to_string(),
        ),
        _ => None,
    }
}

/// Wrap a reply payload into a full NOTICE line addressed to `nick`.
pub fn notice_line(nick: &str, payload: &str) -> String {
    format!("NOTICE {nick} :{DELIM}{payload}{DELIM}")
}

/// Current UTC time formatted as `YYYY-MM-DD HH:MM:SS UTC`, no dependencies.
fn utc_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (y, mo, d, h, mi, s) = civil_from_unix(secs);
    format!("{y:04}-{mo:02}-{d:02} {h:02}:{mi:02}:{s:02} UTC")
}

/// Convert Unix seconds to (year, month, day, hour, min, sec) in UTC.
/// Uses Howard Hinnant's days-from-civil algorithm.
fn civil_from_unix(secs: u64) -> (i64, u32, u32, u32, u32, u32) {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (h, mi, s) = ((rem / 3600) as u32, ((rem % 3600) / 60) as u32, (rem % 60) as u32);

    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let year = if m <= 2 { y + 1 } else { y };
    (year, m, d, h, mi, s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_version_query() {
        let c = parse("\u{1}VERSION\u{1}").unwrap();
        assert_eq!(c.command, "VERSION");
        assert_eq!(c.arg, "");
    }

    #[test]
    fn parses_ping_with_arg() {
        let c = parse("\u{1}PING 12345\u{1}").unwrap();
        assert_eq!(c.command, "PING");
        assert_eq!(c.arg, "12345");
    }

    #[test]
    fn action_is_not_ctcp_query() {
        assert!(parse("\u{1}ACTION waves\u{1}").is_none());
    }

    #[test]
    fn plain_text_is_not_ctcp() {
        assert!(parse("hello world").is_none());
    }

    #[test]
    fn version_reply_uses_config() {
        let mut cfg = CtcpConfig::default();
        cfg.version = "TestClient 1.0".into();
        let c = parse("\u{1}VERSION\u{1}").unwrap();
        assert_eq!(reply(&cfg, &c).unwrap(), "VERSION TestClient 1.0");
    }

    #[test]
    fn ping_echoes_token() {
        let cfg = CtcpConfig::default();
        let c = parse("\u{1}PING 999\u{1}").unwrap();
        assert_eq!(reply(&cfg, &c).unwrap(), "PING 999");
    }

    #[test]
    fn disabled_returns_nothing() {
        let mut cfg = CtcpConfig::default();
        cfg.enabled = false;
        let c = parse("\u{1}VERSION\u{1}").unwrap();
        assert!(reply(&cfg, &c).is_none());
    }

    #[test]
    fn known_epoch_formats_correctly() {
        // 2021-01-01 00:00:00 UTC = 1609459200
        assert_eq!(civil_from_unix(1_609_459_200), (2021, 1, 1, 0, 0, 0));
    }
}
