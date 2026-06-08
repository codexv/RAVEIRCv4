//! Local-first AI co-pilot backed by Ollama (http://localhost:11434).
//!
//! Nothing leaves the machine: we talk to a locally running Ollama server. If
//! it isn't running, [`status`] reports unavailable and the UI degrades to a
//! setup card — the AI is never bundled with the app.

use serde::{Deserialize, Serialize};

use super::config::AiConfig;

/// A moderation verdict for a single message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Verdict {
    pub flag: bool,
    /// One of: spam | scam | toxicity | raid | none
    pub category: String,
    /// 1 (trivial) .. 5 (severe)
    pub severity: u8,
    pub reason: String,
}

/// Availability of the local Ollama backend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatus {
    /// Ollama server reachable.
    pub available: bool,
    /// The configured model is pulled and ready.
    pub model_present: bool,
    /// Installed model names (for the settings UI).
    pub models: Vec<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
struct ChatMsg<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatReq<'a> {
    model: &'a str,
    messages: Vec<ChatMsg<'a>>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<&'a str>,
}

#[derive(Deserialize)]
struct ChatResp {
    message: ChatRespMsg,
}
#[derive(Deserialize)]
struct ChatRespMsg {
    content: String,
}

fn base(cfg: &AiConfig) -> String {
    cfg.endpoint.trim_end_matches('/').to_string()
}

/// Low-level chat call to Ollama. `json` forces a JSON-only response.
async fn chat(cfg: &AiConfig, system: &str, user: &str, json: bool) -> Result<String, String> {
    let client = reqwest::Client::new();
    let req = ChatReq {
        model: &cfg.model,
        messages: vec![
            ChatMsg { role: "system", content: system },
            ChatMsg { role: "user", content: user },
        ],
        stream: false,
        format: if json { Some("json") } else { None },
    };
    let resp = client
        .post(format!("{}/api/chat", base(cfg)))
        .json(&req)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("ollama returned {}", resp.status()));
    }
    let body: ChatResp = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body.message.content)
}

/// Check whether Ollama is reachable and the configured model is present.
pub async fn status(cfg: &AiConfig) -> AiStatus {
    #[derive(Deserialize)]
    struct Tags {
        models: Vec<Model>,
    }
    #[derive(Deserialize)]
    struct Model {
        name: String,
    }

    let client = reqwest::Client::new();
    match client.get(format!("{}/api/tags", base(cfg))).send().await {
        Ok(r) if r.status().is_success() => match r.json::<Tags>().await {
            Ok(t) => {
                let models: Vec<String> = t.models.into_iter().map(|m| m.name).collect();
                let present = models
                    .iter()
                    .any(|n| n == &cfg.model || n.starts_with(&format!("{}:", cfg.model)));
                AiStatus { available: true, model_present: present, models, error: None }
            }
            Err(e) => AiStatus {
                available: true,
                model_present: false,
                models: vec![],
                error: Some(e.to_string()),
            },
        },
        Ok(r) => AiStatus {
            available: false,
            model_present: false,
            models: vec![],
            error: Some(format!("ollama returned {}", r.status())),
        },
        Err(e) => AiStatus {
            available: false,
            model_present: false,
            models: vec![],
            error: Some(e.to_string()),
        },
    }
}

/// System prompt for the moderation classifier. Conservative by design.
const MOD_SYSTEM: &str = "You are an IRC channel moderation classifier. Decide if ONE message is \
spam, a scam/phishing attempt, targeted harassment/hate, or part of a raid/flood. Respond with \
STRICT JSON only: {\"flag\": boolean, \"category\": \"spam\"|\"scam\"|\"toxicity\"|\"raid\"|\"none\", \
\"severity\": 1, \"reason\": \"short\"}. Be conservative: normal chat, jokes, opinions, banter, and \
mild profanity are NOT violations (flag=false, category=none, severity<=2). Only flag clear \
advertising/spam, scams/phishing links, targeted harassment, hate speech, or coordinated raids.";

/// Classify a single channel message.
pub async fn moderate(cfg: &AiConfig, channel: &str, nick: &str, message: &str) -> Result<Verdict, String> {
    let user = format!("Channel: {channel}\nFrom: {nick}\nMessage: {message}");
    let content = chat(cfg, MOD_SYSTEM, &user, true).await?;
    serde_json::from_str::<Verdict>(&content)
        .map_err(|e| format!("could not parse verdict ({e}): {content}"))
}

/// Summarize recent channel activity (the `/catchup` command).
pub async fn summarize(cfg: &AiConfig, channel: &str, transcript: &str) -> Result<String, String> {
    let system = "You are an IRC channel assistant. Summarize the recent conversation in 3-6 short \
bullet points. Note decisions, open questions, and any heated arguments. Be concise.";
    let user = format!("Channel {channel} recent log:\n{transcript}");
    chat(cfg, system, &user, false).await
}

/// Assess a single user's recent behavior (the `/analyze` command).
pub async fn analyze(cfg: &AiConfig, nick: &str, transcript: &str) -> Result<String, String> {
    let system = "You are an IRC operator assistant. From a user's recent messages, briefly assess \
their behavior (normal, spamming, trolling, scamming, etc.) in 2-4 sentences. Be fair and avoid \
unfounded accusations.";
    let user = format!("User {nick} recent messages:\n{transcript}");
    chat(cfg, system, &user, false).await
}
