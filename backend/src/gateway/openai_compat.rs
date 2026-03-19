//! OpenAI-compatible `/v1/chat/completions` and `/v1/models` endpoints.

use super::AppState;
use crate::providers::traits::ChatMessage;
use crate::skills::loader::SkillLoader; // Import trait for enrich_system_prompt
use crate::skills::AgentSkill;
use axum::{
    body::Body,
    extract::{ConnectInfo, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Json},
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use uuid::Uuid;

pub const CHAT_COMPLETIONS_MAX_BODY_SIZE: usize = 524_288;

#[derive(Debug, Deserialize)]
pub struct ChatCompletionsRequest {
    #[serde(default)]
    pub model: Option<String>,
    pub messages: Vec<ChatCompletionsMessage>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub stream: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ChatCompletionsMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionsResponse {
    pub id: String,
    pub object: &'static str,
    pub created: u64,
    pub model: String,
    pub choices: Vec<ChatCompletionsChoice>,
    pub usage: ChatCompletionsUsage,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionsChoice {
    pub index: u32,
    pub message: ChatCompletionsResponseMessage,
    pub finish_reason: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionsResponseMessage {
    pub role: &'static str,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionsUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Serialize)]
struct ChatCompletionsChunk {
    id: String,
    object: &'static str,
    created: u64,
    model: String,
    choices: Vec<ChunkChoice>,
}

#[derive(Debug, Serialize)]
struct ChunkChoice {
    index: u32,
    delta: ChunkDelta,
    finish_reason: Option<&'static str>,
}

#[derive(Debug, Serialize)]
struct ChunkDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ModelsResponse {
    pub object: &'static str,
    pub data: Vec<ModelObject>,
}

#[derive(Debug, Serialize)]
pub struct ModelObject {
    pub id: String,
    pub object: &'static str,
    pub created: u64,
    pub owned_by: String,
}

/// Generate the store_skill tool definition in OpenAI format
fn get_skill_tools() -> Vec<serde_json::Value> {
    vec![serde_json::json!({
        "type": "function",
        "function": {
            "name": "store_skill",
            "description": "Save a new skill or behavior rule that the assistant should remember for future conversations. Use this when the user explicitly asks to remember something, save a rule, or create a skill.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "A short, unique name for the skill (e.g., 'project_omega_rules', 'email_formatting')"
                    },
                    "description": {
                        "type": "string",
                        "description": "A brief description of what this skill does"
                    },
                    "content": {
                        "type": "string",
                        "description": "The full skill content/instructions in markdown format"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional tags for categorizing the skill"
                    }
                },
                "required": ["name", "description", "content"]
            }
        }
    })]
}

/// Check if user message suggests they want to save a skill
fn should_offer_skill_tools(user_query: &str) -> bool {
    let lower = user_query.to_lowercase();
    lower.contains("zapamiętaj") || lower.contains("zapisz") || lower.contains("remember") ||
    lower.contains("save") || lower.contains("skill") || lower.contains("reguła") ||
    lower.contains("rule") || lower.contains("zawsze kiedy") || lower.contains("whenever") ||
    lower.contains("ilekroć") || lower.contains("na przyszłość") || lower.contains("for future")
}

/// Execute the store_skill tool call
async fn execute_store_skill(
    state: &AppState,
    args: &serde_json::Value,
) -> Result<String, String> {
    let engine = state.skill_engine.as_ref().ok_or("Skills engine not available")?;

    let name = args.get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'name' parameter")?;

    let description = args.get("description")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'description' parameter")?;

    let content = args.get("content")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'content' parameter")?;

    let tags: Vec<String> = args.get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|t| t.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let skill = AgentSkill {
        id: None,
        name: name.to_string(),
        description: description.to_string(),
        content: content.to_string(),
        version: "1.0.0".to_string(),
        author: None,
        tags,
        is_active: true,
        tools: Vec::new(),
        prompts: Vec::new(),
        location: None,
        created_at: None,
        updated_at: None,
    };

    match engine.store_skill(&skill).await {
        Ok(_id) => Ok(format!("Skill '{}' saved successfully.", name)),
        Err(e) => Err(format!("Failed to save skill: {}", e)),
    }
}

pub async fn handle_v1_chat_completions(
    State(state): State<AppState>,
    ConnectInfo(peer_addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let rate_key = super::client_key_from_request(Some(peer_addr), &headers, state.trust_forwarded_headers);
    if !state.rate_limiter.allow_webhook(&rate_key) {
        let err = serde_json::json!({
            "error": {
                "message": "Rate limit exceeded. Please retry later.",
                "type": "rate_limit_error",
                "code": "rate_limit_exceeded"
            }
        });
        return (StatusCode::TOO_MANY_REQUESTS, Json(err)).into_response();
    }

    if state.pairing.require_pairing() {
        let auth = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()).unwrap_or("");
        let token = auth.strip_prefix("Bearer ").unwrap_or("");
        if !state.pairing.is_authenticated(token).await {
            let err = serde_json::json!({
                "error": {
                    "message": "Invalid API key. Pair first via POST /pair",
                    "type": "invalid_request_error",
                    "code": "invalid_api_key"
                }
            });
            return (StatusCode::UNAUTHORIZED, Json(err)).into_response();
        }
    }

    if body.len() > CHAT_COMPLETIONS_MAX_BODY_SIZE {
        return (StatusCode::PAYLOAD_TOO_LARGE, Json(serde_json::json!({"error": "Payload too large"}))).into_response();
    }

    let request: ChatCompletionsRequest = match serde_json::from_slice(&body) {
        Ok(req) => req,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": format!("Invalid JSON: {e}")}))).into_response(),
    };

    let model = request.model.unwrap_or_else(|| state.model.clone());
    let temperature = request.temperature.unwrap_or(state.temperature);
    let stream = request.stream.unwrap_or(false);

    let messages: Vec<ChatMessage> = request.messages.into_iter().map(|m| ChatMessage {
        role: m.role,
        content: m.content,
    }).collect();

    // Extract user message for skill matching
    let user_query = messages.iter()
        .filter(|m| m.role == "user")
        .last()
        .map(|m| m.content.clone())
        .unwrap_or_default();

    // Enrich system prompt with matching skills
    let base_system_prompt = "You are a helpful AI assistant.";
    let enriched_system = if let Some(loader) = &state.skill_loader {
        loader
            .enrich_system_prompt(&user_query, &base_system_prompt)
            .await
            .unwrap_or_else(|_| base_system_prompt.to_string())
    } else {
        base_system_prompt.to_string()
    };

    tracing::debug!("Enriched system prompt with skills for query: {}", user_query);

    // Determine if we should offer skill tools
    let offer_skill_tools = state.skill_engine.is_some() && should_offer_skill_tools(&user_query);
    let tools = if offer_skill_tools {
        Some(get_skill_tools())
    } else {
        None
    };

    if stream {
        // For streaming, get the full response first then stream it
        let result = state.provider.chat_with_history(&messages, &model, temperature).await;

        match result {
            Ok(content) => {
                // Stream the response as a single chunk
                let chunk = ChatCompletionsChunk {
                    id: format!("chatcmpl-{}", Uuid::new_v4()),
                    object: "chat.completion.chunk",
                    created: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
                    model,
                    choices: vec![ChunkChoice {
                        index: 0,
                        delta: ChunkDelta {
                            role: Some("assistant"),
                            content: Some(content),
                        },
                        finish_reason: None,
                    }],
                };
                let chunk_json = serde_json::to_string(&chunk).unwrap();
                let final_chunk = ChatCompletionsChunk {
                    id: format!("chatcmpl-{}", Uuid::new_v4()),
                    object: "chat.completion.chunk",
                    created: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
                    model: "".to_string(),
                    choices: vec![ChunkChoice {
                        index: 0,
                        delta: ChunkDelta {
                            role: None,
                            content: None,
                        },
                        finish_reason: Some("stop"),
                    }],
                };
                let final_json = serde_json::to_string(&final_chunk).unwrap();
                let sse_data = format!("data: {}\n\ndata: {}\n\ndata: [DONE]\n\n", chunk_json, final_json);
                let sse_stream = futures_util::stream::once(async move {
                    Ok::<_, std::io::Error>(axum::body::Bytes::from(sse_data))
                });
                axum::response::Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "text/event-stream")
                    .body(Body::from_stream(sse_stream.boxed()))
                    .unwrap()
                    .into_response()
            }
            Err(e) => {
                let err = serde_json::json!({
                    "error": {
                        "message": e.to_string(),
                        "type": "provider_error",
                        "code": "internal_error"
                    }
                });
                (StatusCode::INTERNAL_SERVER_ERROR, Json(err)).into_response()
            }
        }
    } else {
        // Non-streaming: use chat_with_tools if tools are available
        let response = if let Some(ref tools_vec) = tools {
            // Try chat_with_tools for native tool calling
            state.provider.chat_with_tools(&messages, tools_vec, &model, temperature).await
        } else {
            // Fall back to regular chat
            state.provider.chat_with_history(&messages, &model, temperature).await
                .map(|text| crate::providers::traits::ChatResponse {
                    text: Some(text),
                    tool_calls: Vec::new(),
                    usage: None,
                    reasoning_content: None,
                })
        };

        match response {
            Ok(chat_response) => {
                // Check if there are tool calls to execute
                if chat_response.has_tool_calls() {
                    let mut tool_results = Vec::new();

                    for tool_call in &chat_response.tool_calls {
                        if tool_call.name == "store_skill" {
                            // Parse arguments
                            let args: serde_json::Value = match serde_json::from_str(&tool_call.arguments) {
                                Ok(a) => a,
                                Err(e) => {
                                    tool_results.push(format!("Error parsing arguments: {}", e));
                                    continue;
                                }
                            };

                            // Execute the tool
                            let result = execute_store_skill(&state, &args).await;
                            tool_results.push(result.unwrap_or_else(|e| e));
                        }
                    }

                    // If we executed tools, generate a follow-up response
                    if !tool_results.is_empty() {
                        let tool_result_text = tool_results.join("\n");

                        // Create a follow-up message with tool results
                        let follow_up_content = format!(
                            "I've processed your request. Here's what happened:\n\n{}",
                            tool_result_text
                        );

                        let response = ChatCompletionsResponse {
                            id: format!("chatcmpl-{}", Uuid::new_v4()),
                            object: "chat.completion",
                            created: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
                            model,
                            choices: vec![ChatCompletionsChoice {
                                index: 0,
                                message: ChatCompletionsResponseMessage {
                                    role: "assistant",
                                    content: follow_up_content,
                                },
                                finish_reason: "stop",
                            }],
                            usage: ChatCompletionsUsage {
                                prompt_tokens: chat_response.usage.as_ref().and_then(|u| u.input_tokens).map(|t| t as u32).unwrap_or(0),
                                completion_tokens: chat_response.usage.as_ref().and_then(|u| u.output_tokens).map(|t| t as u32).unwrap_or(0),
                                total_tokens: 0,
                            },
                        };
                        return (StatusCode::OK, Json(serde_json::to_value(response).unwrap())).into_response();
                    }
                }

                // No tool calls - return regular response
                let content = chat_response.text.clone().unwrap_or_default();
                let response = ChatCompletionsResponse {
                    id: format!("chatcmpl-{}", Uuid::new_v4()),
                    object: "chat.completion",
                    created: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
                    model,
                    choices: vec![ChatCompletionsChoice {
                        index: 0,
                        message: ChatCompletionsResponseMessage { role: "assistant", content },
                        finish_reason: "stop",
                    }],
                    usage: ChatCompletionsUsage {
                        prompt_tokens: chat_response.usage.as_ref().and_then(|u| u.input_tokens).map(|t| t as u32).unwrap_or(0),
                        completion_tokens: chat_response.usage.as_ref().and_then(|u| u.output_tokens).map(|t| t as u32).unwrap_or(0),
                        total_tokens: 0,
                    },
                };
                (StatusCode::OK, Json(serde_json::to_value(response).unwrap())).into_response()
            }
            Err(e) => {
                let err = serde_json::json!({
                    "error": {
                        "message": e.to_string(),
                        "type": "provider_error",
                        "code": "internal_error"
                    }
                });
                (StatusCode::INTERNAL_SERVER_ERROR, Json(err)).into_response()
            }
        }
    }
}

pub async fn handle_v1_models(State(state): State<AppState>, _headers: HeaderMap) -> impl IntoResponse {
    let response = ModelsResponse {
        object: "list",
        data: vec![ModelObject {
            id: state.model.clone(),
            object: "model",
            created: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
            owned_by: "zeroclaw".to_string(),
        }],
    };
    (StatusCode::OK, Json(serde_json::to_value(response).unwrap()))
}
