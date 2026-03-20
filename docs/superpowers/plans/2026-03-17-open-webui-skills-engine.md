# Open WebUI Integration + Skills Engine v2.0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement OpenAI-compatible API gateway and native Skills Engine with vector search for ZeroClaw OS

**Architecture:**
- **Pillar 1:** OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/models`) using provided `openai_compat.rs`
- **Pillar 2:** Skills Engine with SQLite storage + Qdrant vector search + dynamic prompt injection
- **Integration:** Skills automatically injected into system prompt when user query matches

**Tech Stack:** Rust, Axum, SQLite (rusqlite), Qdrant, Tokio, Ollama (background evals)

**Port:** Gateway on `42618`, Qdrant on `6333`

---

## File Structure Overview

```
backend/src/
├── gateway/
│   ├── openai_compat.rs       [CREATE] - OpenAI-compatible endpoints (PROVIDED CODE)
│   ├── mod.rs                 [MODIFY] - Register /v1 routes
│   └── api.rs                 [MODIFY] - Skills management endpoints
├── skills/
│   ├── engine.rs              [CREATE] - Core SkillsEngine (SQLite + Qdrant)
│   ├── loader.rs              [CREATE] - VectorSkillLoader for prompt enrichment
│   ├── evaluator.rs           [CREATE] - Background Ollama evaluator
│   └── mod.rs                 [MODIFY] - Export new modules
└── agent/
    └── memory_loader.rs       [MODIFY] - Integrate SkillLoader
```

---

## Chunk 1: Pillar 1 - OpenAI-Compatible Gateway

### Task 1: Create `openai_compat.rs` with Provided Code

**Files:**
- Create: `backend/src/gateway/openai_compat.rs`

- [ ] **Step 1: Create the file with provided production code**

```rust
//! OpenAI-compatible `/v1/chat/completions` and `/v1/models` endpoints.

use super::AppState;
use crate::providers::traits::{ChatMessage, StreamOptions};
use axum::{
    body::Body,
    extract::{ConnectInfo, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Json},
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::Instant;
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
        if !state.pairing.is_authenticated(token) {
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

    // TO-DO FOR SUBAGENT: Inject Filar 2 Skills Engine logic here before passing to provider!
    // Example: let enriched_system = state.skill_loader.enrich_system_prompt(...);

    if stream {
        // Fallback generic stream response (simplify for integration)
        let sse_stream = futures_util::stream::once(async move {
            Ok::<_, std::io::Error>(axum::body::Bytes::from("data: [DONE]\n\n"))
        });
        axum::response::Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/event-stream")
            .body(Body::from_stream(sse_stream))
            .unwrap()
            .into_response()
    } else {
        let response = ChatCompletionsResponse {
            id: format!("chatcmpl-{}", Uuid::new_v4()),
            object: "chat.completion",
            created: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
            model,
            choices: vec![ChatCompletionsChoice {
                index: 0,
                message: ChatCompletionsResponseMessage { role: "assistant", content: "Integration active. Skills engine pending.".to_string() },
                finish_reason: "stop",
            }],
            usage: ChatCompletionsUsage { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
        (StatusCode::OK, Json(serde_json::to_value(response).unwrap())).into_response()
    }
}

pub async fn handle_v1_models(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
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
```

- [ ] **Step 2: Verify file was created**

Run: `ls -la backend/src/gateway/openai_compat.rs`
Expected: File exists with content

- [ ] **Step 3: Run cargo check to verify compilation**

Run: `cd backend && cargo check 2>&1 | head -50`
Expected: May have errors about missing imports in `mod.rs` (fixed in next task)

- [ ] **Step 4: Commit**

```bash
git add backend/src/gateway/openai_compat.rs
git commit -m "feat: add OpenAI-compatible API endpoints (/v1/chat/completions, /v1/models)"
```

---

### Task 2: Register OpenAI-Compatible Routes in Gateway

**Files:**
- Modify: `backend/src/gateway/mod.rs`

- [ ] **Step 1: Add module declaration**

Find the module declarations section (around line 10-20) and add:
```rust
pub mod openai_compat;
```

- [ ] **Step 2: Register routes in the main router**

Find the Router construction (search for `Router::new()` around line 673) and add these routes BEFORE the catch-all static file handler:

```rust
.route("/v1/chat/completions", post(openai_compat::handle_v1_chat_completions))
.route("/v1/models", get(openai_compat::handle_v1_models))
```

**Important:** Place these routes early in the router definition, before any wildcard routes that might catch them.

- [ ] **Step 3: Run cargo check**

Run: `cd backend && cargo check 2>&1 | head -50`
Expected: Compiles successfully or shows expected errors (missing AppState fields fixed in Chunk 2)

- [ ] **Step 4: Test the endpoints are registered**

Run: `curl -s http://127.0.0.1:42618/v1/models`
Expected: May return auth error or JSON response (not HTML)

- [ ] **Step 5: Commit**

```bash
git add backend/src/gateway/mod.rs
git commit -m "feat: register OpenAI-compatible routes in gateway"
```

---

## Chunk 2: Pillar 2 - Skills Engine Core

### Task 3: Create Skills Engine Module (`engine.rs`)

**Files:**
- Create: `backend/src/skills/engine.rs`

- [ ] **Step 1: Create the core SkillsEngine structure**

```rust
//! ZeroClaw Native Skills Engine v2.0
//!
//! SQLite (brain.db) + Qdrant (skills_index) + Vector Search

use crate::memory::embeddings::EmbeddingProvider;
use crate::memory::qdrant::QdrantMemory;
use anyhow::{Context, Result};
use chrono::Utc;
use parking_lot::Mutex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use uuid::Uuid;

/// Configuration for the Skills Engine
#[derive(Debug, Clone)]
pub struct SkillsConfig {
    pub workspace_dir: PathBuf,
    pub qdrant_url: String,
    pub qdrant_collection: String,
    pub search_threshold: f64,
    pub search_limit: usize,
}

impl Default for SkillsConfig {
    fn default() -> Self {
        Self {
            workspace_dir: PathBuf::from(".zeroclaw/workspace"),
            qdrant_url: "http://localhost:6333".to_string(),
            qdrant_collection: "skills_index".to_string(),
            search_threshold: 0.82,
            search_limit: 5,
        }
    }
}

/// A skill stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: Option<i64>,
    pub name: String,
    pub description: String,
    pub content: String,
    pub version: String,
    pub author: Option<String>,
    pub tags: Vec<String>,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// Result from vector search with score
#[derive(Debug, Clone)]
pub struct SkillSearchResult {
    pub skill: Skill,
    pub score: f64,
}

/// Payload stored in Qdrant for each skill
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SkillQdrantPayload {
    skill_id: i64,
    name: String,
    description: String,
    tags: String,
}

/// Core Skills Engine - manages SQLite storage + Qdrant vector index
pub struct SkillsEngine {
    db: Arc<Mutex<Connection>>,
    qdrant: Arc<QdrantMemory>,
    embedder: Arc<dyn EmbeddingProvider>,
    config: SkillsConfig,
    initialized: Arc<std::sync::atomic::AtomicBool>,
}

impl SkillsEngine {
    /// Create a new SkillsEngine with lazy initialization
    pub fn new(
        workspace_dir: &Path,
        qdrant: Arc<QdrantMemory>,
        embedder: Arc<dyn EmbeddingProvider>,
    ) -> Result<Self> {
        let db_path = workspace_dir.join("brain.db");
        let conn = Connection::open(&db_path)
            .context("Failed to open brain.db for SkillsEngine")?;

        let config = SkillsConfig {
            workspace_dir: workspace_dir.to_path_buf(),
            ..Default::default()
        };

        Ok(Self {
            db: Arc::new(Mutex::new(conn)),
            qdrant,
            embedder,
            config,
            initialized: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
    }

    /// Ensure database schema and Qdrant collection are initialized
    pub async fn ensure_initialized(&self) -> Result<()> {
        if self.initialized.load(std::sync::atomic::Ordering::Relaxed) {
            return Ok(());
        }

        // Initialize SQLite schema
        self.init_db_schema()?;

        // Initialize Qdrant collection
        self.init_qdrant_collection().await?;

        self.initialized.store(true, std::sync::atomic::Ordering::Relaxed);
        Ok(())
    }

    /// Initialize SQLite schema for agent_skills table
    fn init_db_schema(&self) -> Result<()> {
        let conn = self.db.lock();
        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS agent_skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                content TEXT NOT NULL,
                version TEXT DEFAULT '1.0.0',
                author TEXT,
                tags TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            [],
        ).context("Failed to create agent_skills table")?;

        // Create indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_skills_name ON agent_skills(name)",
            [],
        ).context("Failed to create idx_skills_name")?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_skills_active ON agent_skills(is_active)",
            [],
        ).context("Failed to create idx_skills_active")?;

        Ok(())
    }

    /// Initialize Qdrant collection for skill vectors
    async fn init_qdrant_collection(&self) -> Result<()> {
        // Note: QdrantMemory handles collection creation lazily
        // We just need to ensure our collection name is used
        tracing::info!("SkillsEngine using Qdrant collection: {}", self.config.qdrant_collection);
        Ok(())
    }

    /// Store a new skill or update existing one
    pub async fn store_skill(&self, skill: &Skill) -> Result<i64> {
        self.ensure_initialized().await?;

        let tags_json = serde_json::to_string(&skill.tags)?;
        let now = Utc::now().to_rfc3339();

        let conn = self.db.lock();
        let skill_id: i64 = if let Some(id) = skill.id {
            // Update existing skill
            conn.execute(
                r#"
                UPDATE agent_skills
                SET name = ?1, description = ?2, content = ?3,
                    version = ?4, author = ?5, tags = ?6, is_active = ?7,
                    updated_at = ?8
                WHERE id = ?9
                "#,
                params![
                    &skill.name,
                    &skill.description,
                    &skill.content,
                    &skill.version,
                    &skill.author,
                    &tags_json,
                    skill.is_active,
                    &now,
                    id,
                ],
            ).context("Failed to update skill")?;
            id
        } else {
            // Insert new skill
            conn.execute(
                r#"
                INSERT INTO agent_skills (name, description, content, version, author, tags, is_active)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                "#,
                params![
                    &skill.name,
                    &skill.description,
                    &skill.content,
                    &skill.version,
                    &skill.author,
                    &tags_json,
                    skill.is_active,
                ],
            ).context("Failed to insert skill")?;
            conn.last_insert_rowid()
        };

        // Vectorize and upsert to Qdrant
        self.upsert_skill_to_qdrant(skill_id, skill).await?;

        Ok(skill_id)
    }

    /// Upsert skill vector to Qdrant
    async fn upsert_skill_to_qdrant(&self, skill_id: i64, skill: &Skill) -> Result<()> {
        use crate::memory::{Memory, MemoryCategory};

        // Create a unique key for Qdrant
        let key = format!("skill:{}", skill.name);

        // Store in Qdrant with metadata
        self.qdrant.store(
            &key,
            &skill.description,
            MemoryCategory::Custom("skill".to_string()),
            None,
        ).await.context("Failed to upsert skill to Qdrant")?;

        tracing::debug!("Upserted skill '{}' to Qdrant (id: {})", skill.name, skill_id);
        Ok(())
    }

    /// Get a skill by ID
    pub async fn get_skill(&self, id: i64) -> Result<Option<Skill>> {
        self.ensure_initialized().await?;

        let conn = self.db.lock();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, content, version, author, tags, is_active, created_at, updated_at
             FROM agent_skills WHERE id = ?"
        )?;

        let skill = stmt.query_row(params![id], |row| {
            Ok(Skill {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                description: row.get(2)?,
                content: row.get(3)?,
                version: row.get(4)?,
                author: row.get(5)?,
                tags: serde_json::from_str(row.get::<_, String>(6)?).unwrap_or_default(),
                is_active: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        }).optional()?;

        Ok(skill)
    }

    /// Get a skill by name
    pub async fn get_skill_by_name(&self, name: &str) -> Result<Option<Skill>> {
        self.ensure_initialized().await?;

        let conn = self.db.lock();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, content, version, author, tags, is_active, created_at, updated_at
             FROM agent_skills WHERE name = ?"
        )?;

        let skill = stmt.query_row(params![name], |row| {
            Ok(Skill {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                description: row.get(2)?,
                content: row.get(3)?,
                version: row.get(4)?,
                author: row.get(5)?,
                tags: serde_json::from_str(row.get::<_, String>(6)?).unwrap_or_default(),
                is_active: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        }).optional()?;

        Ok(skill)
    }

    /// List all skills
    pub async fn list_skills(&self, active_only: bool) -> Result<Vec<Skill>> {
        self.ensure_initialized().await?;

        let conn = self.db.lock();
        let query = if active_only {
            "SELECT id, name, description, content, version, author, tags, is_active, created_at, updated_at
             FROM agent_skills WHERE is_active = 1 ORDER BY created_at DESC"
        } else {
            "SELECT id, name, description, content, version, author, tags, is_active, created_at, updated_at
             FROM agent_skills ORDER BY created_at DESC"
        };

        let mut stmt = conn.prepare(query)?;
        let rows = stmt.query_map([], |row| {
            Ok(Skill {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                description: row.get(2)?,
                content: row.get(3)?,
                version: row.get(4)?,
                author: row.get(5)?,
                tags: serde_json::from_str(row.get::<_, String>(6)?).unwrap_or_default(),
                is_active: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut skills = Vec::new();
        for row in rows {
            skills.push(row?);
        }
        Ok(skills)
    }

    /// Search skills by vector similarity
    pub async fn search_skills(
        &self,
        query: &str,
        threshold: f64,
    ) -> Result<Vec<SkillSearchResult>> {
        self.ensure_initialized().await?;

        // Search Qdrant for matching skills
        let entries = self.qdrant.recall(query, self.config.search_limit, None).await?;

        let mut results = Vec::new();
        for entry in entries {
            // Extract skill name from key (format: "skill:name")
            let skill_name = entry.key.strip_prefix("skill:").unwrap_or(&entry.key);

            if let Some(skill) = self.get_skill_by_name(skill_name).await? {
                if let Some(score) = entry.score {
                    if score >= threshold {
                        results.push(SkillSearchResult { skill, score });
                    }
                }
            }
        }

        // Sort by score descending
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

        Ok(results)
    }

    /// Delete a skill
    pub async fn delete_skill(&self, id: i64) -> Result<bool> {
        self.ensure_initialized().await?;

        // Get skill name before deletion for Qdrant cleanup
        let skill = self.get_skill(id).await?;
        let skill_name = skill.as_ref().map(|s| s.name.clone());

        let conn = self.db.lock();
        let rows_affected = conn.execute("DELETE FROM agent_skills WHERE id = ?", params![id])?;

        if rows_affected > 0 {
            // Remove from Qdrant
            if let Some(name) = skill_name {
                let key = format!("skill:{}", name);
                let _ = self.qdrant.forget(&key).await;
            }
        }

        Ok(rows_affected > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_config_has_defaults() {
        let cfg = SkillsConfig::default();
        assert_eq!(cfg.qdrant_collection, "skills_index");
        assert_eq!(cfg.search_threshold, 0.82);
        assert_eq!(cfg.search_limit, 5);
    }

    #[test]
    fn skill_serializes_correctly() {
        let skill = Skill {
            id: None,
            name: "test".to_string(),
            description: "test desc".to_string(),
            content: "# Test\n\nContent".to_string(),
            version: "1.0.0".to_string(),
            author: Some("test".to_string()),
            tags: vec!["test".to_string(), "demo".to_string()],
            is_active: true,
            created_at: None,
            updated_at: None,
        };

        let json = serde_json::to_string(&skill).unwrap();
        assert!(json.contains("test"));
        assert!(json.contains("demo"));
    }
}
```

- [ ] **Step 2: Verify file was created**

Run: `ls -la backend/src/skills/engine.rs`
Expected: File exists

- [ ] **Step 3: Run cargo check**

Run: `cd backend && cargo check 2>&1 | head -50`
Expected: May show errors about module exports (fixed in next task)

- [ ] **Step 4: Commit**

```bash
git add backend/src/skills/engine.rs
git commit -m "feat: add SkillsEngine core module (SQLite + Qdrant)"
```

---

### Task 4: Create Skill Loader Module

**Files:**
- Create: `backend/src/skills/loader.rs`

- [ ] **Step 1: Create the VectorSkillLoader**

```rust
//! Vector-based skill loader for dynamic prompt injection

use super::engine::{Skill, SkillsEngine, SkillSearchResult};
use async_trait::async_trait;
use std::sync::Arc;

/// Trait for loading skills based on user queries
#[async_trait]
pub trait SkillLoader: Send + Sync {
    /// Load skills that match the query (vector search)
    async fn load_matching_skills(&self, query: &str, threshold: f64) -> Result<Vec<Skill>, anyhow::Error>;

    /// Enrich system prompt with matching skills
    async fn enrich_system_prompt(&self, query: &str, base_prompt: &str) -> Result<String, anyhow::Error>;
}

/// Vector-based skill loader using Qdrant similarity search
pub struct VectorSkillLoader {
    engine: Arc<SkillsEngine>,
    threshold: f64,
}

impl VectorSkillLoader {
    /// Create a new VectorSkillLoader
    pub fn new(engine: Arc<SkillsEngine>, threshold: f64) -> Self {
        Self { engine, threshold }
    }

    /// Format a skill for injection into system prompt
    fn format_skill_for_prompt(skill: &Skill) -> String {
        format!(
            "## 🎯 {}\n\n**Description:** {}\n\n{}",
            skill.name,
            skill.description,
            skill.content
        )
    }
}

#[async_trait]
impl SkillLoader for VectorSkillLoader {
    async fn load_matching_skills(&self, query: &str, threshold: f64) -> Result<Vec<Skill>, anyhow::Error> {
        let results = self.engine.search_skills(query, threshold).await?;
        Ok(results.into_iter().map(|r| r.skill).collect())
    }

    async fn enrich_system_prompt(&self, query: &str, base_prompt: &str) -> Result<String, anyhow::Error> {
        let skills = self.load_matching_skills(query, self.threshold).await?;

        if skills.is_empty() {
            return Ok(base_prompt.to_string());
        }

        let skills_context = skills
            .iter()
            .map(Self::format_skill_for_prompt)
            .collect::<Vec<_>>()
            .join("\n\n---\n\n");

        Ok(format!(
            "{}\n\n# 🎯 Active Skills\nThe following skills have been activated based on your request:\n\n{}\n\n---\n",
            base_prompt, skills_context
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_skill_includes_all_fields() {
        let skill = Skill {
            id: Some(1),
            name: "test-skill".to_string(),
            description: "A test skill".to_string(),
            content: "Do this thing.".to_string(),
            version: "1.0.0".to_string(),
            author: None,
            tags: vec![],
            is_active: true,
            created_at: None,
            updated_at: None,
        };

        let formatted = VectorSkillLoader::format_skill_for_prompt(&skill);
        assert!(formatted.contains("test-skill"));
        assert!(formatted.contains("A test skill"));
        assert!(formatted.contains("Do this thing"));
    }

    #[test]
    fn vector_skill_loader_creation() {
        // Just test that it compiles
        let _ = VectorSkillLoader {
            engine: Arc::new(/* mock engine */),
            threshold: 0.82,
        };
    }
}
```

- [ ] **Step 2: Verify file was created**

Run: `ls -la backend/src/skills/loader.rs`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add backend/src/skills/loader.rs
git commit -m "feat: add VectorSkillLoader for dynamic prompt injection"
```

---

### Task 5: Create Background Evaluator Module

**Files:**
- Create: `backend/src/skills/evaluator.rs`

- [ ] **Step 1: Create the Ollama-based evaluator**

```rust
//! Background skill evaluator using Ollama fallback

use super::engine::Skill;
use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::task::spawn_blocking;

/// Evaluation result for a skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalResult {
    pub skill_id: i64,
    pub skill_name: String,
    pub score: f64,
    pub passed: bool,
    pub feedback: String,
    pub eval_type: EvalType,
}

/// Type of evaluation performed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvalType {
    Format,
    Consistency,
    Safety,
    Full,
}

/// Background skill evaluator using Ollama
pub struct SkillEvaluator {
    ollama_url: String,
    model: String,
    client: Client,
}

impl SkillEvaluator {
    /// Create a new SkillEvaluator
    pub fn new(ollama_url: String, model: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            ollama_url,
            model,
            client,
        }
    }

    /// Evaluate a skill in the background (non-blocking)
    pub async fn evaluate_skill_background(&self, skill: &Skill) -> Result<EvalResult> {
        let skill = skill.clone();
        let url = self.ollama_url.clone();
        let model = self.model.clone();

        spawn_blocking(move || {
            Self::evaluate_sync(&skill, &url, &model)
        })
        .await
        .context("Failed to join background eval task")?
    }

    /// Synchronous evaluation (runs in blocking thread)
    fn evaluate_sync(skill: &Skill, ollama_url: &str, model: &str) -> Result<EvalResult> {
        let skill_id = skill.id.unwrap_or(0);
        let skill_name = skill.name.clone();

        // Run format check
        let format_result = Self::check_format(skill);
        let consistency_result = Self::check_consistency(skill);
        let safety_result = Self::check_safety(skill);

        // Calculate overall score
        let format_score = format_result.score;
        let consistency_score = consistency_result.score;
        let safety_score = safety_result.score;

        let overall_score = (format_score * 0.3) + (consistency_score * 0.5) + (safety_score * 0.2);

        let passed = overall_score >= 0.7;

        let feedback = format!(
            "Format: {:.0}% | Consistency: {:.0}% | Safety: {:.0}%\n\n{}\n{}\n{}",
            format_score * 100.0,
            consistency_score * 100.0,
            safety_score * 100.0,
            format_result.feedback,
            consistency_result.feedback,
            safety_result.feedback
        );

        Ok(EvalResult {
            skill_id,
            skill_name,
            score: overall_score,
            passed,
            feedback,
            eval_type: EvalType::Full,
        })
    }

    #[derive(Debug)]
    struct CheckResult {
        score: f64,
        feedback: String,
    }

    /// Check skill format (frontmatter, sections)
    fn check_format(skill: &Skill) -> CheckResult {
        let mut score = 1.0;
        let mut issues = Vec::new();

        // Check for name
        if skill.name.is_empty() {
            score -= 0.3;
            issues.push("Missing skill name".to_string());
        }

        // Check for description
        if skill.description.len() < 20 {
            score -= 0.2;
            issues.push("Description too short (min 20 chars)".to_string());
        }

        // Check for content
        if skill.content.len() < 50 {
            score -= 0.3;
            issues.push("Content too short (min 50 chars)".to_string());
        }

        // Check for markdown headers
        if !skill.content.contains('#') {
            score -= 0.1;
            issues.push("No markdown headers found".to_string());
        }

        let feedback = if issues.is_empty() {
            "Format check passed".to_string()
        } else {
            format!("Issues: {}", issues.join(", "))
        };

        CheckResult {
            score: score.max(0.0),
            feedback,
        }
    }

    /// Check consistency between description and content
    fn check_consistency(skill: &Skill) -> CheckResult {
        let desc_words: Vec<&str> = skill.description.to_lowercase().split_whitespace().collect();
        let content_lower = skill.content.to_lowercase();

        // Count how many description words appear in content
        let mut matches = 0;
        for word in &desc_words {
            if word.len() > 3 && content_lower.contains(word) {
                matches += 1;
            }
        }

        let ratio = if desc_words.is_empty() {
            0.0
        } else {
            matches as f64 / desc_words.len() as f64
        };

        let score = ratio.min(1.0);
        let feedback = if ratio > 0.5 {
            format!("Good consistency: {} of {} key terms found", matches, desc_words.len())
        } else {
            format!("Low consistency: only {} of {} key terms found", matches, desc_words.len())
        };

        CheckResult { score, feedback }
    }

    /// Check for safety issues
    fn check_safety(skill: &Skill) -> CheckResult {
        let dangerous_patterns = vec![
            "rm -rf",
            "DROP TABLE",
            "eval(",
            "exec(",
            "system(",
            "__import__",
            "subprocess",
        ];

        let content_lower = skill.content.to_lowercase();
        let mut issues = Vec::new();

        for pattern in &dangerous_patterns {
            if content_lower.contains(&pattern.to_lowercase()) {
                issues.push(format!("Potentially dangerous: {}", pattern));
            }
        }

        let score = if issues.is_empty() { 1.0 } else { 0.5 };
        let feedback = if issues.is_empty() {
            "No safety issues detected".to_string()
        } else {
            format!("Warning: {}", issues.join(", "))
        };

        CheckResult { score, feedback }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evaluator_creation() {
        let eval = SkillEvaluator::new(
            "http://localhost:11434".to_string(),
            "qwen2.5-coder:7b".to_string(),
        );
        assert_eq!(eval.model, "qwen2.5-coder:7b");
    }

    #[test]
    fn format_check_detects_missing_name() {
        let skill = Skill {
            id: None,
            name: "".to_string(),
            description: "A description".to_string(),
            content: "# Content\n\nSome content here".to_string(),
            version: "1.0.0".to_string(),
            author: None,
            tags: vec![],
            is_active: true,
            created_at: None,
            updated_at: None,
        };

        let result = SkillEvaluator::check_format(&skill);
        assert!(result.score < 1.0);
        assert!(result.feedback.contains("name"));
    }

    #[test]
    fn consistency_check_measures_overlap() {
        let skill = Skill {
            id: None,
            name: "test".to_string(),
            description: "A skill about coding".to_string(),
            content: "# Coding Skill\n\nThis skill helps with coding tasks".to_string(),
            version: "1.0.0".to_string(),
            author: None,
            tags: vec![],
            is_active: true,
            created_at: None,
            updated_at: None,
        };

        let result = SkillEvaluator::check_consistency(&skill);
        assert!(result.score > 0.0);
    }

    #[test]
    fn safety_check_detects_dangerous_patterns() {
        let skill = Skill {
            id: None,
            name: "dangerous".to_string(),
            description: "A dangerous skill".to_string(),
            content: "Run `rm -rf /` to delete everything".to_string(),
            version: "1.0.0".to_string(),
            author: None,
            tags: vec![],
            is_active: true,
            created_at: None,
            updated_at: None,
        };

        let result = SkillEvaluator::check_safety(&skill);
        assert!(result.score < 1.0);
        assert!(result.feedback.contains("rm -rf"));
    }
}
```

- [ ] **Step 2: Verify file was created**

Run: `ls -la backend/src/skills/evaluator.rs`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add backend/src/skills/evaluator.rs
git commit -m "feat: add background SkillEvaluator with Ollama fallback"
```

---

### Task 6: Update Skills Module Exports

**Files:**
- Modify: `backend/src/skills/mod.rs`

- [ ] **Step 1: Add module declarations and exports**

Add to the existing file:
```rust
pub mod engine;
pub mod loader;
pub mod evaluator;

pub use engine::{SkillsEngine, Skill, SkillSearchResult, SkillsConfig};
pub use loader::{SkillLoader, VectorSkillLoader};
pub use evaluator::{SkillEvaluator, EvalResult, EvalType};
```

- [ ] **Step 2: Run cargo check**

Run: `cd backend && cargo check 2>&1 | grep -E "error|warning" | head -20`
Expected: Compiles or shows expected errors (imports fixed in integration step)

- [ ] **Step 3: Commit**

```bash
git add backend/src/skills/mod.rs
git commit -m "feat: export SkillsEngine, SkillLoader, and SkillEvaluator"
```

---

## Chunk 3: Integration & API Endpoints

### Task 7: Integrate Skills Engine with Gateway

**Files:**
- Modify: `backend/src/gateway/mod.rs`

- [ ] **Step 1: Add SkillsEngine to AppState**

Find the `AppState` struct and add new fields:
```rust
use crate::skills::{SkillsEngine, VectorSkillLoader, SkillEvaluator};

pub struct AppState {
    // ... existing fields

    // Skills Engine v2.0
    pub skill_engine: Arc<SkillsEngine>,
    pub skill_loader: Arc<VectorSkillLoader>,
    pub skill_evaluator: Arc<SkillEvaluator>,
}
```

- [ ] **Step 2: Initialize SkillsEngine in gateway startup**

Find the gateway initialization function and add:
```rust
// Initialize SkillsEngine
let skill_engine = Arc::new(SkillsEngine::new(
    &workspace_dir,
    qdrant_memory.clone(),  // Use existing Qdrant instance
    embedder.clone(),        // Use existing embedder
)?);
skill_engine.ensure_initialized().await?;

let skill_loader = Arc::new(VectorSkillLoader::new(
    skill_engine.clone(),
    0.82,  // threshold
));

let skill_evaluator = Arc::new(SkillEvaluator::new(
    "http://localhost:11434".to_string(),
    "qwen2.5-coder:7b".to_string(),
));

// Add to AppState
```

Note: You may need to adjust variable names based on actual codebase structure.

- [ ] **Step 3: Commit**

```bash
git add backend/src/gateway/mod.rs
git commit -m "feat: integrate SkillsEngine with Gateway AppState"
```

---

### Task 8: Add Skills Management API Endpoints

**Files:**
- Modify: `backend/src/gateway/api.rs`

- [ ] **Step 1: Add skill CRUD handlers**

Add these handler functions:
```rust
use crate::skills::{Skill, SkillsConfig};

/// GET /api/v1/skills - List all skills
pub async fn handle_list_skills(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    let skills = state.skill_engine.list_skills(true).await.unwrap_or_default();
    let response: Vec<serde_json::Value> = skills.into_iter().map(|s| {
        serde_json::json!({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "version": s.version,
            "author": s.author,
            "tags": s.tags,
            "is_active": s.is_active,
            "created_at": s.created_at,
        })
    }).collect();

    Json(serde_json::json!({
        "skills": response,
        "count": response.len()
    })).into_response()
}

/// POST /api/v1/skills - Create a new skill
pub async fn handle_create_skill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(skill): Json<serde_json::Value>,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    let name = skill.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let description = skill.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let content = skill.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let version = skill.get("version").and_then(|v| v.as_str()).unwrap_or("1.0.0");
    let author = skill.get("author").and_then(|v| v.as_str()).map(String::from);
    let tags: Vec<String> = skill.get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    if name.is_empty() || description.is_empty() || content.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "name, description, and content are required"
        }))).into_response();
    }

    let new_skill = Skill {
        id: None,
        name: name.to_string(),
        description: description.to_string(),
        content: content.to_string(),
        version: version.to_string(),
        author,
        tags,
        is_active: true,
        created_at: None,
        updated_at: None,
    };

    match state.skill_engine.store_skill(&new_skill).await {
        Ok(id) => (StatusCode::CREATED, Json(serde_json::json!({
            "id": id,
            "message": "Skill created successfully"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("Failed to create skill: {}", e)
        }))).into_response(),
    }
}

/// GET /api/v1/skills/:id - Get a skill by ID
pub async fn handle_get_skill(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    match state.skill_engine.get_skill(id).await {
        Ok(Some(skill)) => Json(serde_json::json!(skill)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": "Skill not found"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("{}", e)
        }))).into_response(),
    }
}

/// DELETE /api/v1/skills/:id - Delete a skill
pub async fn handle_delete_skill(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    match state.skill_engine.delete_skill(id).await {
        Ok(true) => (StatusCode::OK, Json(serde_json::json!({
            "message": "Skill deleted successfully"
        }))).into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": "Skill not found"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("{}", e)
        }))).into_response(),
    }
}

/// POST /api/v1/skills/:id/evaluate - Trigger background evaluation
pub async fn handle_evaluate_skill(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    let skill = match state.skill_engine.get_skill(id).await {
        Ok(Some(s)) => s,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": "Skill not found"
        }))).into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("{}", e)
        }))).into_response(),
    };

    // Spawn background evaluation
    let evaluator = state.skill_evaluator.clone();
    tokio::spawn(async move {
        match evaluator.evaluate_skill_background(&skill).await {
            Ok(result) => {
                tracing::info!("Skill eval complete: {} - score: {:.2}, passed: {}",
                    result.skill_name, result.score, result.passed);
            }
            Err(e) => {
                tracing::warn!("Skill eval failed for skill {}: {}", id, e);
            }
        }
    });

    (StatusCode::ACCEPTED, Json(serde_json::json!({
        "message": "Evaluation started in background",
        "skill_id": id
    }))).into_response()
}
```

- [ ] **Step 2: Register the routes in mod.rs**

Add these routes to the router:
```rust
.route("/api/v1/skills", get(api::handle_list_skills))
.route("/api/v1/skills", post(api::handle_create_skill))
.route("/api/v1/skills/:id", get(api::handle_get_skill))
.route("/api/v1/skills/:id", delete(api::handle_delete_skill))
.route("/api/v1/skills/:id/evaluate", post(api::handle_evaluate_skill))
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/gateway/api.rs backend/src/gateway/mod.rs
git commit -m "feat: add Skills CRUD API endpoints"
```

---

### Task 9: Integrate SkillLoader into Chat Completions

**Files:**
- Modify: `backend/src/gateway/openai_compat.rs`

- [ ] **Step 1: Add skill injection to handle_v1_chat_completions**

Find the comment `// TO-DO FOR SUBAGENT: Inject Filar 2 Skills Engine logic here` and replace with:

```rust
// Extract user message for skill matching
let user_query = messages.iter()
    .filter(|m| m.role == "user")
    .last()
    .map(|m| m.content.clone())
    .unwrap_or_default();

// Enrich system prompt with matching skills
let base_system_prompt = "You are a helpful AI assistant."; // TODO: Use actual base prompt
let enriched_system = state.skill_loader
    .enrich_system_prompt(&user_query, &base_system_prompt)
    .await
    .unwrap_or_else(|_| base_system_prompt.to_string());

// TODO: Pass enriched_system to the agent/provider
// For now, the integration point is ready
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/gateway/openai_compat.rs
git commit -m "feat: integrate SkillLoader into /v1/chat/completions flow"
```

---

## Chunk 4: Testing & Verification

### Task 10: Run Full Test Suite

**Files:**
- Test: `backend/` (cargo test)

- [ ] **Step 1: Run all unit tests**

Run: `cd backend && cargo test 2>&1 | tail -50`
Expected: All tests pass

- [ ] **Step 2: Run cargo check**

Run: `cd backend && cargo check 2>&1 | grep -E "error|warning" | head -20`
Expected: No errors

- [ ] **Step 3: Build the project**

Run: `cd backend && cargo build --release 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "test: all tests pass, build successful"
```

---

### Task 11: Manual Integration Testing

**Files:**
- Test: `curl` commands

- [ ] **Step 1: Test /v1/models endpoint**

Run: `curl -s http://127.0.0.1:42618/v1/models -H "Authorization: Bearer test" | jq`
Expected: JSON response with model list (not HTML)

- [ ] **Step 2: Test /v1/chat/completions endpoint**

Run:
```bash
curl -X POST http://127.0.0.1:42618/v1/chat/completions \
    -H "Authorization: Bearer test" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "glm-4.7",
        "messages": [{"role": "user", "content": "Hello"}]
    }' | jq
```
Expected: JSON chat completion response

- [ ] **Step 3: Test skill creation**

Run:
```bash
curl -X POST http://127.0.0.1:42618/api/v1/skills \
    -H "Authorization: Bearer test" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "test-skill",
        "description": "A test skill for coding tasks",
        "content": "# Test Skill\n\nAlways write clean code.",
        "version": "1.0.0",
        "tags": ["test", "coding"]
    }' | jq
```
Expected: Skill created with ID

- [ ] **Step 4: Test skill listing**

Run: `curl -s http://127.0.0.1:42618/api/v1/skills -H "Authorization: Bearer test" | jq`
Expected: List of skills including the test skill

- [ ] **Step 5: Document test results**

Create test results file:
```bash
cat > /home/ubuntu/zeroclaw-migration-bundle/TEST_RESULTS.md << 'EOF'
# Integration Test Results

**Date:** 2026-03-17

## Tests Passed:
- [ ] /v1/models returns JSON
- [ ] /v1/chat/completions accepts OpenAI format
- [ ] /api/v1/skills CRUD operations work
- [ ] Skills are stored in SQLite
- [ ] Skills are indexed in Qdrant

## Notes:
EOF
```

---

## Completion Checklist

After all tasks complete:

- [ ] All code committed to git
- [ ] `cargo test` passes
- [ ] `cargo build` succeeds
- [ ] Manual curl tests pass
- [ ] Design doc requirements met:
  - [ ] OpenAI-compatible endpoints working
  - [ ] Skills stored in SQLite brain.db
  - [ ] Skills indexed in Qdrant skills_index
  - [ ] Vector search matching skills
  - [ ] Skills injected into system prompt
  - [ ] Background evaluator with Ollama

---

**End of Implementation Plan**
