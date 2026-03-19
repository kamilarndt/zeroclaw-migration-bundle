# ZeroClaw OS: Open WebUI Integration + Skills Engine v2.0

**Date:** 2026-03-17
**Architect:** ZeroClaw Core Team
**Status:** Design Phase
**Workspace:** `/home/ubuntu/zeroclaw-migration-bundle`
**Ports:** Gateway `42618`, Qdrant `6333`

---

## Executive Summary

This document outlines the implementation of two major architectural pillars for ZeroClaw OS:

1. **Pillar 1: OpenAI-Compatible Gateway** - Enables Open WebUI as a dumb client
2. **Pillar 2: Native Skills Engine v2.0** - Dynamic skill loading via vector search

Both implementations adhere to the "Zero-Bloat" philosophy: all logic resides natively in the Rust backend with zero modifications to Open WebUI.

---

## Architecture Overview

```
┌─────────────────┐
│   Open WebUI    │  (dumb client - no modifications)
└────────┬────────┘
         │ HTTP/JSON
         ↓
┌─────────────────────────────────────────────────────────┐
│  ZeroClaw Gateway (port 42618)                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  /v1/chat/completions (openai_compat.rs)         │  │
│  │  ├── JWT Auth (state.pairing.is_authenticated)   │  │
│  │  ├── Skills Engine Hook (vector match → inject)  │  │
│  │  ├── Agent (with enriched system prompt)         │  │
│  │  └── Model Routing (Z.AI, OpenRouter, etc.)      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Skills Engine v2.0                               │  │
│  │  ├── SQLite (brain.db) - Full skill content      │  │
│  │  ├── Qdrant (skills_index) - Vector search       │  │
│  │  └── Background Evaluator (Ollama fallback)      │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## PILLAR 1: OpenAI-Compatible Gateway

### 1.1 Module: `src/gateway/openai_compat.rs`

**Purpose:** Implements OpenAI API-compatible endpoints for Open WebUI integration.

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/chat/completions` | Chat completions with SSE streaming |
| GET | `/v1/models` | List available models from routes |

**Request/Response Structures:**
```rust
#[derive(Debug, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub temperature: f32,
    #[serde(default)]
    pub stream: bool,
    #[serde(default)]
    pub tools: Option<Vec<ToolDefinition>>,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<Choice>,
    pub usage: Usage,
}

#[derive(Debug, Serialize)]
pub struct ModelResponse {
    pub object: String,
    pub data: Vec<ModelInfo>,
}
```

**Authentication:**
```rust
async fn require_auth(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(), impl IntoResponse>
{
    let auth_header = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Missing auth header"))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid auth format"))?;

    if !state.pairing.is_authenticated(token) {
        return Err((StatusCode::UNAUTHORIZED, "Invalid token"));
    }
    Ok(())
}
```

**SSE Streaming:**
- Reuse existing `src/gateway/sse.rs` infrastructure
- Stream chunks in `delta` format matching OpenAI spec

---

### 1.2 Router Registration: `src/gateway/mod.rs`

**Changes:**
```rust
// Add module declaration
pub mod openai_compat;

// In router construction
.route("/v1/chat/completions", post(openai_compat::handle_v1_chat_completions))
.route("/v1/models", get(openai_compat::handle_v1_models))
```

**Placement:** Register routes BEFORE catch-all static file handler to ensure JSON responses instead of HTML fallback.

---

## PILLAR 2: Native Skills Engine v2.0

### 2.1 SQLite Schema (`brain.db`)

**Table: `agent_skills`**
```sql
CREATE TABLE IF NOT EXISTS agent_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,       -- Vectorized for Qdrant
    content TEXT NOT NULL,            -- Full SKILL.md content
    version TEXT DEFAULT '1.0.0',
    author TEXT,
    tags TEXT,                        -- JSON array: '["tag1", "tag2"]'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_skills_name ON agent_skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_active ON agent_skills(is_active);
CREATE INDEX IF NOT EXISTS idx_skills_created ON agent_skills(created_at);
```

**Migration:**
```rust
const SKILLS_SCHEMA_MIGRATION: &str = r#"
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS agent_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    version TEXT DEFAULT '1.0.0',
    author TEXT,
    tags TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_skills_name ON agent_skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_active ON agent_skills(is_active);

COMMIT;
"#;
```

---

### 2.2 Qdrant Collection: `skills_index`

**Collection Config:**
```rust
struct SkillsCollectionConfig {
    name: "skills_index",
    vectors: {
        size: <embedding_dimensions>,  // From embedder
        distance: "Cosine",
    },
    payload_schema: {
        "skill_id": "integer",
        "name": "keyword",
        "description": "text",
    },
}
```

**Payload Structure:**
```rust
#[derive(Serialize, Deserialize)]
struct SkillQdrantPayload {
    skill_id: i64,
    name: String,
    description: String,
}
```

**Operations:**
| Operation | Action |
|-----------|--------|
| **Upsert** | When skill is saved/updated: vectorize `description` → upsert to Qdrant |
| **Search** | Convert user query to vector → search `skills_index` → return top N with scores |
| **Delete** | Remove skill from SQLite → delete point from Qdrant by `skill_id` |

---

### 2.3 Core Module: `src/skills/engine.rs`

**Struct:**
```rust
pub struct SkillsEngine {
    db: Arc<Mutex<Connection>>,
    qdrant: Arc<QdrantMemory>,
    embedder: Arc<dyn EmbeddingProvider>,
    config: SkillsConfig,
}
```

**API:**
```rust
impl SkillsEngine {
    // Lifecycle
    pub async fn new(workspace_dir: &Path) -> Result<Self>;
    async fn ensure_initialized(&self) -> Result<()>;

    // CRUD
    pub async fn store_skill(&self, skill: &Skill) -> Result<i64>;
    pub async fn get_skill(&self, id: i64) -> Result<Option<Skill>>;
    pub async fn get_skill_by_name(&self, name: &str) -> Result<Option<Skill>>;
    pub async fn list_skills(&self, active_only: bool) -> Result<Vec<Skill>>;
    pub async fn update_skill(&self, id: i64, skill: &Skill) -> Result<()>;
    pub async fn delete_skill(&self, id: i64) -> Result<bool>;

    // Vector Search
    pub async fn search_skills(
        &self,
        query: &str,
        limit: usize,
        threshold: f64,
    ) -> Result<Vec<SkillSearchResult>>;
}
```

**Structs:**
```rust
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
}

#[derive(Debug, Clone)]
pub struct SkillSearchResult {
    pub skill: Skill,
    pub score: f64,
}
```

---

### 2.4 Module: `src/skills/loader.rs`

**Trait:**
```rust
#[async_trait]
pub trait SkillLoader: Send + Sync {
    async fn load_matching_skills(
        &self,
        query: &str,
        threshold: f64,
    ) -> Result<Vec<Skill>>;

    async fn enrich_system_prompt(
        &self,
        query: &str,
        base_prompt: &str,
    ) -> Result<String>;
}
```

**Implementation:**
```rust
pub struct VectorSkillLoader {
    engine: Arc<SkillsEngine>,
    threshold: f64,
}

impl VectorSkillLoader {
    pub fn new(engine: Arc<SkillsEngine>, threshold: f64) -> Self {
        Self { engine, threshold }
    }

    pub async fn enrich_system_prompt(
        &self,
        query: &str,
        base_prompt: &str,
    ) -> Result<String> {
        let skills = self.load_matching_skills(query, self.threshold).await?;

        if skills.is_empty() {
            return Ok(base_prompt.to_string());
        }

        let skills_context = skills
            .iter()
            .map(|s| format!(
                "## {}\n{}\n\n{}",
                s.name,
                s.description,
                s.content
            ))
            .collect::<Vec<_>>()
            .join("\n\n---\n\n");

        Ok(format!(
            "{}\n\n# 🎯 Active Skills\n{}\n\n---\n",
            base_prompt, skills_context
        ))
    }
}
```

---

### 2.5 Integration Point: `/v1/chat/completions` Flow

**Flow Diagram:**
```
POST /v1/chat/completions
    ↓
[1] JWT Authentication
    ↓
[2] Parse OpenAI request
    ↓
[3] Extract user message (last message in array)
    ↓
[4] SkillLoader.enrich_system_prompt(query, base_prompt)
    ├── Vectorize query
    ├── Search Qdrant (skills_index)
    ├── If score > threshold: load from SQLite
    └── Prepend to system prompt
    ↓
[5] Call Agent with enriched prompt
    ↓
[6] Stream response (SSE) or complete response
```

**Code Integration in `openai_compat.rs`:**
```rust
pub async fn handle_v1_chat_completions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ChatCompletionRequest>,
) -> impl IntoResponse {
    // 1. Auth
    require_auth(&state, &headers).await?;

    // 2. Extract user message
    let user_message = req.messages
        .iter()
        .filter(|m| m.role == "user")
        .last()
        .map(|m| m.content.clone())
        .unwrap_or_default();

    // 3. Enrich system prompt with skills
    let skill_loader = &state.skill_loader;
    let enriched_system = skill_loader
        .enrich_system_prompt(&user_message, &BASE_SYSTEM_PROMPT)
        .await?;

    // 4. Call agent with enriched prompt
    let response = state.agent
        .process_with_system(&user_message, &enriched_system)
        .await?;

    // 5. Return OpenAI-formatted response
    ...
}
```

---

### 2.6 Background Evaluator: `src/skills/evaluator.rs`

**Purpose:** Run automated tests on new skills using Ollama fallback without blocking main event loop.

**Struct:**
```rust
pub struct SkillEvaluator {
    ollama_url: String,
    model: String,  // "qwen2.5-coder:7b"
    client: reqwest::Client,
}

#[derive(Debug, Clone)]
pub struct EvalResult {
    pub skill_id: i64,
    pub score: f64,
    pub passed: bool,
    pub feedback: String,
}
```

**API:**
```rust
impl SkillEvaluator {
    pub fn new(ollama_url: String, model: String) -> Self;

    /// Run evaluation in background thread
    pub async fn evaluate_skill_background(
        &self,
        skill: &Skill,
    ) -> Result<EvalResult> {
        let skill = skill.clone();
        let url = self.ollama_url.clone();
        let model = self.model.clone();

        spawn_blocking(move || {
            Self::evaluate_sync(&skill, &url, &model)
        })
        .await?
    }

    fn evaluate_sync(skill: &Skill, url: &str, model: &str) -> Result<EvalResult> {
        // HTTP POST to http://localhost:11434/api/generate
        // Test: format validity, description-content match, safety check
        ...
    }
}
```

**Eval Criteria:**
| Check | Description |
|-------|-------------|
| Format | Valid frontmatter (name, description, version) |
| Consistency | Description matches content |
| Safety | No malicious patterns |
| Quality | Clear instructions (heuristic) |

---

### 2.7 API Endpoints: `src/gateway/api.rs`

**Management Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/skills` | List all skills |
| POST | `/api/v1/skills` | Create new skill |
| GET | `/api/v1/skills/:id` | Get skill by ID |
| PUT | `/api/v1/skills/:id` | Update skill |
| DELETE | `/api/v1/skills/:id` | Delete skill |
| POST | `/api/v1/skills/:id/evaluate` | Trigger background eval |

**Request/Response Examples:**

Create Skill:
```json
POST /api/v1/skills
{
    "name": "code-review",
    "description": "Reviews code for security vulnerabilities and best practices",
    "content": "# Code Review Skill\n\n...",
    "version": "1.0.0",
    "tags": ["code", "security", "review"]
}
```

---

## AppState Modifications

**Add to `src/gateway/mod.rs`:**
```rust
pub struct AppState {
    // ... existing fields
    pub skill_engine: Arc<SkillsEngine>,
    pub skill_loader: Arc<VectorSkillLoader>,
    pub skill_evaluator: Arc<SkillEvaluator>,
}
```

**Initialization in gateway startup:**
```rust
let skill_engine = Arc::new(SkillsEngine::new(&workspace_dir).await?);
let skill_loader = Arc::new(VectorSkillLoader::new(
    skill_engine.clone(),
    0.82,  // threshold
));
let skill_evaluator = Arc::new(SkillEvaluator::new(
    "http://localhost:11434".to_string(),
    "qwen2.5-coder:7b".to_string(),
));

let app_state = AppState {
    // ... existing
    skill_engine,
    skill_loader,
    skill_evaluator,
};
```

---

## Module Exports: `src/skills/mod.rs`

**Changes:**
```rust
pub mod engine;
pub mod loader;
pub mod evaluator;

pub use engine::{SkillsEngine, Skill, SkillSearchResult};
pub use loader::{SkillLoader, VectorSkillLoader};
pub use evaluator::{SkillEvaluator, EvalResult};
```

---

## Dependencies Check

**Verify `Cargo.toml` has:**
```toml
[dependencies]
# Existing (should already be present)
rusqlite = "0.32"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json"] }
async-trait = "0.1"
parking_lot = "0.12"
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"

# For Qdrant (verify present)
# qdrant dependency is already in memory module
```

---

## Testing Strategy

**Unit Tests:**
- `SkillsEngine`: CRUD operations, vector search
- `VectorSkillLoader`: Prompt enrichment
- `SkillEvaluator`: Ollama communication

**Integration Tests:**
- `POST /v1/chat/completions`: Full flow with skill injection
- `GET /v1/models`: Model list from routes
- `POST /api/v1/skills`: Create + vectorize

**Manual Tests:**
```bash
# Test OpenAI compatibility
curl http://127.0.0.1:42618/v1/models \
    -H "Authorization: Bearer <token>"

# Test chat with skill injection
curl -X POST http://127.0.0.1:42618/v1/chat/completions \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"model":"glm-4.7","messages":[{"role":"user","content":"Review this code"}]}'
```

---

## Rollback Plan

If issues arise:
1. **Gateway:** Remove `/v1/*` routes from `mod.rs`
2. **Skills:** Delete `agent_skills` table from `brain.db`
3. **Qdrant:** Delete `skills_index` collection
4. **Code:** Revert commits for new modules

---

## Success Criteria

- [ ] `/v1/models` returns JSON list of models
- [ ] `/v1/chat/completions` accepts OpenAI-formatted requests
- [ ] Skills stored in SQLite with vector embeddings in Qdrant
- [ ] Matching skills automatically injected into system prompt
- [ ] Background evaluator runs without blocking main thread
- [ ] All `cargo test` pass
- [ ] Manual curl tests succeed

---

**End of Design Document**

---

## Approval Required

Please review and approve this design before implementation proceeds.

Once approved, I will invoke the `writing-plans` skill to create the implementation plan, followed by `subagent-driven-development` for concurrent code execution.
