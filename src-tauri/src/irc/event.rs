//! Events emitted from the IRC engine to the frontend.
//!
//! All events are emitted under the single Tauri event name [`IRC_EVENT`], with a
//! `kind` discriminator so the frontend can pattern-match a single stream.

use serde::Serialize;

use super::message::Message;

/// The Tauri event channel name the frontend listens on.
pub const IRC_EVENT: &str = "irc-event";

/// A high-level engine event for a particular server connection.
///
/// `rename_all = "camelCase"` renames the variant *names* (the `kind` tag);
/// `rename_all_fields = "camelCase"` is required to also rename the fields
/// inside each struct variant (e.g. `server_id` -> `serverId`) so the frontend
/// receives camelCase keys.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum IrcEvent {
    /// A connection attempt has started.
    Connecting {
        server_id: u64,
        host: String,
        port: u16,
    },
    /// The socket connected (TLS handshake done if applicable); registration begins.
    Connected { server_id: u64 },
    /// Registration completed (numeric 001 received); we have a confirmed nick.
    Registered { server_id: u64, nick: String },
    /// An inbound protocol message was received and parsed.
    Message {
        server_id: u64,
        raw: String,
        message: Message,
    },
    /// A raw line was sent to the server (echo for raw/debug views).
    Sent { server_id: u64, raw: String },
    /// The connection closed, optionally with a reason.
    Disconnected {
        server_id: u64,
        reason: Option<String>,
    },
    /// A non-fatal or fatal error occurred for this server.
    Error { server_id: u64, message: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn struct_variant_fields_are_camelcase() {
        let json = serde_json::to_string(&IrcEvent::Registered {
            server_id: 7,
            nick: "rave".into(),
        })
        .unwrap();
        // The frontend reads `serverId`; the snake_case form must NOT appear.
        assert!(json.contains("\"serverId\":7"), "got: {json}");
        assert!(!json.contains("server_id"), "got: {json}");
        assert!(json.contains("\"kind\":\"registered\""), "got: {json}");
    }
}
