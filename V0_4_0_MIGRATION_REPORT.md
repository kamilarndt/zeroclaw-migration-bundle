# ZeroClaw v0.4.0 Migration Report

**Date:** 2026-03-17
**Author:** ZeroClaw System Engineer
**Current Version:** v0.1.7 (zeroclaw)
**Target Version:** v0.4.0 (zeroclawlabs)

---

## Executive Summary

This report analyzes the compatibility between our custom v0.1.7 implementation and the upstream v0.4.0 release. The migration requires careful handling of our custom modules (`openai_compat.rs`, skills engine) while evaluating which v0.4.0 features to adopt or exclude.

**Risk Level:** MEDIUM
**Estimated Effort:** 2-3 weeks for full migration
**Breaking Changes:** Yes (skills architecture, gateway structure)

---

## 1. Status of Custom Modules

### 1.1 Gateway Layer (`src/gateway/`)

#### Current State (v0.1.7)
Our implementation includes custom files:

| File | Purpose | Lines |
|------|---------|-------|
| `openai_compat.rs` | OpenAI-compatible `/v1/chat/completions` + `/v1/models` endpoints | 217 |
| `api_skills_fix.rs` | Skills integration fixes | - |
| `telegram_threads.rs` | Telegram threading support | - |
| `telegram_webhook.rs` | Telegram webhook handler | - |
| `tma_auth.rs` | TMA authentication | - |

#### v0.4.0 State
```
src/gateway/
├── api.rs
├── mod.rs
├── nodes.rs
├── sse.rs
├── static_files.rs
└── ws.rs
```

**NO `openai_compat.rs` exists in v0.4.0.**

#### Migration Path

| Our Module | v0.4.0 Equivalent | Action Required |
|------------|-------------------|-----------------|
| `openai_compat.rs` | None (new) | **PRESERVE** - Custom implementation for Open WebUI compatibility |
| `api.rs` | `api.rs` | Merge upstream changes, preserve our endpoints |
| `sse.rs` | `sse.rs` | Merge upstream improvements |
| `ws.rs` | `ws.rs` | Merge upstream WebSocket improvements |

**Recommendation:**
- Keep `openai_compat.rs` as-is (it's our custom OpenAI compatibility layer)
- Port to use v0.4.0's provider traits if they've changed
- The `SkillLoader` integration (lines 165-175) should be preserved

### 1.2 Skills System (`src/skills/`)

#### Current State (v0.1.7) - Custom v2.0 Engine
```
src/skills/
├── mod.rs           (exports engine, loader, evaluator)
├── engine.rs        (384 lines) - SQLite + Qdrant vector search
├── loader.rs        (93 lines)  - VectorSkillLoader trait
├── evaluator.rs     (288 lines) - Ollama-based evaluation
├── audit.rs         - Skill auditing
└── symlink_tests.rs - Symlink validation
```

**Key Structures:**
- `SkillsEngine` - Core engine managing SQLite + Qdrant
- `AgentSkill` - Skill data model with vector embeddings
- `VectorSkillLoader` - Trait for dynamic prompt injection
- `SkillEvaluator` - Background evaluation with Ollama

#### v0.4.0 State
```
src/skills/
├── audit.rs
├── mod.rs
└── symlink_tests.rs
```

**v0.4.0 does NOT include our custom `engine.rs`, `loader.rs`, `evaluator.rs`.**

#### Database Schema (Our `agent_skills` table)
```sql
CREATE TABLE agent_skills (
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
```

#### Migration Path

| Our Module | v0.4.0 Equivalent | Action |
|------------|-------------------|--------|
| `engine.rs` | None | **PRESERVE** - Core custom module |
| `loader.rs` | None | **PRESERVE** - Dynamic skill injection |
| `evaluator.rs` | None | **PRESERVE** - Ollama evaluation |
| `audit.rs` | `audit.rs` | Merge upstream improvements |

**New v0.4.0 Tool Integrations to Consider:**
```
src/tools/mcp_client.rs     - MCP protocol client
src/tools/composio.rs       - Composio integration
src/tools/mcp_tool.rs       - MCP tool wrapper
src/tools/mcp_protocol.rs   - MCP protocol types
src/tools/mcp_transport.rs  - MCP transport layer
src/tools/mcp_deferred.rs   - Deferred MCP calls
```

**Recommendation:**
- Keep our custom skills engine (it's superior for our use case)
- Add adapter layer to integrate v0.4.0's MCP tools if needed
- The `VectorSkillLoader` trait can wrap MCP tools as skills

---

## 2. Database & Memory Analysis

### 2.1 Memory Backend Comparison

| Feature | v0.1.7 (Local) | v0.4.0 |
|---------|---------------|--------|
| SQLite | Yes (`brain.db`) | Yes |
| PostgreSQL | Optional feature | Yes (`postgres.rs`) |
| Qdrant | Yes (`skills_index`) | Yes |
| FTS5 | Yes (BM25) | Yes |
| Vector Search | Custom | Enhanced |
| RAG | No | **Yes** (`src/rag/mod.rs`) |

### 2.2 Schema Migration Requirements

**`agent_skills` Table:**
- Our schema is custom and **not present in v0.4.0**
- Migration: **NO ACTION NEEDED** - table is local-only
- Backup recommended before migration

**Memory Schema (`brain.db`):**
- Both versions use similar schemas
- v0.4.0 may have new tables for RAG
- Run migration scripts if schema version changed

### 2.3 New v0.4.0 Memory Features

```
src/memory/
├── postgres.rs      - NEW: PostgreSQL backend
├── response_cache.rs - Response caching
├── snapshot.rs      - Memory snapshots
├── consolidation.rs - Memory consolidation
├── hygiene.rs       - Memory cleanup
├── lucid.rs         - Lucid memory mode
└── markdown.rs      - Markdown memory format
```

**Recommendation:**
- Enable `memory-postgres` feature only if scaling requires it
- Adopt `response_cache.rs` for performance
- Consider `consolidation.rs` for memory optimization

---

## 3. Zero-Bloat Analysis

### 3.1 Recommended Exclusions for Open WebUI Backend

Since our system primarily serves Open WebUI, the following modules are **NOT REQUIRED**:

#### Channels to Disable (Cargo.toml features)
```toml
# OPTIONAL - Disable if not using these platforms
channel-matrix = []      # Matrix protocol
channel-lark = []        # Lark/Feishu
# Nostr is optional in v0.4.0
```

#### Directories to Exclude from Build
| Directory | Purpose | Recommendation |
|-----------|---------|----------------|
| `crates/robot-kit/` | Raspberry Pi robot kit | **EXCLUDE** - Not IoT |
| `firmware/` | ESP32/Nucleo firmware | **EXCLUDE** - Not embedded |
| `src/peripherals/` | Hardware peripherals | **EXCLUDE** - No hardware |
| `src/hardware/` | Hardware discovery | **EXCLUDE** - No hardware |

### 3.2 Features to Disable in Cargo.toml

```toml
# DISABLE these features for minimal Open WebUI backend
[features]
default = []

# Hardware/IoT - NOT NEEDED
hardware = []           # USB/Serial communication
peripheral-rpi = []     # Raspberry Pi GPIO
probe = []              # STM32/Nucleo programming

# Optional channels - DISABLE if not used
channel-matrix = []     # Matrix client
channel-lark = []       # Lark/Feishu

# Browser automation - OPTIONAL
browser-native = []     # Fantoccini backend

# Sandboxing - OPTIONAL (Linux only)
sandbox-landlock = []   # Landlock sandbox
sandbox-bubblewrap = [] # Bubblewrap sandbox

# PDF RAG - OPTIONAL
rag-pdf = []            # PDF extraction for RAG

# WhatsApp Web - OPTIONAL
whatsapp-web = []       # Native WhatsApp client
```

### 3.3 Minimal Feature Set for Open WebUI

```toml
# RECOMMENDED minimal build
cargo build --release --no-default-features
```

This produces the smallest binary with core functionality only.

### 3.4 Channels Analysis (27+ channels)

**Keep Active (if using):**
- `cli.rs` - CLI interface
- `telegram.rs` - If Telegram bot needed

**Can Safely Exclude:**
```
src/channels/
├── discord.rs        # Discord bot
├── slack.rs          # Slack integration
├── matrix.rs         # Matrix protocol
├── irc.rs            # IRC client
├── signal.rs         # Signal messenger
├── whatsapp.rs       # WhatsApp Business API
├── whatsapp_web.rs   # WhatsApp Web client
├── wati.rs           # WATI integration
├── dingtalk.rs       # DingTalk
├── lark.rs           # Lark/Feishu
├── mattermost.rs     # Mattermost
├── nextcloud_talk.rs # Nextcloud Talk
├── nostr.rs          # Nostr protocol
├── qq.rs             # QQ messenger
├── imessage.rs       # iMessage (macOS)
├── linq.rs           # Linq integration
├── clawdtalk.rs      # ClawdTalk
├── email_channel.rs  # Email channel
└── mqtt.rs           # MQTT protocol
```

**Estimated Size Reduction:** ~40-60% binary size reduction by excluding unused channels

---

## 4. Cargo.toml Differences

### Package Name Change
```toml
# v0.1.7 (Local)
name = "zeroclaw"

# v0.4.0 (Upstream)
name = "zeroclawlabs"
```

### New Dependencies in v0.4.0
```toml
portable-atomic = "1"  # For 32-bit targets
```

### Version Updates
```toml
# Tokio updated
tokio = "1.50"  # (was 1.42)

# UUID updated
uuid = "1.22"   # (was 1.11)
```

---

## 5. Migration Checklist

### Phase 1: Preparation (1 day)
- [ ] Backup `brain.db` and Qdrant data
- [ ] Export current skills to JSON
- [ ] Document custom configurations
- [ ] Create migration branch

### Phase 2: Code Merge (3-5 days)
- [ ] Merge v0.4.0 upstream changes
- [ ] Preserve `src/gateway/openai_compat.rs`
- [ ] Preserve `src/skills/engine.rs`, `loader.rs`, `evaluator.rs`
- [ ] Update `mod.rs` files to export preserved modules
- [ ] Resolve provider trait conflicts

### Phase 3: Database Migration (1 day)
- [ ] Run schema migrations if any
- [ ] Verify `agent_skills` table integrity
- [ ] Re-index Qdrant collections

### Phase 4: Testing (2-3 days)
- [ ] Unit tests for skills engine
- [ ] Integration tests for OpenAI compat endpoints
- [ ] Open WebUI connectivity tests
- [ ] Memory/vector search tests

### Phase 5: Optimization (1 day)
- [ ] Disable unused features in Cargo.toml
- [ ] Build release binary
- [ ] Verify binary size reduction
- [ ] Performance benchmarks

---

## 6. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Skills engine conflicts | Medium | High | Keep our modules separate |
| Provider trait changes | Medium | Medium | Update trait implementations |
| Database schema drift | Low | High | Backup + migration scripts |
| Build failures | Medium | Low | Incremental feature enable |
| Performance regression | Low | Medium | Benchmark before/after |

---

## 7. Conclusion

The migration to v0.4.0 is feasible with careful preservation of our custom modules. The key assets to protect are:

1. **`openai_compat.rs`** - Our OpenAI compatibility layer
2. **`skills/engine.rs`** - Custom skills engine with vector search
3. **`skills/loader.rs`** - Dynamic prompt injection
4. **`skills/evaluator.rs`** - Ollama-based evaluation

The v0.4.0 release brings valuable features (RAG, improved memory, MCP tools) but also significant bloat (27+ channels, IoT firmware). A minimal build with disabled features is recommended.

**Next Steps:**
1. Review this report with the Lead Architect
2. Approve migration strategy
3. Begin Phase 1 preparation

---

*Generated by ZeroClaw System Engineer*
*Report Version: 1.0*
