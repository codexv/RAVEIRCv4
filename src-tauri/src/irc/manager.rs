//! Multi-server connection manager. Owns the set of active connections and
//! routes outbound commands from the frontend to the right server.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use parking_lot::{Mutex, RwLock};
use tauri::AppHandle;
use tokio::sync::mpsc::UnboundedSender;

use super::connection::{self, ServerConfig};
use crate::rave::RaveConfig;

/// A handle to one live (or connecting) server connection.
struct ConnectionHandle {
    /// Sender for raw outbound lines (consumed by the connection's writer task).
    out_tx: UnboundedSender<String>,
    /// The current nick we registered/attempted with.
    #[allow(dead_code)] // used by nick() / upcoming modules
    nick: String,
    /// Whether the driver should auto-reconnect on connection loss. Cleared on a
    /// user-initiated disconnect so we don't reconnect after /quit.
    reconnect: Arc<AtomicBool>,
}

/// Tracks all server connections. Cheap to clone-free share via Tauri state.
#[derive(Default)]
pub struct IrcManager {
    connections: Mutex<HashMap<u64, ConnectionHandle>>,
    next_id: AtomicU64,
    /// Shared RAVE module config, read by every connection.
    rave: Arc<RwLock<RaveConfig>>,
}

impl IrcManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// A snapshot of the current RAVE config.
    pub fn rave_config(&self) -> RaveConfig {
        self.rave.read().clone()
    }

    /// Replace the RAVE config (from the settings UI).
    pub fn set_rave_config(&self, config: RaveConfig) {
        *self.rave.write() = config;
    }

    /// Open a new connection. Returns the assigned server id immediately; the
    /// actual connect happens asynchronously and reports progress via events.
    pub fn connect(&self, app: AppHandle, config: ServerConfig) -> u64 {
        let server_id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let (out_tx, out_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
        let reconnect = Arc::new(AtomicBool::new(true));

        self.connections.lock().insert(
            server_id,
            ConnectionHandle {
                out_tx: out_tx.clone(),
                nick: config.nick.clone(),
                reconnect: Arc::clone(&reconnect),
            },
        );

        let driver_config = config.clone();
        let rave = Arc::clone(&self.rave);
        // Tauri's async runtime is Tokio-backed and always available; plain
        // tokio::spawn would panic here since command threads have no runtime.
        tauri::async_runtime::spawn(async move {
            connection::run(app, server_id, driver_config, rave, out_rx, out_tx, reconnect).await;
        });

        server_id
    }

    /// Send a raw protocol line to a server. Returns an error if unknown/closed.
    pub fn send_raw(&self, server_id: u64, line: String) -> Result<(), String> {
        let conns = self.connections.lock();
        let handle = conns
            .get(&server_id)
            .ok_or_else(|| format!("no such server: {server_id}"))?;
        handle
            .out_tx
            .send(line)
            .map_err(|_| "connection is closed".to_string())
    }

    /// Send a PRIVMSG to a target (channel or nick).
    pub fn send_message(&self, server_id: u64, target: &str, text: &str) -> Result<(), String> {
        self.send_raw(server_id, format!("PRIVMSG {target} :{text}"))
    }

    /// Disconnect a server with an optional QUIT message and forget it.
    pub fn disconnect(&self, server_id: u64, quit_msg: Option<String>) -> Result<(), String> {
        let handle = self
            .connections
            .lock()
            .remove(&server_id)
            .ok_or_else(|| format!("no such server: {server_id}"))?;
        // Stop the driver from auto-reconnecting after this intentional quit.
        handle.reconnect.store(false, Ordering::Relaxed);
        let msg = quit_msg.unwrap_or_else(|| "RAVEIRC".to_string());
        // Best-effort QUIT; the server then closes the socket and the driver,
        // seeing reconnect=false, exits instead of retrying.
        let _ = handle.out_tx.send(format!("QUIT :{msg}"));
        Ok(())
    }

    /// Forget a connection's handle (called when a Disconnected event lands).
    pub fn forget(&self, server_id: u64) {
        if let Some(h) = self.connections.lock().remove(&server_id) {
            h.reconnect.store(false, Ordering::Relaxed);
        }
    }

    /// The nick associated with a server, if connected.
    #[allow(dead_code)] // used by upcoming RAVE modules
    pub fn nick(&self, server_id: u64) -> Option<String> {
        self.connections.lock().get(&server_id).map(|h| h.nick.clone())
    }
}

#[cfg(test)]
mod tests {
    /// Reproduces the connect() crash condition: spawning a future from a plain
    /// synchronous thread with no active Tokio runtime (as Tauri command threads
    /// are). `tokio::spawn` panics here; `tauri::async_runtime::spawn` must not.
    #[test]
    fn async_runtime_spawn_from_sync_context() {
        let handle = tauri::async_runtime::spawn(async { 2 + 2 });
        let result = tauri::async_runtime::block_on(handle);
        assert_eq!(result.unwrap(), 4);
    }
}
