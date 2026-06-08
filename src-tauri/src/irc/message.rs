//! IRC protocol message parsing (RFC 1459/2812 + IRCv3 message tags).
//!
//! Wire format:
//! ```text
//! ['@' tags SPACE] [':' prefix SPACE] command *[SPACE param] [SPACE ':' trailing] CRLF
//! ```

use std::collections::HashMap;

use serde::Serialize;

/// The source prefix of a message (`:nick!user@host` or `:server.name`).
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
pub struct Prefix {
    /// The raw prefix string as received (without the leading `:`).
    pub raw: String,
    /// Nickname, if the prefix is a user prefix.
    pub nick: Option<String>,
    /// Username/ident, if present.
    pub user: Option<String>,
    /// Hostname, if present.
    pub host: Option<String>,
}

impl Prefix {
    /// Parse a prefix string (the part after `:` and before the command).
    fn parse(raw: &str) -> Self {
        // user prefix: nick!user@host  |  nick@host  |  nick  |  server.name
        let mut prefix = Prefix {
            raw: raw.to_string(),
            ..Default::default()
        };

        // Split host off first (everything after '@').
        let (name_user, host) = match raw.split_once('@') {
            Some((nu, h)) => (nu, Some(h.to_string())),
            None => (raw, None),
        };

        let (nick, user) = match name_user.split_once('!') {
            Some((n, u)) => (n.to_string(), Some(u.to_string())),
            None => (name_user.to_string(), None),
        };

        // Heuristic: a bare token containing a '.' and no '!'/'@' is a server name.
        if user.is_none() && host.is_none() && nick.contains('.') {
            // Treat as server; leave nick/user/host empty.
            return prefix;
        }

        prefix.nick = if nick.is_empty() { None } else { Some(nick) };
        prefix.user = user;
        prefix.host = host;
        prefix
    }

    /// The best display name for this source (nick if present, else raw).
    #[allow(dead_code)] // used by upcoming RAVE modules
    pub fn name(&self) -> &str {
        self.nick.as_deref().unwrap_or(&self.raw)
    }
}

/// A fully parsed IRC message.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Message {
    /// IRCv3 message tags (`@key=value;key2`).
    pub tags: HashMap<String, String>,
    /// Source prefix, if present.
    pub prefix: Option<Prefix>,
    /// The command or three-digit numeric (uppercased for commands).
    pub command: String,
    /// Command parameters, with the trailing parameter included as the last element.
    pub params: Vec<String>,
}

impl Message {
    /// Parse a single line (without the trailing CRLF) into a [`Message`].
    ///
    /// Returns `None` only for an empty/whitespace-only line.
    pub fn parse(line: &str) -> Option<Message> {
        let mut rest = line.trim_end_matches(['\r', '\n']).trim_start();
        if rest.is_empty() {
            return None;
        }

        // 1. Tags
        let mut tags = HashMap::new();
        if let Some(stripped) = rest.strip_prefix('@') {
            let (tag_str, after) = split_once_space(stripped);
            for tag in tag_str.split(';') {
                if tag.is_empty() {
                    continue;
                }
                match tag.split_once('=') {
                    Some((k, v)) => {
                        tags.insert(k.to_string(), unescape_tag(v));
                    }
                    None => {
                        tags.insert(tag.to_string(), String::new());
                    }
                }
            }
            rest = after.trim_start();
        }

        // 2. Prefix
        let mut prefix = None;
        if let Some(stripped) = rest.strip_prefix(':') {
            let (pfx, after) = split_once_space(stripped);
            prefix = Some(Prefix::parse(pfx));
            rest = after.trim_start();
        }

        // 3. Command
        let (command, after) = split_once_space(rest);
        if command.is_empty() {
            return None;
        }
        // Numerics stay as-is; textual commands are uppercased for stable matching.
        let command = if command.chars().all(|c| c.is_ascii_digit()) {
            command.to_string()
        } else {
            command.to_ascii_uppercase()
        };
        rest = after;

        // 4. Params
        let mut params = Vec::new();
        loop {
            rest = rest.trim_start_matches(' ');
            if rest.is_empty() {
                break;
            }
            if let Some(trailing) = rest.strip_prefix(':') {
                params.push(trailing.to_string());
                break;
            }
            let (param, after) = split_once_space(rest);
            params.push(param.to_string());
            rest = after;
        }

        Some(Message {
            tags,
            prefix,
            command,
            params,
        })
    }

    /// Convenience accessor for parameter `idx` (0-based).
    pub fn param(&self, idx: usize) -> Option<&str> {
        self.params.get(idx).map(|s| s.as_str())
    }

    /// The trailing (last) parameter, commonly the message text.
    pub fn trailing(&self) -> Option<&str> {
        self.params.last().map(|s| s.as_str())
    }

    /// The source nickname, if this came from a user.
    pub fn nick(&self) -> Option<&str> {
        self.prefix.as_ref().and_then(|p| p.nick.as_deref())
    }
}

/// Split a string at the first space into (head, tail). Tail excludes the space.
fn split_once_space(s: &str) -> (&str, &str) {
    match s.find(' ') {
        Some(i) => (&s[..i], &s[i + 1..]),
        None => (s, ""),
    }
}

/// Unescape an IRCv3 tag value per the message-tags spec.
fn unescape_tag(v: &str) -> String {
    let mut out = String::with_capacity(v.len());
    let mut chars = v.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some(':') => out.push(';'),
                Some('s') => out.push(' '),
                Some('\\') => out.push('\\'),
                Some('r') => out.push('\r'),
                Some('n') => out.push('\n'),
                Some(other) => out.push(other),
                None => {}
            }
        } else {
            out.push(c);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_simple_privmsg() {
        let m = Message::parse(":nick!user@host.com PRIVMSG #chan :hello world").unwrap();
        assert_eq!(m.command, "PRIVMSG");
        assert_eq!(m.param(0), Some("#chan"));
        assert_eq!(m.trailing(), Some("hello world"));
        let p = m.prefix.unwrap();
        assert_eq!(p.nick.as_deref(), Some("nick"));
        assert_eq!(p.user.as_deref(), Some("user"));
        assert_eq!(p.host.as_deref(), Some("host.com"));
    }

    #[test]
    fn parses_server_prefix() {
        let m = Message::parse(":irc.dal.net 001 mynick :Welcome").unwrap();
        assert_eq!(m.command, "001");
        assert_eq!(m.param(0), Some("mynick"));
        let p = m.prefix.unwrap();
        assert!(p.nick.is_none());
        assert_eq!(p.raw, "irc.dal.net");
    }

    #[test]
    fn parses_tags() {
        let m =
            Message::parse("@time=2026-01-01T00:00:00.000Z;account=bob :bob!b@h PRIVMSG #c :hi")
                .unwrap();
        assert_eq!(m.tags.get("account").map(String::as_str), Some("bob"));
        assert_eq!(m.command, "PRIVMSG");
        assert_eq!(m.trailing(), Some("hi"));
    }

    #[test]
    fn parses_ping_no_prefix() {
        let m = Message::parse("PING :12345").unwrap();
        assert_eq!(m.command, "PING");
        assert_eq!(m.trailing(), Some("12345"));
        assert!(m.prefix.is_none());
    }

    #[test]
    fn unescapes_tag_values() {
        let m = Message::parse(r"@msg=a\sb\:c PING x").unwrap();
        assert_eq!(m.tags.get("msg").map(String::as_str), Some("a b;c"));
    }

    #[test]
    fn empty_line_is_none() {
        assert!(Message::parse("   ").is_none());
    }
}
