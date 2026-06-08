//! Generic TCP sockets for mSL scripting (/sockopen, /sockwrite, /sockclose,
//! $sock, on SOCKOPEN/SOCKREAD/SOCKCLOSE). Plain or TLS (-e). Cross-platform
//! (tokio); data is bridged to the frontend via the `socket-event` event.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_rustls::TlsConnector;

const SOCKET_EVENT: &str = "socket-event";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SockEvent {
    name: String,
    /// "open" | "read" | "close"
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn emit_sock(app: &AppHandle, name: &str, kind: &str, data: Option<String>, error: Option<String>) {
    let _ = app.emit(
        SOCKET_EVENT,
        SockEvent { name: name.to_string(), kind: kind.to_string(), data, error },
    );
}

fn tls_config() -> Arc<rustls::ClientConfig> {
    let mut roots = rustls::RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    Arc::new(
        rustls::ClientConfig::builder()
            .with_root_certificates(roots)
            .with_no_client_auth(),
    )
}

trait Stream: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send> Stream for T {}

type SockMap = Arc<Mutex<HashMap<String, UnboundedSender<Vec<u8>>>>>;

#[derive(Default)]
pub struct SocketManager {
    socks: SockMap,
}

impl SocketManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Open (or replace) a named socket; connect happens asynchronously.
    pub fn open(&self, app: AppHandle, name: String, host: String, port: u16, tls: bool) {
        let (tx, rx) = unbounded_channel::<Vec<u8>>();
        self.socks.lock().insert(name.clone(), tx); // replacing drops the old writer
        let socks = Arc::clone(&self.socks);
        tauri::async_runtime::spawn(async move {
            run_socket(app, name, host, port, tls, rx, socks).await;
        });
    }

    pub fn write(&self, name: &str, data: Vec<u8>) -> Result<(), String> {
        let socks = self.socks.lock();
        let tx = socks.get(name).ok_or_else(|| format!("no such socket: {name}"))?;
        tx.send(data).map_err(|_| "socket closed".to_string())
    }

    /// Close a socket (dropping the writer ends its task).
    pub fn close(&self, name: &str) {
        self.socks.lock().remove(name);
    }
}

fn fail(app: &AppHandle, socks: &SockMap, name: &str, e: String) {
    socks.lock().remove(name);
    emit_sock(app, name, "close", None, Some(e));
}

async fn run_socket(
    app: AppHandle,
    name: String,
    host: String,
    port: u16,
    tls: bool,
    mut rx: UnboundedReceiver<Vec<u8>>,
    socks: SockMap,
) {
    let tcp = match TcpStream::connect((host.as_str(), port)).await {
        Ok(s) => s,
        Err(e) => return fail(&app, &socks, &name, e.to_string()),
    };
    tcp.set_nodelay(true).ok();

    let mut stream: Box<dyn Stream> = if tls {
        let connector = TlsConnector::from(tls_config());
        let server_name = match rustls_pki_types::ServerName::try_from(host.clone()) {
            Ok(s) => s,
            Err(_) => return fail(&app, &socks, &name, format!("invalid TLS host: {host}")),
        };
        match connector.connect(server_name, tcp).await {
            Ok(t) => Box::new(t),
            Err(e) => return fail(&app, &socks, &name, format!("TLS handshake failed: {e}")),
        }
    } else {
        Box::new(tcp)
    };

    emit_sock(&app, &name, "open", None, None);

    let mut buf = vec![0u8; 16384];
    loop {
        tokio::select! {
            res = stream.read(&mut buf) => match res {
                Ok(0) => break, // remote closed
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    emit_sock(&app, &name, "read", Some(data), None);
                }
                Err(e) => return fail(&app, &socks, &name, e.to_string()),
            },
            msg = rx.recv() => match msg {
                Some(bytes) => {
                    if stream.write_all(&bytes).await.is_err() {
                        break;
                    }
                    let _ = stream.flush().await;
                }
                None => break, // writer dropped → /sockclose
            },
        }
    }

    socks.lock().remove(&name);
    emit_sock(&app, &name, "close", None, None);
}
