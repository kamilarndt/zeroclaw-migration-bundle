# ZeroClaw Refactoring Plan - Monolith Decomposition

> **Date:** 2026-03-10
> **Auditor:** Claude Code
> **Scope:** Large files violating Single Responsibility Principle (SRP)
> **Status:** Planning Phase - No Implementation Yet

---

## Executive Summary

This document outlines a comprehensive refactoring strategy to decompose three major "God Objects" in the ZeroClaw codebase:

| File | Lines | Primary SRP Violations | Estimated Refactoring Effort |
|------|-------|------------------------|------------------------------|
| `src/agent/loop_.rs` | 5,702 | Chat loop, tool parsing, context management, compaction, streaming | 2-3 weeks |
| `src/providers/reliable.rs` | 2,028 | Error classification, retry logic, fallback chains, rate limiting | 1 week |
| `src/memory/sqlite.rs` | 1,987 | DB schema, FTS, vector search, embedding cache, reindexing | 1 week |

**Total Estimated Effort:** 4-5 weeks for incremental refactoring without breaking functionality.

---

## Phase 1: `src/agent/loop_.rs` Decomposition

### Current State Analysis

**File Size:** 5,702 lines
**Primary Responsibilities Identified:**
1. **Tool Call Parsing** (~2,000 lines) - Multiple format parsers (XML, JSON, GLM, MiniMax, FunctionCall)
2. **Context Management** (~500 lines) - Memory search, hardware RAG, history trimming
3. **Tool Execution Loop** (~800 lines) - Sequential/parallel execution, approval handling
4. **Conversation Compaction** (~300 lines) - History summarization, token management
5. **Streaming & Progress** (~400 lines) - Delta updates, progress reporting
6. **Credential Scrubbing** (~100 lines) - Sensitive data redaction
7. **Agent Turn Orchestration** (~1,000 lines) - Main turn logic, multimodal handling
8. **Testing Module** (~600+ lines) - Extensive unit tests

### Proposed Module Structure

```
src/agent/
├── loop_.rs                 # Main orchestration (keep Agent + turn entry)
├── parser/
│   ├── mod.rs               # Parser exports
│   ├── types.rs             # ParsedToolCall, ParseResult
│   ├── openai.rs           # OpenAI tool_calls format
│   ├── xml.rs               # XML tags (<tool>, <invoke>, etc.)
│   ├── glm.rs               # GLM-style line format
│   ├── minimax.rs           # MiniMax invoke format
│   ├── function_call.rs     # <FunctionCall> blocks
│   └── alias.rs             # Tool name alias mappings
├── context/
│   ├── mod.rs               # Context builder exports
│   ├── memory.rs            # RAG from vector DB
│   ├── hardware.rs          # Hardware RAG (datasheets)
│   └── trimmer.rs           # History trimming, token limits
├── compaction/
│   ├── mod.rs               # Compaction exports
│   ├── transcript.rs        # Build compaction transcript
│   ├── summarizer.rs        # LLM-based summarization
│   └── token_limiter.rs     # Token estimation & sliding window
├── execution/
│   ├── mod.rs               # Execution exports
│   ├── sequential.rs        # Sequential tool execution
│   ├── parallel.rs          # Parallel tool execution
│   ├── approval.rs          # Approval integration
│   └── outcome.rs           # ToolExecutionOutcome, error handling
├── streaming/
│   ├── mod.rs               # Streaming exports
│   ├── delta.rs             # On_delta callback handling
│   ├── progress.rs          # Progress message formatting
│   └── draft.rs             # Draft channel management
├── security/
│   ├── mod.rs               # Security exports
│   ├── scrubber.rs          # Credential scrubbing
│   └── sanitizer.rs         # Input sanitization
└── tests/
    ├── mod.rs               # Test exports
    ├── parser_tests.rs     # Parser unit tests
    ├── context_tests.rs    # Context builder tests
    └── execution_tests.rs  # Execution tests
```

### Detailed Module Breakdown

#### `src/agent/parser/` - Tool Call Parsing

**Current:** ~2,000 lines of parsing logic mixed in main file
**Target:** Separate parsers by format, clean interfaces

**Responsibility Mapping:**

| Module | Current Function(s) | Purpose |
|--------|---------------------|---------|
| `types.rs` | `struct ParsedToolCall` | Shared types |
| `openai.rs` | `parse_tool_calls_from_json_value` | OpenAI JSON format |
| `xml.rs` | `parse_xml_tool_calls`, `parse_xml_attribute_tool_calls` | XML tags |
| `glm.rs` | `parse_glm_style_tool_calls`, `parse_glm_shortened_body` | GLM line format |
| `minimax.rs` | `parse_minimax_invoke_calls` | MiniMax invoke tags |
| `function_call.rs` | `parse_function_call_tool_calls` | `<FunctionCall>` blocks |
| `alias.rs` | `map_tool_name_alias` | Tool name normalization |

**New Interface:**
```rust
// parser/mod.rs
pub trait ToolCallParser {
    fn parse(&self, response: &str) -> ParseResult;
    fn name(&self) -> &str;
}

pub struct ParserChain {
    parsers: Vec<Box<dyn ToolCallParser>>,
}

impl ParserChain {
    pub fn new() -> Self {
        Self {
            parsers: vec![
                Box::new(OpenAIParser),
                Box::new(XmlParser),
                Box::new(MiniMaxParser),
                Box::new(GLMParser),
                // ...
            ],
        }
    }

    pub fn parse(&self, response: &str) -> (String, Vec<ParsedToolCall>) {
        for parser in &self.parsers {
            if let Ok(result) = parser.parse(response) {
                return result;
            }
        }
        // Fallback to text-only
        (response.to_string(), vec![])
    }
}
```

---

#### `src/agent/context/` - Context Building

**Current:** Scattered context building logic
**Target:** Unified context builder with pluggable sources

**Responsibility Mapping:**

| Module | Current Function(s) | Purpose |
|--------|---------------------|---------|
| `memory.rs` | `build_context` | Vector DB recall |
| `hardware.rs` | `build_hardware_context` | Hardware RAG |
| `trimmer.rs` | `trim_history`, `apply_token_limit` | History size management |

**New Interface:**
```rust
// context/mod.rs
pub struct ContextBuilder {
    memory: Arc<dyn Memory>,
    rag: Option<HardwareRag>,
    boards: Vec<String>,
    chunk_limit: usize,
    min_relevance_score: f64,
}

impl ContextBuilder {
    pub async fn build(&self, user_msg: &str, history: &[ChatMessage]) -> String {
        let mut parts = Vec::new();

        // Memory context
        if let Ok(entries) = self.memory.recall(user_msg, 5, None).await {
            parts.extend(self.format_memory_entries(entries));
        }

        // Hardware context
        if let Some(rag) = &self.rag {
            parts.push(rag.retrieve(user_msg, &self.boards, self.chunk_limit));
        }

        parts.join("\n\n")
    }
}
```

---

#### `src/agent/compaction/` - Conversation Compaction

**Current:** Mixed compaction logic with summarization
**Target:** Separate compaction pipeline

**Responsibility Mapping:**

| Module | Current Function(s) | Purpose |
|--------|---------------------|---------|
| `transcript.rs` | `build_compaction_transcript` | Format source text |
| `summarizer.rs` | `auto_compact_history` | LLM summarization |
| `token_limiter.rs` | `estimate_tokens`, `apply_token_limit` | Token counting |

**New Interface:**
```rust
// compaction/mod.rs
pub struct CompactionEngine {
    max_history: usize,
    keep_recent: usize,
    provider: Arc<dyn Provider>,
    model: String,
}

impl CompactionEngine {
    pub async fn compact(&self, history: &mut Vec<ChatMessage>) -> Result<CompactionReport> {
        let should_compact = history.len() > self.max_history;
        if !should_compact {
            return Ok(CompactionReport::not_needed());
        }

        let transcript = self.transcript_builder.build(history);
        let summary = self.summarizer.summarize(&transcript).await?;
        self.applier.apply(history, summary)?;

        Ok(CompactionReport::compacted(summary.len()))
    }
}
```

---

#### `src/agent/execution/` - Tool Execution

**Current:** ~800 lines of execution logic
**Target:** Clean separation between sequential/parallel execution

**Responsibility Mapping:**

| Module | Current Function(s) | Purpose |
|--------|---------------------|---------|
| `sequential.rs` | `execute_tools_sequential` | Ordered execution |
| `parallel.rs` | `execute_tools_parallel` | Concurrent execution |
| `approval.rs` | `should_execute_tools_in_parallel` | Approval checks |
| `outcome.rs` | `execute_one_tool` | Result handling |

---

#### `src/agent/streaming/` - Streaming & Progress

**Current:** ~400 lines of streaming logic
**Target:** Separated streaming concern

**Responsibility Mapping:**

| Module | Current Function(s) | Purpose |
|--------|---------------------|---------|
| `delta.rs` | `on_delta` callback handling | Delta updates |
| `progress.rs` | `truncate_tool_args_for_progress` | Progress formatting |
| `draft.rs` | `DRAFT_CLEAR_SENTINEL`, draft channel | Draft management |

---

### Refactoring Steps for `loop_.rs`

#### Phase 1A: Extract Parser Module (Week 1, Days 1-3)

1. **Create `src/agent/parser/` directory structure**
2. **Move types:**
   - `struct ParsedToolCall` → `parser/types.rs`
   - `parse_tool_calls()` → `parser/mod.rs` (chain orchestrator)
3. **Create individual parser modules:**
   - Move `parse_tool_calls_from_json_value()` → `parser/openai.rs`
   - Move `parse_xml_tool_calls()` → `parser/xml.rs`
   - Move `parse_glm_style_tool_calls()` → `parser/glm.rs`
   - Move `parse_minimax_invoke_calls()` → `parser/minimax.rs`
   - Move `parse_function_call_tool_calls()` → `parser/function_call.rs`
4. **Update imports in `loop_.rs`:**
   ```rust
   use crate::agent::parser::{ParserChain, ParsedToolCall};
   ```
5. **Run tests to ensure no regression**

**Acceptance Criteria:** All parser tests pass, main loop unchanged behaviorally

---

#### Phase 1B: Extract Context Module (Week 1, Days 4-5)

1. **Create `src/agent/context/` directory**
2. **Move and refactor:**
   - `build_context()` → `context/memory.rs`
   - `build_hardware_context()` → `context/hardware.rs`
   - `trim_history()` → `context/trimmer.rs`
   - `apply_token_limit()` → `context/token_limiter.rs`
3. **Create `ContextBuilder` struct**
4. **Update `loop_.rs` to use new builder**

**Acceptance Criteria:** Context building separated, tests pass

---

#### Phase 1C: Extract Compaction Module (Week 2, Days 1-2)

1. **Create `src/agent/compaction/` directory**
2. **Move and refactor:**
   - `auto_compact_history()` → `compaction/summarizer.rs`
   - `build_compaction_transcript()` → `compaction/transcript.rs`
   - Token estimation functions → `compaction/token_limiter.rs`
3. **Create `CompactionEngine`**
4. **Extract test constants to `compaction/config.rs`**

**Acceptance Criteria:** Compaction logic isolated, tests pass

---

#### Phase 1D: Extract Execution Module (Week 2, Days 3-5)

1. **Create `src/agent/execution/` directory**
2. **Move and refactor:**
   - `execute_tools_sequential()` → `execution/sequential.rs`
   - `execute_tools_parallel()` → `execution/parallel.rs`
   - `execute_one_tool()` → `execution/outcome.rs`
   - `should_execute_tools_in_parallel()` → `execution/approval.rs`
3. **Create `ExecutionEngine` trait**

**Acceptance Criteria:** Execution cleanly separated, parallel logic isolated

---

#### Phase 1E: Extract Streaming Module (Week 3, Days 1-2)

1. **Create `src/agent/streaming/` directory**
2. **Extract streaming-related functions and constants**
3. **Create clean streaming abstractions**

**Acceptance Criteria:** Streaming logic isolated, clean interfaces

---

#### Phase 1F: Extract Security Module (Week 3, Days 3-4)

1. **Create `src/agent/security/` directory**
2. **Move `scrub_credentials()` → `security/scrubber.rs`
3. **Add input sanitization**

**Acceptance Criteria:** Security logic centralized

---

#### Phase 1G: Final Consolidation (Week 3, Day 5)

1. **Update `loop_.rs` to use all new modules**
2. **Run full test suite**
3. **Integration testing**
4. **Documentation updates**

**Acceptance Criteria:** All tests pass, documentation updated

---

## Phase 2: `src/providers/reliable.rs` Decomposition

### Current State Analysis

**File Size:** 2,028 lines
**Primary Responsibilities Identified:**
1. **Error Classification** (~400 lines) - Retryable vs non-retryable detection
2. **Retry Logic** (~300 lines) - Backoff strategies, retry-after parsing
3. **Provider Fallback** (~400 lines) - Cascading provider selection
4. **API Rotation** (~200 lines) - Key rotation among multiple keys
5. **Streaming Support** (~300 lines) - SSE chunk handling
6. **Circuit Breaking** (~200 lines) - Provider health tracking
7. **Testing** (~200+ lines) - Mock providers

### Proposed Module Structure

```
src/providers/
├── reliable.rs              # Main ReliableProvider struct (keep thin)
├── reliability/
│   ├── mod.rs               # Exports
│   ├── error.rs             # Error classification (is_non_retryable, etc.)
│   ├── retry.rs             # Retry strategies, backoff
│   ├── circuit.rs           # Circuit breaker logic
│   └── health.rs            # Provider health tracking
├── fallback/
│   ├── mod.rs               # Exports
│   ├── chain.rs             # Provider fallback chains
│   ├── selector.rs          # Provider selection logic
│   └── model_fallback.rs    # Model-level fallback mappings
├── rotation/
│   ├── mod.rs               # Exports
│   ├── api_keys.rs          # API key rotation
│   └── rate_limit.rs        # Rate limit handling
└── streaming/
    ├── mod.rs               # Exports
    ├── sse.rs               # Server-Sent Events handling
    └── chunk.rs             # Stream chunk processing
```

### Detailed Module Breakdown

#### `src/providers/reliability/error.rs`

**Current Functions:**
- `is_non_retryable()`
- `is_context_window_exceeded()`
- `is_rate_limited()`
- `is_non_retryable_rate_limit()`
- `extract_retry_after()`

**New Interface:**
```rust
pub enum ErrorClass {
    Retryable { backoff: BackoffStrategy },
    NonRetryable { reason: NonRetryableReason },
    RateLimited { retry_after: Option<Duration>, is_fatal: bool },
}

pub struct ErrorClassifier;

impl ErrorClassifier {
    pub fn classify(&self, err: &anyhow::Error) -> ErrorClass {
        // Unified classification logic
    }
}
```

---

#### `src/providers/reliability/retry.rs`

**Current:** Retry logic mixed throughout file
**Target:** Clean retry strategies

**New Interface:**
```rust
pub enum BackoffStrategy {
    Fixed(Duration),
    Exponential { base: Duration, max: Duration, multiplier: f64 },
    Immediate,
}

pub struct RetryPolicy {
    max_attempts: usize,
    backoff: BackoffStrategy,
}

impl RetryPolicy {
    pub async fn execute<F, T, E>(&self, mut operation: F) -> Result<T, E>
    where
        F: FnMut() -> Result<T, E>,
        E: std::error::Error + Send + 'static,
    {
        // Retry loop with backoff
    }
}
```

---

#### `src/providers/fallback/chain.rs`

**Current:** Complex provider fallback logic
**Target:** Clean fallback chains

**New Interface:**
```rust
pub struct FallbackChain {
    providers: Vec<String>,
    current_index: AtomicUsize,
}

impl FallbackChain {
    pub fn next_provider(&self) -> Option<String> {
        // Atomic provider selection
    }

    pub fn mark_failed(&self, provider: &str) {
        // Move to next provider
    }
}
```

---

### Refactoring Steps for `reliable.rs`

#### Phase 2A: Extract Error Classification (Days 1-2)

1. **Create `src/providers/reliability/` directory**
2. **Move error classification functions to `error.rs`**
3. **Create `ErrorClassifier` struct**

**Acceptance Criteria:** Error classification cleanly separated

---

#### Phase 2B: Extract Retry Logic (Days 3-4)

1. **Create `retry.rs` with retry strategies**
2. **Create `circuit.rs` for circuit breaker**
3. **Create `health.rs` for provider health tracking**

**Acceptance Criteria:** Retry logic modularized

---

#### Phase 2C: Extract Fallback Logic (Days 5-6)

1. **Create `src/providers/fallback/` directory**
2. **Move provider selection logic**
3. **Create `FallbackChain` abstraction**

**Acceptance Criteria:** Fallback chains clean

---

#### Phase 2D: Extract Rotation & Streaming (Days 7-8)

1. **Create `rotation/` for API key management**
2. **Create `streaming/` for SSE handling**

**Acceptance Criteria:** Rotation and streaming isolated

---

## Phase 3: `src/memory/sqlite.rs` Decomposition

### Current State Analysis

**File Size:** 1,987 lines
**Primary Responsibilities Identified:**
1. **Schema Management** (~300 lines) - Table creation, indexing, migrations
2. **Embedding Cache** (~400 lines) - LRU cache with TTL
3. **Vector Search** (~300 lines) - Cosine similarity over embeddings
4. **FTS5 Keyword Search** (~200 lines) - BM25 scoring
5. **Hybrid Merge** (~100 lines) - Vector + keyword fusion
6. **Reindexing** (~200 lines) - Safe schema changes
7. **CRUD Operations** (~400 lines) - Store, recall, search
8. **Connection Management** (~100 lines) - Timeout handling, PRAGMA tuning

### Proposed Module Structure

```
src/memory/
├── sqlite.rs                # Main SqliteMemory struct (keep thin)
├── sqlite/
│   ├── mod.rs               # Exports
│   ├── schema.rs            # Table definitions, migrations
│   ├── connection.rs        # DB open, timeout, PRAGMA tuning
│   ├── cache.rs             # Embedding LRU cache
│   ├── vector.rs            # Vector search operations
│   ├── fts5.rs              # Full-text search (BM25)
│   ├── hybrid.rs            # Vector + keyword merge
│   ├── reindex.rs           # Safe reindexing
│   └── crud.rs              # Store, recall, forget operations
```

### Detailed Module Breakdown

#### `src/memory/sqlite/schema.rs`

**Current:** Schema SQL scattered in `init_schema()`
**Target:** Centralized schema management

**New Interface:**
```rust
pub struct Schema {
    version: u32,
    migrations: Vec<Migration>,
}

pub struct Migration {
    version: u32,
    up: &'static str,
    down: Option<&'static str>,
}

impl Schema {
    pub fn current(&self) -> Result<&'static str> {
        // Get current schema SQL
    }

    pub fn migrate_to(&self, conn: &Connection, target: u32) -> Result<()> {
        // Apply migrations
    }
}
```

---

#### `src/memory/sqlite/cache.rs`

**Current:** ~400 lines of cache logic
**Target:** Isolated LRU cache module

**New Interface:**
```rust
pub struct EmbeddingCache {
    cache:_lr::LruCache<String, Vec<f32>>,
    max_size: usize,
    ttl: Duration,
}

impl EmbeddingCache {
    pub fn get_or_compute<F>(&mut self, key: &str, compute: F) -> Result<Vec<f32>>
    where
        F: FnOnce() -> Result<Vec<f32>>,
    {
        // LRU cache with TTL
    }
}
```

---

#### `src/memory/sqlite/reindex.rs`

**Current:** Reindexing logic mixed in
**Target:** Safe reindexing operations

**New Interface:**
```rust
pub struct Reindexer;

impl Reindexer {
    pub async fn reindex_embeddings(&self, conn: &Connection) -> Result<ReindexStats> {
        // Safe temp DB → seed → sync → swap
    }
}
```

---

### Refactoring Steps for `sqlite.rs`

#### Phase 3A: Extract Schema (Days 1-2)

1. **Create `src/memory/sqlite/` directory**
2. **Move schema SQL to `schema.rs`**
3. **Create migration system**

**Acceptance Criteria:** Schema management isolated

---

#### Phase 3B: Extract Cache & Vector Search (Days 3-4)

1. **Move embedding cache to `cache.rs`**
2. **Move vector search to `vector.rs`**
3. **Create clean interfaces**

**Acceptance Criteria:** Cache and vector separated

---

#### Phase 3C: Extract FTS5 & Hybrid (Days 5-6)

1. **Create `fts5.rs` for keyword search**
2. **Create `hybrid.rs` for result merging**
3. **Create `crud.rs` for data operations**

**Acceptance Criteria:** Search and CRUD isolated

---

#### Phase 3D: Extract Reindexing & Connection (Days 7-8)

1. **Create `reindex.rs`**
2. **Create `connection.rs`**
3. **Update main `SqliteMemory` to use modules**

**Acceptance Criteria:** All modules cleanly separated

---

## Cross-Cutting Concerns

### Testing Strategy

1. **Unit Tests:** Each new module should have its own test file
2. **Integration Tests:** Test inter-module communication
3. **Backward Compatibility:** Ensure existing CLI behavior unchanged

### Migration Path

**Incremental Approach:**
1. Create new modules alongside existing code
2. Update imports gradually
3. Run tests after each module extraction
4. Remove old code only after full validation
5. Git commits per module for easy rollback

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes | Comprehensive test suite, feature flags |
| Performance regression | Benchmarks before/after, profiling |
| Integration issues | Incremental migration, thorough integration tests |
| Developer confusion | Clear module documentation, examples |

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1A: Parser extraction | 3 days | None |
| Phase 1B: Context extraction | 2 days | 1A |
| Phase 1C: Compaction extraction | 2 days | 1B |
| Phase 1D: Execution extraction | 3 days | 1C |
| Phase 1E: Streaming extraction | 2 days | 1D |
| Phase 1F: Security extraction | 2 days | 1E |
| Phase 1G: Consolidation | 1 day | 1F |
| **loop_.rs subtotal** | **15 days (3 weeks)** | |
| Phase 2A: Error classification | 2 days | None |
| Phase 2B: Retry logic | 2 days | 2A |
| Phase 2C: Fallback logic | 2 days | 2A |
| Phase 2D: Rotation/streaming | 2 days | 2B, 2C |
| **reliable.rs subtotal** | **8 days (1.5 weeks)** | |
| Phase 3A: Schema extraction | 2 days | None |
| Phase 3B: Cache/vector | 2 days | 3A |
| Phase 3C: FTS5/hybrid | 2 days | 3A |
| Phase 3D: Reindex/connection | 2 days | 3C |
| **sqlite.rs subtotal** | **8 days (1.5 weeks)** | |
| **Integration & Testing** | **5 days** | All phases |
| **GRAND TOTAL** | **36 days (~6 weeks)** | |

---

## Success Criteria

### Code Quality
- Each module <500 lines
- Clear module boundaries with minimal coupling
- Comprehensive test coverage (>80% per module)
- Documentation for all public APIs

### Performance
- No regression in tool call parsing speed
- No increase in memory usage
- Parsing latency <5ms for typical responses

### Maintainability
- New contributors can understand single module in <30 minutes
- Adding new parser format requires changes only in `parser/`
- Adding new tool execution strategy requires changes only in `execution/`

---

## Next Steps

1. **Review and Approval:** Get team consensus on refactoring plan
2. **Branch Creation:** Create `refactoring/agent-loop-decomposition` branch
3. **Begin Phase 1A:** Start with parser module extraction (lowest risk, highest value)
4. **Track Progress:** Use GitHub issues/projects to track each phase
5. **Regular Check-ins:** Weekly syncs to review progress and adjust plan

---

## Appendix: Files to Monitor

During refactoring, these files import from the monolithic files and will need updates:

**Imports from `agent/loop_.rs`:**
- `src/agent/mod.rs`
- `src/agent/tests/`
- `src/bin/agent.rs` (if exists)

**Imports from `providers/reliable.rs`:**
- `src/providers/mod.rs`
- `src/gateway/mod.rs`

**Imports from `memory/sqlite.rs`:**
- `src/memory/mod.rs`
- `src/runtime/native.rs`
- Integration tests

---

**Document Version:** 1.0
**Last Updated:** 2026-03-10
**Status:** Ready for Review
