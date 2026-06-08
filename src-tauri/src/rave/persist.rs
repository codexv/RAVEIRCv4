//! Persist [`RaveConfig`] to a JSON file in the app config directory.
//!
//! On macOS this is `~/Library/Application Support/com.rave.irc/rave-config.json`.

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use super::config::RaveConfig;

const FILE: &str = "rave-config.json";

/// Resolve the on-disk config path, if the platform provides a config dir.
fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join(FILE))
}

/// Load the saved config, falling back to defaults if missing/unreadable.
pub fn load(app: &AppHandle) -> RaveConfig {
    let Some(path) = config_path(app) else {
        return RaveConfig::default();
    };
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => RaveConfig::default(),
    }
}

/// Append a line to a channel/query log file under the app log dir.
/// Path: `<app config dir>/logs/<network>/<target>.log`.
pub fn append_log(app: &AppHandle, network: &str, target: &str, line: &str) -> Result<(), String> {
    let base = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let safe = |s: &str| s.chars().map(|c| if c.is_alphanumeric() || "#-_.".contains(c) { c } else { '_' }).collect::<String>();
    let dir = base.join("logs").join(safe(network));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.log", safe(target)));
    use std::io::Write;
    let mut f = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(f, "{line}").map_err(|e| e.to_string())
}

/// Write the config to disk, creating the directory if needed.
pub fn save(app: &AppHandle, config: &RaveConfig) -> Result<(), String> {
    let path = config_path(app).ok_or("no config directory available")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}
