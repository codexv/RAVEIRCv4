//! RAVEIRC backend: Tauri command surface over the IRC engine.

mod irc;
mod rave;
mod socket;

use irc::{IrcManager, ServerConfig};
use rave::RaveConfig;
use socket::SocketManager;
use tauri::{AppHandle, Manager, State};

/// Connect to an IRC server. Returns the assigned server id.
#[tauri::command]
fn irc_connect(app: AppHandle, manager: State<IrcManager>, config: ServerConfig) -> u64 {
    manager.connect(app, config)
}

/// Disconnect from a server, with an optional QUIT message.
#[tauri::command]
fn irc_disconnect(
    manager: State<IrcManager>,
    server_id: u64,
    quit_message: Option<String>,
) -> Result<(), String> {
    manager.disconnect(server_id, quit_message)
}

/// Send a raw IRC line to a server.
#[tauri::command]
fn irc_send_raw(manager: State<IrcManager>, server_id: u64, line: String) -> Result<(), String> {
    manager.send_raw(server_id, line)
}

/// Send a PRIVMSG to a target (channel or nick).
#[tauri::command]
fn irc_send_message(
    manager: State<IrcManager>,
    server_id: u64,
    target: String,
    text: String,
) -> Result<(), String> {
    manager.send_message(server_id, &target, &text)
}

/// Drop a server's handle (called by the frontend after a disconnect event).
#[tauri::command]
fn irc_forget(manager: State<IrcManager>, server_id: u64) {
    manager.forget(server_id);
}

/// Get the current RAVE module configuration.
#[tauri::command]
fn rave_get_config(manager: State<IrcManager>) -> RaveConfig {
    manager.rave_config()
}

/// Replace the RAVE module configuration (from the settings UI) and persist it.
#[tauri::command]
fn rave_set_config(app: AppHandle, manager: State<IrcManager>, config: RaveConfig) {
    if let Err(e) = rave::persist::save(&app, &config) {
        eprintln!("failed to persist RAVE config: {e}");
    }
    manager.set_rave_config(config);
}

/// Append a line to a channel/query log file (when logging is enabled).
#[tauri::command]
fn log_line(app: AppHandle, network: String, target: String, line: String) {
    if let Err(e) = rave::persist::append_log(&app, &network, &target, &line) {
        eprintln!("log write failed: {e}");
    }
}

/// Check whether the local Ollama backend is reachable and the model is ready.
#[tauri::command]
async fn ai_status(manager: State<'_, IrcManager>) -> Result<rave::ai::AiStatus, String> {
    Ok(rave::ai::status(&manager.rave_config().ai).await)
}

/// Classify a single channel message for moderation.
#[tauri::command]
async fn ai_moderate(
    manager: State<'_, IrcManager>,
    channel: String,
    nick: String,
    message: String,
) -> Result<rave::ai::Verdict, String> {
    rave::ai::moderate(&manager.rave_config().ai, &channel, &nick, &message).await
}

/// Summarize a channel transcript (the /catchup command).
#[tauri::command]
async fn ai_summarize(
    manager: State<'_, IrcManager>,
    channel: String,
    transcript: String,
) -> Result<String, String> {
    rave::ai::summarize(&manager.rave_config().ai, &channel, &transcript).await
}

/// Assess a single user's recent behavior (the /analyze command).
#[tauri::command]
async fn ai_analyze(
    manager: State<'_, IrcManager>,
    nick: String,
    transcript: String,
) -> Result<String, String> {
    rave::ai::analyze(&manager.rave_config().ai, &nick, &transcript).await
}

#[tauri::command]
fn script_data_load(app: AppHandle) -> Vec<(String, String)> {
    rave::persist::load_script_data(&app)
}

#[tauri::command]
fn script_data_save(app: AppHandle, name: String, content: String) -> Result<(), String> {
    rave::persist::save_script_file(&app, &name, &content)
}

#[tauri::command]
fn script_data_remove(app: AppHandle, name: String) -> Result<(), String> {
    rave::persist::remove_script_file(&app, &name)
}

#[tauri::command]
fn sock_open(app: AppHandle, sockets: State<SocketManager>, name: String, host: String, port: u16, tls: bool) {
    sockets.open(app, name, host, port, tls);
}

#[tauri::command]
fn sock_write(sockets: State<SocketManager>, name: String, data: String) -> Result<(), String> {
    sockets.write(&name, data.into_bytes())
}

#[tauri::command]
fn sock_close(sockets: State<SocketManager>, name: String) {
    sockets.close(&name);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install the ring crypto provider for rustls before any TLS work.
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(IrcManager::new())
        .manage(SocketManager::new())
        .setup(|app| {
            // Load persisted RAVE config (if any) into the manager at startup.
            let config = rave::persist::load(app.handle());
            app.state::<IrcManager>().set_rave_config(config);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            irc_connect,
            irc_disconnect,
            irc_send_raw,
            irc_send_message,
            irc_forget,
            rave_get_config,
            rave_set_config,
            log_line,
            ai_status,
            ai_moderate,
            ai_summarize,
            ai_analyze,
            script_data_load,
            script_data_save,
            script_data_remove,
            sock_open,
            sock_write,
            sock_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
