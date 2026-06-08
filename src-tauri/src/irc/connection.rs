//! A single IRC server connection: TCP/TLS transport, registration handshake,
//! automatic PING/PONG, and SASL PLAIN authentication.

use std::sync::Arc;

use base64::Engine as _;
use parking_lot::RwLock;
use serde::Deserialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio_rustls::TlsConnector;

use super::event::{IrcEvent, IRC_EVENT};
use super::message::Message;
use crate::rave::{ctcp, RaveConfig};

/// Connection parameters supplied by the frontend.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub tls: bool,
    pub nick: String,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub realname: Option<String>,
    /// Server password (PASS).
    #[serde(default)]
    pub password: Option<String>,
    /// SASL account name (defaults to nick if SASL password is set).
    #[serde(default)]
    pub sasl_account: Option<String>,
    /// SASL password; enables SASL PLAIN when present.
    #[serde(default)]
    pub sasl_password: Option<String>,
    /// NickServ password for auto-identify on connect (non-SASL).
    #[serde(default)]
    pub nickserv_password: Option<String>,
    /// Auto-identify to services on connect (needs nickserv_password). Default on.
    #[serde(default = "default_true")]
    pub auto_identify: bool,
    /// Auto ghost/regain our nick if it's in use (needs nickserv_password).
    #[serde(default)]
    pub auto_ghost: bool,
    /// Auto-RELEASE a held nick on login, then reclaim it (needs nickserv_password).
    #[serde(default)]
    pub auto_release: bool,
    /// Alternate nicks to try if the primary is taken.
    #[serde(default)]
    pub alt_nicks: Vec<String>,
    /// Channels to auto-join after registration.
    #[serde(default)]
    pub autojoin: Vec<String>,
}

/// Detect the network family from a server hostname (for services routing).
fn network_of(host: &str) -> &'static str {
    let h = host.to_ascii_lowercase();
    if h.contains("dal.net") {
        "dalnet"
    } else if h.contains("undernet") {
        "undernet"
    } else if h.contains("libera") {
        "libera"
    } else {
        "generic"
    }
}

/// Build the NickServ/X auto-identify line for a network, if possible.
fn identify_line(config: &ServerConfig) -> Option<String> {
    let pass = config.nickserv_password.as_ref()?;
    let account = config.sasl_account.clone().unwrap_or_else(|| config.nick.clone());
    Some(match network_of(&config.host) {
        "dalnet" => format!("PRIVMSG NickServ@services.dal.net :IDENTIFY {pass}"),
        "undernet" => format!("PRIVMSG X@channels.undernet.org :login {account} {pass}"),
        _ => format!("PRIVMSG NickServ :IDENTIFY {pass}"),
    })
}

/// Build the NickServ GHOST line to reclaim our nick, if possible.
fn ghost_line(config: &ServerConfig) -> Option<String> {
    let pass = config.nickserv_password.as_ref()?;
    match network_of(&config.host) {
        "dalnet" => Some(format!("PRIVMSG NickServ@services.dal.net :GHOST {} {pass}", config.nick)),
        "undernet" => None, // Undernet has no nick ownership
        _ => Some(format!("PRIVMSG NickServ :GHOST {} {pass}", config.nick)),
    }
}

/// Does a NOTICE indicate our nick is being held by services (enforcer)?
/// Used to trigger auto-release only when actually needed.
fn is_held_notice(from: &str, text: &str) -> bool {
    if !from.eq_ignore_ascii_case("NickServ") {
        return false;
    }
    let t = text.to_ascii_lowercase();
    t.contains("held") || t.contains("enforce") || t.contains("release it")
}

/// Build the NickServ RELEASE line to free a held nick, if possible.
fn release_line(config: &ServerConfig) -> Option<String> {
    let pass = config.nickserv_password.as_ref()?;
    match network_of(&config.host) {
        "dalnet" => Some(format!("PRIVMSG NickServ@services.dal.net :RELEASE {} {pass}", config.nick)),
        "undernet" => None, // Undernet has no nick ownership
        _ => Some(format!("PRIVMSG NickServ :RELEASE {} {pass}", config.nick)),
    }
}

fn default_port() -> u16 {
    6697
}

fn default_true() -> bool {
    true
}

/// Anything we can read and write asynchronously (plain TCP or TLS).
trait Stream: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send> Stream for T {}

/// Build a rustls client config trusting the Mozilla webpki root set.
fn tls_config() -> Arc<rustls::ClientConfig> {
    let mut roots = rustls::RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let config = rustls::ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    Arc::new(config)
}

/// Drive a connection to completion. Emits lifecycle + message events.
///
/// `out_rx` receives raw lines to send; `out_tx` is used internally for
/// registration and PONG replies so all writes funnel through one writer task.
pub async fn run(
    app: AppHandle,
    server_id: u64,
    config: ServerConfig,
    rave: Arc<RwLock<RaveConfig>>,
    out_rx: UnboundedReceiver<String>,
    out_tx: UnboundedSender<String>,
) {
    emit(
        &app,
        IrcEvent::Connecting {
            server_id,
            host: config.host.clone(),
            port: config.port,
        },
    );

    let stream: Box<dyn Stream> = match establish(&config).await {
        Ok(s) => s,
        Err(e) => {
            emit(
                &app,
                IrcEvent::Error {
                    server_id,
                    message: format!("connect failed: {e}"),
                },
            );
            emit(
                &app,
                IrcEvent::Disconnected {
                    server_id,
                    reason: Some(e),
                },
            );
            return;
        }
    };

    emit(&app, IrcEvent::Connected { server_id });

    let (read_half, write_half) = tokio::io::split(stream);

    // Writer task: drain the outgoing channel to the socket.
    let writer_app = app.clone();
    let writer = tauri::async_runtime::spawn(async move {
        let mut write_half = write_half;
        let mut out_rx = out_rx;
        while let Some(line) = out_rx.recv().await {
            let framed = format!("{line}\r\n");
            if write_half.write_all(framed.as_bytes()).await.is_err() {
                break;
            }
            let _ = write_half.flush().await;
            emit(
                &writer_app,
                IrcEvent::Sent {
                    server_id,
                    raw: line,
                },
            );
        }
    });

    // Kick off registration.
    register(&config, &out_tx);

    // Reader loop.
    let reason = read_loop(&app, server_id, &config, &rave, read_half, &out_tx).await;

    // Closing the channel ends the writer task.
    drop(out_tx);
    writer.abort();

    emit(&app, IrcEvent::Disconnected { server_id, reason });
}

/// Establish the TCP (and optionally TLS) transport.
async fn establish(config: &ServerConfig) -> Result<Box<dyn Stream>, String> {
    let tcp = TcpStream::connect((config.host.as_str(), config.port))
        .await
        .map_err(|e| e.to_string())?;
    tcp.set_nodelay(true).ok();

    if !config.tls {
        return Ok(Box::new(tcp));
    }

    let connector = TlsConnector::from(tls_config());
    let server_name = rustls_pki_types::ServerName::try_from(config.host.clone())
        .map_err(|_| format!("invalid TLS server name: {}", config.host))?;
    let tls = connector
        .connect(server_name, tcp)
        .await
        .map_err(|e| format!("TLS handshake failed: {e}"))?;
    Ok(Box::new(tls))
}

/// Send the registration handshake (CAP/SASL, PASS, NICK, USER).
fn register(config: &ServerConfig, out: &UnboundedSender<String>) {
    // Begin capability negotiation; SASL (if used) completes before CAP END.
    let _ = out.send("CAP LS 302".to_string());

    if let Some(pass) = &config.password {
        let _ = out.send(format!("PASS {pass}"));
    }
    let _ = out.send(format!("NICK {}", config.nick));
    let username = config.username.clone().unwrap_or_else(|| config.nick.clone());
    let realname = config
        .realname
        .clone()
        .unwrap_or_else(|| "RAVEIRC user".to_string());
    let _ = out.send(format!("USER {username} 0 * :{realname}"));

    // If SASL is not configured, end negotiation immediately.
    if config.sasl_password.is_none() {
        let _ = out.send("CAP END".to_string());
    }
}

/// Read and dispatch inbound lines until the connection ends.
/// Returns an optional human-readable disconnect reason.
async fn read_loop(
    app: &AppHandle,
    server_id: u64,
    config: &ServerConfig,
    rave: &Arc<RwLock<RaveConfig>>,
    read_half: tokio::io::ReadHalf<Box<dyn Stream>>,
    out: &UnboundedSender<String>,
) -> Option<String> {
    let mut reader = BufReader::new(read_half);
    let mut buf = Vec::with_capacity(1024);
    let mut sasl_done = config.sasl_password.is_none();
    let mut alt_idx = 0usize; // index into the nick-fallback sequence
    let mut ghost_tried = false;
    let mut release_tried = false;

    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf).await {
            Ok(0) => return Some("connection closed by server".to_string()),
            Ok(_) => {}
            Err(e) => return Some(e.to_string()),
        }

        let raw = String::from_utf8_lossy(&buf).trim_end_matches(['\r', '\n']).to_string();
        if raw.is_empty() {
            continue;
        }

        let Some(msg) = Message::parse(&raw) else {
            continue;
        };

        // Automatic protocol handling that must happen in the engine.
        match msg.command.as_str() {
            "PING" => {
                let token = msg.trailing().unwrap_or("");
                let _ = out.send(format!("PONG :{token}"));
            }
            "PRIVMSG" => {
                // Auto-respond to CTCP queries (VERSION/PING/etc.).
                if let (Some(text), Some(nick)) = (msg.trailing(), msg.nick()) {
                    if let Some(query) = ctcp::parse(text) {
                        let cfg = rave.read().ctcp.clone();
                        if let Some(payload) = ctcp::reply(&cfg, &query) {
                            let _ = out.send(ctcp::notice_line(nick, &payload));
                        }
                    }
                }
            }
            "NOTICE" => {
                // Auto-release ONLY when NickServ tells us the nick is held by an
                // enforcer — not on every login.
                if config.auto_release && !release_tried {
                    if let (Some(text), Some(from)) = (msg.trailing(), msg.nick()) {
                        if is_held_notice(from, text) {
                            if let Some(r) = release_line(config) {
                                release_tried = true;
                                let _ = out.send(r);
                                let _ = out.send(format!("NICK {}", config.nick));
                            }
                        }
                    }
                }
            }
            "CAP" => handle_cap(config, &msg, out, &mut sasl_done),
            "AUTHENTICATE" => handle_authenticate(config, &msg, out),
            "903" | "904" | "905" | "906" | "907" => {
                // SASL result (success 903 / failures). End negotiation.
                if !sasl_done {
                    sasl_done = true;
                    let _ = out.send("CAP END".to_string());
                }
            }
            // Nick in use (433) / erroneous (432) during/after registration.
            "433" | "432" => {
                // First 433: try to ghost our own nick (DALnet/Libera) and reclaim it.
                let did_ghost = if !ghost_tried
                    && config.auto_ghost
                    && config.nickserv_password.is_some()
                {
                    if let Some(g) = ghost_line(config) {
                        ghost_tried = true;
                        let _ = out.send(g);
                        let _ = out.send(format!("NICK {}", config.nick));
                        true
                    } else {
                        false
                    }
                } else {
                    false
                };
                // Otherwise fall through alt nicks, then append underscores.
                if !did_ghost {
                    let next = config.alt_nicks.get(alt_idx).cloned().unwrap_or_else(|| {
                        let extra = alt_idx - config.alt_nicks.len() + 1;
                        format!("{}{}", config.nick, "_".repeat(extra))
                    });
                    alt_idx += 1;
                    let _ = out.send(format!("NICK {next}"));
                }
            }
            "001" => {
                let nick = msg.param(0).unwrap_or(&config.nick).to_string();
                emit(app, IrcEvent::Registered { server_id, nick });
                // Auto-identify to services before joining channels.
                if config.auto_identify {
                    if let Some(id) = identify_line(config) {
                        let _ = out.send(id);
                    }
                }
                for chan in &config.autojoin {
                    let _ = out.send(format!("JOIN {chan}"));
                }
            }
            _ => {}
        }

        emit(
            app,
            IrcEvent::Message {
                server_id,
                raw,
                message: msg,
            },
        );
    }
}

/// Handle a CAP negotiation message (LS/ACK/NAK).
fn handle_cap(
    config: &ServerConfig,
    msg: &Message,
    out: &UnboundedSender<String>,
    sasl_done: &mut bool,
) {
    // params: <*|nick> <subcmd> [*] :<caps>
    let sub = msg.param(1).unwrap_or("");
    match sub {
        "LS" => {
            let caps = msg.trailing().unwrap_or("");
            if config.sasl_password.is_some() && caps.split_whitespace().any(|c| c == "sasl") {
                let _ = out.send("CAP REQ :sasl".to_string());
            } else if !*sasl_done {
                *sasl_done = true;
                let _ = out.send("CAP END".to_string());
            }
        }
        "ACK" => {
            let acked = msg.trailing().unwrap_or("");
            if acked.contains("sasl") {
                let _ = out.send("AUTHENTICATE PLAIN".to_string());
            }
        }
        "NAK" => {
            if !*sasl_done {
                *sasl_done = true;
                let _ = out.send("CAP END".to_string());
            }
        }
        _ => {}
    }
}

/// Respond to an `AUTHENTICATE +` challenge with SASL PLAIN credentials.
fn handle_authenticate(config: &ServerConfig, msg: &Message, out: &UnboundedSender<String>) {
    if msg.param(0) != Some("+") {
        return;
    }
    let Some(password) = &config.sasl_password else {
        return;
    };
    let account = config
        .sasl_account
        .clone()
        .unwrap_or_else(|| config.nick.clone());
    // SASL PLAIN: authzid \0 authcid \0 passwd
    let payload = format!("{account}\0{account}\0{password}");
    let encoded = base64::engine::general_purpose::STANDARD.encode(payload.as_bytes());
    let _ = out.send(format!("AUTHENTICATE {encoded}"));
}

/// Emit an engine event to the frontend, ignoring transport errors.
fn emit(app: &AppHandle, event: IrcEvent) {
    let _ = app.emit(IRC_EVENT, event);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::io::AsyncWriteExt;

    fn test_config(host: &str) -> ServerConfig {
        ServerConfig {
            host: host.into(),
            port: 6697,
            tls: true,
            nick: "rave".into(),
            username: None,
            realname: None,
            password: None,
            sasl_account: None,
            sasl_password: None,
            nickserv_password: Some("secret".into()),
            auto_identify: true,
            auto_ghost: true,
            auto_release: false,
            alt_nicks: vec![],
            autojoin: vec![],
        }
    }

    #[test]
    fn identify_and_ghost_are_network_aware() {
        let dal = test_config("irc.dal.net");
        assert_eq!(
            identify_line(&dal).unwrap(),
            "PRIVMSG NickServ@services.dal.net :IDENTIFY secret"
        );
        assert_eq!(
            ghost_line(&dal).unwrap(),
            "PRIVMSG NickServ@services.dal.net :GHOST rave secret"
        );

        let lib = test_config("irc.libera.chat");
        assert_eq!(identify_line(&lib).unwrap(), "PRIVMSG NickServ :IDENTIFY secret");

        let und = test_config("irc.undernet.org");
        assert_eq!(identify_line(&und).unwrap(), "PRIVMSG X@channels.undernet.org :login rave secret");
        assert!(ghost_line(&und).is_none()); // Undernet has no nick ownership
    }

    #[test]
    fn held_notice_detection() {
        // Held / enforcer notices from NickServ trigger release.
        assert!(is_held_notice("NickServ", "This nickname is being held by services"));
        assert!(is_held_notice("nickserv", "Services Enforcer has changed your nick"));
        assert!(is_held_notice("NickServ", "If this is your nick, type RELEASE it now"));
        // Ordinary notices / other senders do not.
        assert!(!is_held_notice("NickServ", "This nickname is registered and protected"));
        assert!(!is_held_notice("SomeUser", "held hostage lol"));
    }

    #[test]
    fn release_is_network_aware() {
        let dal = test_config("irc.dal.net");
        assert_eq!(
            release_line(&dal).unwrap(),
            "PRIVMSG NickServ@services.dal.net :RELEASE rave secret"
        );
        let lib = test_config("irc.libera.chat");
        assert_eq!(release_line(&lib).unwrap(), "PRIVMSG NickServ :RELEASE rave secret");
        assert!(release_line(&test_config("irc.undernet.org")).is_none());

        let mut c = test_config("irc.dal.net");
        c.nickserv_password = None;
        assert!(release_line(&c).is_none());
    }

    #[test]
    fn no_identify_without_password() {
        let mut c = test_config("irc.dal.net");
        c.nickserv_password = None;
        assert!(identify_line(&c).is_none());
    }

    /// Live network test: connect to a real ircd over TLS and register.
    /// Ignored by default; run with:
    ///   cargo test --lib irc::connection::tests::live_tls_register -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn live_tls_register() {
        let _ = rustls::crypto::ring::default_provider().install_default();

        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().subsec_nanos();
        let nick = format!("rave{nanos:05}");
        let config = ServerConfig {
            host: "irc.libera.chat".into(),
            port: 6697,
            tls: true,
            nick: nick.clone(),
            username: Some("rave".into()),
            realname: Some("RAVEIRC test".into()),
            password: None,
            sasl_account: None,
            sasl_password: None,
            nickserv_password: None,
            auto_identify: true,
            auto_ghost: false,
            auto_release: false,
            alt_nicks: vec![],
            autojoin: vec![],
        };

        let stream = establish(&config).await.expect("TLS connect");
        let (read_half, mut write_half) = tokio::io::split(stream);
        let reg = format!(
            "NICK {nick}\r\nUSER rave 0 * :RAVEIRC test\r\n"
        );
        write_half.write_all(reg.as_bytes()).await.unwrap();
        write_half.flush().await.unwrap();

        let mut reader = BufReader::new(read_half);
        let mut got_001 = false;
        let deadline = tokio::time::Instant::now() + Duration::from_secs(25);

        while tokio::time::Instant::now() < deadline {
            let mut line = String::new();
            let read = tokio::time::timeout(Duration::from_secs(25), reader.read_line(&mut line)).await;
            let n = match read {
                Ok(Ok(n)) => n,
                _ => break,
            };
            if n == 0 {
                break;
            }
            let raw = line.trim_end();
            eprintln!("<< {raw}");
            if let Some(msg) = Message::parse(raw) {
                if msg.command == "PING" {
                    let token = msg.trailing().unwrap_or("");
                    let pong = format!("PONG :{token}\r\n");
                    write_half.write_all(pong.as_bytes()).await.unwrap();
                    write_half.flush().await.unwrap();
                }
                if msg.command == "001" {
                    got_001 = true;
                    break;
                }
            }
        }

        let _ = write_half.write_all(b"QUIT :done\r\n").await;
        assert!(got_001, "did not receive welcome numeric 001");
    }

    /// Live network test: connect, register, JOIN a channel, and confirm the
    /// server echoes our JOIN and the names-list end (366). Ignored by default:
    ///   cargo test --lib irc::connection::tests::live_join_channel -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn live_join_channel() {
        let _ = rustls::crypto::ring::default_provider().install_default();

        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().subsec_nanos();
        let nick = format!("rave{nanos:05}");
        let chan = format!("#raveirc-test-{nanos:05}");
        let config = ServerConfig {
            host: "irc.libera.chat".into(),
            port: 6697,
            tls: true,
            nick: nick.clone(),
            username: Some("rave".into()),
            realname: Some("RAVEIRC test".into()),
            password: None,
            sasl_account: None,
            sasl_password: None,
            nickserv_password: None,
            auto_identify: true,
            auto_ghost: false,
            auto_release: false,
            alt_nicks: vec![],
            autojoin: vec![],
        };

        let stream = establish(&config).await.expect("TLS connect");
        let (read_half, mut write_half) = tokio::io::split(stream);
        let reg = format!("NICK {nick}\r\nUSER rave 0 * :RAVEIRC test\r\n");
        write_half.write_all(reg.as_bytes()).await.unwrap();
        write_half.flush().await.unwrap();

        let mut reader = BufReader::new(read_half);
        let (mut registered, mut joined, mut names_done) = (false, false, false);
        let deadline = tokio::time::Instant::now() + Duration::from_secs(30);

        while tokio::time::Instant::now() < deadline && !(joined && names_done) {
            let mut line = String::new();
            let read =
                tokio::time::timeout(Duration::from_secs(30), reader.read_line(&mut line)).await;
            match read {
                Ok(Ok(n)) if n > 0 => {}
                _ => break,
            }
            let raw = line.trim_end();
            eprintln!("<< {raw}");
            let Some(m) = Message::parse(raw) else { continue };
            match m.command.as_str() {
                "PING" => {
                    let token = m.trailing().unwrap_or("");
                    write_half.write_all(format!("PONG :{token}\r\n").as_bytes()).await.unwrap();
                    write_half.flush().await.unwrap();
                }
                "001" if !registered => {
                    registered = true;
                    write_half.write_all(format!("JOIN {chan}\r\n").as_bytes()).await.unwrap();
                    write_half.flush().await.unwrap();
                }
                // our own JOIN echo
                "JOIN" if m.nick() == Some(nick.as_str()) => joined = true,
                // 366 = end of NAMES for the channel
                "366" if m.param(1) == Some(chan.as_str()) => names_done = true,
                _ => {}
            }
        }

        let _ = write_half.write_all(b"QUIT :done\r\n").await;
        assert!(joined, "did not receive our own JOIN echo");
        assert!(names_done, "did not receive end-of-NAMES (366)");
    }
}
