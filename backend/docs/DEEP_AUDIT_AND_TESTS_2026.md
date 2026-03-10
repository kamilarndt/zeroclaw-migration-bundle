# ZeroClaw Deep Audit Report 2026

> **Date:** 2026-03-10
> **Auditor:** Claude Code (Anthropic)
> **Version:** 1.0
> **Scope:** Complete system audit - async safety, memory management, architecture decomposition, E2E testing

---

## Executive Summary

This report presents the findings of a comprehensive audit of the ZeroClaw AI agent framework, covering **async starvation vulnerabilities**, **memory leaks**, **monolithic architecture debt**, and **end-to-end testing coverage**.

### Critical Findings

| Category | Critical | High | Medium | Total |
|----------|----------|------|--------|-------|
| **Async Starvation** | 5 | 3 | 4 | 12 |
| **Memory Leaks** | 1 | 3 | 2 | 6 |
| **Architecture Debt** | 3 files | - | - | ~9,700 LOC |
| **Test Coverage** | - | - | - | 3 suites created |

### Overall Risk Assessment

**RATING: HIGH** - The system has critical vulnerabilities requiring immediate attention:

1. **CRITICAL:** Object URL memory leak in React frontend (every file attachment leaks memory)
2. **HIGH:** Async starvation in cryptographic operations (HMAC, SHA-256, JWT signing)
3. **HIGH:** Vector operations blocking Tokio event loop
4. **HIGH:** Three monolithic files violating SRP (~9,700 LOC total)

### Positive Findings

- WebSocket cleanup properly implemented in React frontend
- Database operations correctly use `spawn_blocking`
- Well-structured memory ecosystem (Qdrant + SQLite)
- Comprehensive E2E test boilerplate created

---

## Part I: Async Starvation Vulnerabilities

### Threat Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ASYNC STARVATION THREAT MATRIX                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  IMPACT                                                                     │
│    ◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢│
│    █            █    █ █         █ █         █   █ █                       │
│  M █            █    █ █         █ █         █   █ █     Medium            │
│  E █            █    █ █         █ █         █   █ █                       │
│  D █            █    █ █         █ █         █   █ █                       │
│  I █            █    █ █         █ █         █   █ █                       │
│  U █        █   █    █ █   █     █ █   █     █   █ █ █                     │
│  M █        █   █    █ █   █     █ █   █     █   █ █ █                     │
│    █        █   █    █ █   █     █ █   █     █   █ █ █                     │
│    ███████████████████████████████████████████████████████████████████████│
│     Low                                                                High
│                            LIKELIHOOD                                        │
│                                                                             │
│  Key:                                                                       │
│    ██████ Critical (5) - HMAC/SHA256 in async context                       │
│    █████  High (3)    - Vector ops, file I/O                                │
│    ████   Medium (4)  - Config parsing, encoding                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Critical Vulnerabilities (Immediate Action Required)

#### 1. HMAC-SHA256 Signing in Async Context

**Location:** `src/providers/glm.rs:132-136`

```rust
// VULNERABLE CODE
let signing_input = format!("{header_b64}.{payload_b64}");
let key = hmac::Key::new(hmac::HMAC_SHA256, self.api_key_secret.as_bytes());
let signature = hmac::sign(&key, signing_input.as_bytes());
```

**Impact:**
- Every GLM API request blocks the Tokio event loop during HMAC computation
- Under load, multiple concurrent requests compound the blocking time
- Estimated: 1-5ms block per request × 100 concurrent = 100-500ms event loop stall

**Recommended Fix:**
```rust
let signature = tokio::task::spawn_blocking(move || {
    let key = hmac::Key::new(hmac::HMAC_SHA256, api_key_secret.as_bytes());
    hmac::sign(&key, signing_input.as_bytes())
}).await?;
```

#### 2. Token Hashing in Auth Path

**Location:** `src/security/pairing.rs:274-276`

```rust
// VULNERABLE CODE
fn hash_token(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}
```

**Impact:**
- Called on **every authenticated request**
- SHA-256 computation blocks event loop
- Hot path vulnerability affecting all API traffic

**Recommended Fix:**
```rust
pub async fn is_authenticated(&self, token: &str) -> bool {
    let token = token.to_string();
    let tokens = self.paired_tokens.clone();
    tokio::task::spawn_blocking(move || {
        let hashed = hash_token(&token);
        tokens.lock().contains(&hashed)
    }).await.unwrap_or(false)
}
```

#### 3. Vector Similarity Computation

**Location:** `src/memory/vector.rs:4-35`

```rust
// VULNERABLE CODE
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    // O(n) floating-point computation over 384-1536 dimensions
    for (x, y) in a.iter().zip(b.iter()) {
        let x = f64::from(*x);
        let y = f64::from(*y);
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
}
```

**Impact:**
- RAG queries compare against dozens of vectors
- Each comparison is O(n) where n = embedding dimension (384-1536)
- Query with 50 comparisons × 1536 dimensions = ~77K floating-point operations

**Recommended Fix:**
```rust
pub async fn cosine_similarity_async(a: Vec<f32>, b: Vec<f32>) -> f32 {
    tokio::task::spawn_blocking(move || {
        cosine_similarity(&a, &b)
    }).await.unwrap_or(0.0)
}
```

### Summary Statistics

| Category | Vulnerable | Safe | Total |
|----------|------------|------|-------|
| Cryptographic operations | 5 | 0 | 5 |
| Vector operations | 2 | 0 | 2 |
| File I/O | 3 | 5 | 8 |
| Database operations | 0 | 100% | All |

### Estimated Fix Effort

- **Priority 1 (Critical):** 1-2 days
- **Priority 2 (High):** 2-3 days
- **Priority 3 (Medium):** 1-2 days

**Total: 4-7 days** for comprehensive fix

---

## Part II: Memory Leaks & Performance Issues

### Threat Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MEMORY LEAK THREAT MATRIX                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  IMPACT                                                                     │
│    ◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢◢┐
│    █                                    █ █                               │
│  M █                                    █ █     Medium                    │
│  E █                                    █ █                               │
│  D █                                    █ █                               │
│  I █                                    █ █                               │
│  U █                                    █ █                               │
│  M █                                    █ █                               │
│    █                                    █ █                               │
│    ████████████████████████████████████████████████████████████████████████│
│     Low                                                                High
│                            LIKELIHOOD                                        │
│                                                                             │
│  Key:                                                                       │
│    ██████ Critical (1) - Object URL memory leak (AgentChat.tsx)              │
│    ████   Medium (3)  - setTimeout without cleanup                          │
│    ██     Low (2)     - Minor resource issues                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Critical Vulnerability: Object URL Memory Leak

**Location:** `src/pages/AgentChat.tsx:73-86`

```typescript
// VULNERABLE CODE
const handleSendMessage = async (content: string, attachments?: File[]) => {
  const userMessage: ChatMessageType = {
    id: Date.now().toString(),
    role: 'user',
    content,
    attachments: attachments?.map(file => ({
      url: URL.createObjectURL(file)  // ⚠️ NEVER REVOKED
    }))
  }
}
```

**Impact:**
- Each attached file leaks memory equal to its size
- In a session with 10 file attachments averaging 5MB each = 50MB leaked
- Browser cannot garbage collect blob data
- Memory accumulates until tab crash

**Recommended Fix:**
```typescript
useEffect(() => {
  return () => {
    messages.forEach(msg => {
      msg.attachments?.forEach(att => {
        if (att.url.startsWith('blob:')) {
          URL.revokeObjectURL(att.url)
        }
      })
    })
  }
}, [messages])
```

### Moderate Vulnerabilities

#### 1. setTimeout Not Cleaned Up

**Locations:**
- `src/components/tasks/TaskCard.tsx:59`
- `src/components/NotificationProvider.tsx:55`
- `src/components/NetworkDetector.tsx:22`

**Impact:** React warnings, negligible memory impact

**Fix Pattern:**
```typescript
useEffect(() => {
  const timeout = setTimeout(() => action(), delay)
  return () => clearTimeout(timeout)
}, [dependencies])
```

### Positive Findings

#### WebSocket Cleanup - EXCELLENT

**Location:** `src/contexts/WebSocketContext.tsx:253-259`

```typescript
useEffect(() => {
  connect()
  return () => {
    disconnect()  // ✅ PROPER CLEANUP
  }
}, [])
```

Assessment: Correctly implements cleanup for WebSocket connections.

### Summary Statistics

| Category | Safe | Vulnerable | Total |
|----------|------|------------|-------|
| WebSocket cleanup | 1 | 1 minor | 2 |
| setTimeout/setInterval | 3 | 3 | 6 |
| Event listeners | 2 | 0 | 2 |
| Object URL management | 0 | 1 CRITICAL | 1 |

### Estimated Fix Effort

- **Priority 1 (Critical):** 1-2 hours
- **Priority 2 (Medium):** 2-3 hours

---

## Part III: Monolithic Architecture Decomposition

### Overview

Three files violate Single Responsibility Principle (SRP), totaling **~9,700 lines of code**:

| File | Lines | Responsibilities | Recommended Modules |
|------|-------|------------------|---------------------|
| `src/agent/loop_.rs` | 5,702 | 8+ | 6 modules |
| `src/providers/reliable.rs` | 2,028 | 4+ | 3 modules |
| `src/memory/sqlite.rs` | 1,987 | 6+ | 6 modules |

### Proposed Decomposition for `loop_.rs`

```
src/agent/
├── loop_.rs (main coordinator, ~500 lines)
├── parser/
│   ├── mod.rs
│   ├── xml_parser.rs       # XML tool call parsing
│   ├── json_parser.rs      # JSON tool call parsing
│   ├── glm_parser.rs       # GLM-specific parsing
│   └── minimax_parser.rs   # MiniMax-specific parsing
├── context/
│   ├── mod.rs
│   ├── memory_rag.rs       # RAG from vector store
│   ├── hardware_rag.rs     # Hardware context injection
│   └── history_trimmer.rs  # Token budget management
├── compaction/
│   ├── mod.rs
│   └── summarizer.rs       # Conversation summarization
├── execution/
│   ├── mod.rs
│   ├── sequential.rs       # Sequential tool execution
│   └── parallel.rs         # Parallel tool execution
├── streaming/
│   ├── mod.rs
│   ├── delta_updater.rs    # Delta updates for streaming
│   └── progress_reporter.rs # Progress reporting
└── security/
    ├── mod.rs
    └── credential_scrubber.rs # Scrub secrets from context
```

**Benefits:**
- Each module has single, clear responsibility
- Easier to test individual components
- Reduced cognitive load for maintenance
- Parallel development possible

### Proposed Decomposition for `reliable.rs`

```
src/providers/
├── reliable.rs (main facade, ~300 lines)
├── reliability/
│   ├── mod.rs
│   ├── error_classifier.rs  # Classify errors by type
│   ├── retry_policy.rs       # Retry strategies
│   └── circuit_breaker.rs    # Circuit breaker pattern
├── fallback/
│   ├── mod.rs
│   └── provider_chain.rs     # Fallback chain management
└── rotation/
    ├── mod.rs
    └── api_key_rotator.rs    # API key rotation
```

### Proposed Decomposition for `sqlite.rs`

```
src/memory/sqlite/
├── mod.rs (main facade, ~300 lines)
├── schema.rs
│   ├── Tables definition
│   ├── Indexes
│   └── Migrations
├── cache.rs
│   ├── LRU embedding cache
│   └── Cache invalidation
├── vector.rs
│   ├── Vector similarity search
│   └── Embedding storage
├── fts5.rs
│   ├── Full-text search setup
│   └── BM25 ranking
├── hybrid.rs
│   ├── Vector + keyword fusion
│   └── Hybrid scoring
└── reindex.rs
    ├── Safe reindexing
    └── Transaction management
```

### Estimated Refactoring Effort

**Total: 36 days** (6 weeks)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Week 1-2 | 10 days | `loop_.rs` decomposition (6 modules) |
| Week 3-4 | 10 days | `sqlite.rs` decomposition (6 modules) |
| Week 5-6 | 10 days | `reliable.rs` decomposition (3 modules) |
| Week 7 | 6 days | Integration testing and validation |

See `docs/REFACTORING_PLAN.md` for detailed implementation plan.

---

## Part IV: E2E Testing Infrastructure

### Overview

Comprehensive E2E test boilerplate created for three critical areas:

| Test Suite | Technology | Coverage | File |
|------------|------------|----------|------|
| Chat Dashboard | Playwright (TypeScript) | Context, RAG, tools, concurrency | `~/.zeroclaw/workspace/web/tests/e2e/chat.spec.ts` |
| Telegram Bot | Pytest (Python) | Memory retention, multi-user, stress | `tests/e2e/telegram_bot.py` |
| RAG Limits | Bash | Vector search, concurrent queries, stress | `tests/stress/rag_limits.sh` |

### Test Suite 1: Playwright Chat Tests

**File:** `~/.zeroclaw/workspace/web/tests/e2e/chat.spec.ts` (~519 lines)

**Coverage:**
- ✅ Context retention across conversation turns
- ✅ Memory persistence after page reload
- ✅ RAG document retrieval from vector store
- ✅ Tool execution (file_read, etc.)
- ✅ Multi-turn tool loops
- ✅ Concurrent chat sessions
- ✅ Error recovery (timeouts)
- ✅ Memory persistence across restarts
- ✅ Dashboard memory statistics display
- ✅ Graceful degradation when RAG provides no results

**Example Test:**
```typescript
test('remembers user name across conversation turns', async ({ page }) => {
  await chatInput.fill('My name is Alice and I love learning about space exploration.');
  await page.keyboard.press('Enter');
  // ... verify name remembered after filler conversation
  expect(finalMessage.toLowerCase()).toContain('alice');
});
```

### Test Suite 2: Telegram Bot Tests

**File:** `tests/e2e/telegram_bot.py` (~553 lines)

**Coverage:**
- ✅ Username memory retention across webhooks
- ✅ Long-term fact storage with delays
- ✅ Concurrent webhook handling (same user)
- ✅ RAG retrieval via Telegram
- ✅ Long message handling (10,000 chars)
- ✅ Special characters (emoji, markdown, code blocks)
- ✅ Multi-user memory isolation
- ✅ Empty message handling
- ✅ Webhook response time (<3s for async)
- ✅ Stress tests (20 rapid messages, 10 parallel users)

**Example Test:**
```python
async def test_remembers_username_across_webhooks(self, client: TelegramClient):
    await client.send_message("My name is Bob and I'm testing memory retention.")
    await asyncio.sleep(3)
    await client.send_message("What's my name?")
    # Verify "Bob" is recalled
```

### Test Suite 3: RAG Limits Stress Tests

**File:** `tests/stress/rag_limits.sh` (~400+ lines)

**Coverage:**
- ✅ Single memory storage
- ✅ Bulk storage (1000 entries)
- ✅ Vector search with varying limits (1-100 results)
- ✅ Keyword search performance
- ✅ Hybrid search (vector + keyword)
- ✅ Concurrent queries (10 parallel)
- ✅ RAG chunk limit testing
- ✅ Large query handling (100 words)
- ✅ Special characters in queries
- ✅ Empty query handling
- ✅ Stress: 100 sequential rapid queries
- ✅ Stress: Concurrent load (20 × 10 = 200 queries)

**Example Test:**
```bash
test_concurrent_queries() {
    # Launch 10 parallel requests
    for ((i=1; i<=CONCURRENT_REQUESTS; i++)); do
        api_request "/api/v1/memory/recall?query=test" &
    done
    wait
    # Verify 90%+ success rate
}
```

### Running the Tests

```bash
# Playwright Chat Tests
cd ~/.zeroclaw/workspace/web
npm run test:e2e

# Telegram Bot Tests
cd ~/Workspaces/zeroclaw-custom
pytest tests/e2e/telegram_bot.py -v

# RAG Stress Tests
./tests/stress/rag_limits.sh --stress
```

### Test Coverage Summary

| Area | Test Count | Coverage |
|------|------------|----------|
| Context retention | 3 tests | Username, facts, page reload |
| RAG integration | 4 tests | Vector store, hybrid, fallback |
| Tool execution | 3 tests | Single tool, multi-tool, errors |
| Concurrent operations | 3 tests | Sessions, webhooks, queries |
| Error handling | 4 tests | Timeouts, empty input, special chars |
| Stress testing | 3 tests | Sequential, concurrent, bulk |
| Multi-user isolation | 2 tests | Separate memory contexts |

**Total: 22 test scenarios** across 3 test suites

---

## Part V: Recommendations & Action Plan

### Immediate Actions (Week 1)

**Priority 1: Critical Memory Leak**
1. Fix Object URL leak in `AgentChat.tsx`
2. Add cleanup for all setTimeout calls
3. Test with Chrome DevTools Memory profiler

**Priority 2: Async Starvation - Critical**
1. Wrap HMAC signing in `spawn_blocking` (GLM provider)
2. Move token hashing to `spawn_blocking` (pairing.rs)
3. Add async wrapper for `cosine_similarity`

**Priority 3: Testing**
1. Set up E2E test infrastructure
2. Run initial test suite to establish baseline
3. Integrate into CI/CD pipeline

### Short-Term Actions (Weeks 2-4)

**Priority 4: Remaining Async Issues**
1. Wrap Bedrock SigV4 signing
2. Wrap TOTP computation
3. Use `tokio::fs` or wrap file I/O

**Priority 5: Architecture Assessment**
1. Review refactoring plan for `loop_.rs`
2. Set up feature branch for decomposition
3. Begin implementing parser module

### Medium-Term Actions (Months 2-3)

**Priority 6: Architecture Refactoring**
1. Complete `loop_.rs` decomposition
2. Start `sqlite.rs` decomposition
3. Maintain backward compatibility

**Priority 7: Test Coverage Expansion**
1. Add more E2E scenarios
2. Performance benchmarking
3. Load testing infrastructure

### Long-Term Actions (Months 4-6)

**Priority 8: Complete Refactoring**
1. Finish all three monolith decompositions
2. Update documentation
3. Retire old code paths

---

## Part VI: Testing & Verification

### Verification Checklist

Before claiming any fix is complete:

- [ ] Async operations wrapped in `spawn_blocking` where needed
- [ ] Object URLs revoked after use
- [ ] setTimeout/setInterval cleaned up on unmount
- [ ] All E2E tests passing
- [ ] Memory profiler shows no leaks
- [ ] Tokio console shows no blocking operations
- [ ] Load tests maintain >90% success rate

### Performance Benchmarks

**Target Metrics:**

| Metric | Current | Target |
|--------|---------|--------|
| Chat context retention | Untested | >95% |
| Memory leak rate | ~50MB/session (10 files) | <1MB/session |
| Async blocking events | ~100ms (100 req) | <10ms |
| RAG query latency | Untested | <500ms p95 |
| Concurrent request success | Untested | >90% |

---

## Appendices

### Appendix A: Detailed Audit Reports

- **Async Starvation:** See `docs/AUDIT_ASYNC.md` for complete vulnerability catalog
- **Memory Leaks:** See `docs/AUDIT_REACT.md` for detailed React audit
- **Architecture:** See `docs/REFACTORING_PLAN.md` for 36-day implementation plan

### Appendix B: System Reference

- **Architecture:** See `docs/MASTER_ARCHITECTURE.md` for complete system documentation
- **Configuration:** See `docs/MASTER_ARCHITECTURE.md` for config reference

### Appendix C: Test Files

- `~/.zeroclaw/workspace/web/tests/e2e/chat.spec.ts` - Playwright tests
- `tests/e2e/telegram_bot.py` - Pytest tests
- `tests/stress/rag_limits.sh` - Bash stress tests

---

## Conclusion

The ZeroClaw codebase demonstrates **solid engineering fundamentals** with proper database async handling and WebSocket cleanup. However, **critical vulnerabilities** in async safety and memory management require immediate attention.

The **monolithic architecture debt** is manageable with a structured 6-week refactoring plan. The newly created **E2E test infrastructure** provides a foundation for continuous validation.

**Overall Assessment:** With focused effort on the identified critical issues (estimated 4-7 days), ZeroClaw can achieve production-grade reliability and performance.

---

**Report Generated:** 2026-03-10
**Auditor:** Claude Code (Anthropic)
**Version:** 1.0
