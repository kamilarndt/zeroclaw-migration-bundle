# ZeroClaw Smart Model Routing System Design

**Date:** 2026-03-13
**Status:** Approved
**Author:** Claude (Superpowers Brainstorming)

---

## Executive Summary

Design and implement an intelligent model routing system for ZeroClaw OS that:
- Routes tasks to optimal models across 5 API providers (Z.AI, NVIDIA NIM, Mistral, OpenRouter, Ollama)
- Tracks API quota usage (tokens + requests) and switches to free models at 80% threshold
- Automatically benchmarks model performance and optimizes routing over time
- Supports hybrid deployment (development → production with one command)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ZeroClaw CLI Interface                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Intelligent Model Router (NEW)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Query       │  │ Task         │  │ Quota               │   │
│  │ Classifier  │→ │ Type Router  │→ │ Tracker (Token/Req)  │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Z.AI      │  │  OpenRouter │  │   Ollama    │
│  Primary    │  │  Backup     │  │  Free Fallback│
└─────────────┘  └─────────────┘  └─────────────┘
```

### New Components

| Component | Responsibility | Storage |
|-----------|----------------|----------|
| **QuotaTracker** | Track tokens/requests, estimate quota, trigger fallback | SQLite |
| **ModelRouter** | Enhanced routing with benchmark-aware decisions | In-memory |
| **UsageLogger** | Log all requests with metrics for benchmarking | SQLite |
| **QuotaSafeMode** | Automatic switching to free models at threshold | State flag |

---

## Model Routing Strategy

### Z.AI Models (Primary Provider)

| Model | Use Case | Characteristics |
|-------|----------|-----------------|
| **GLM-5** | Complex reasoning, architecture | Best quality, highest cost |
| **GLM-4.7** | Default, coding, review | Balanced performance/cost |
| **GLM-4.6** | General tasks backup | Good fallback |
| **GLM-4.5V** | Vision/image tasks | Multimodal |
| **GLM-4.5** | Standard tasks | Reliable workhorse |
| **GLM-4.5-Air** | Fast, cheap tasks | Free tier option |

### Task Type Routing Table

| Hint/Task Type | Primary | Fallback 1 | Fallback 2 | Rationale |
|----------------|---------|------------|------------|-----------|
| `default` | GLM-4.7 | NVIDIA fast | GLM-4.6 | Z.AI quality → speed |
| `code`/`coding` | Codestral | GLM-4.7 | GLM-4.6 | Coding specialist → GLM |
| `complex`/`deep` | GLM-5 | GLM-4.7 | OpenRouter premium | Deep reasoning chain |
| `architect` | GLM-5 | GLM-4.7 | NVIDIA reasoning | System design expertise |
| `vision` | GLM-4.5V | GLM-4.6 | GLM-4.7 | Vision model cascade |
| `fast`/`quick` | NVIDIA fast | GLM-4.5-Air | Ollama | Speed priority routing |
| `cheap` | GLM-4.5-Air | Ollama | NVIDIA | Cost minimization |
| `review` | GLM-4.7 | Codestral | GLM-4.6 | Code review specialists |
| `local` | Ollama | GLM-4.5-Air | NVIDIA | Local-first preference |

### Provider Strengths & Limits

| Provider | Strengths | Rate Limits |
|----------|-----------|-------------|
| **Z.AI** | Full GLM family, best overall | Estimated 60 req/min |
| **NVIDIA NIM** | Fast open models | 40 req/min |
| **Mistral** | Codestral coding specialist | 30 req/min, 2000/day |
| **OpenRouter** | Diverse model backup | 20 req/min, 50/day |
| **Ollama** | Free local fallback | Unlimited |

---

## Quota Tracking & Fallback System

### QuotaTracker Design

```rust
pub struct QuotaTracker {
    // SQLite storage for persistence
    db: SqlitePool,

    // Current usage state
    daily_tokens: AtomicU64,
    daily_requests: AtomicU64,

    // Configuration
    quota_estimate: u64,           // Total daily quota in tokens
    quota_threshold: f64,          // 0.8 = 80%

    // Provider-specific limits
    provider_limits: HashMap<Provider, RateLimit>,
}

pub struct RateLimit {
    requests_per_minute: u32,
    requests_per_day: Option<u32>,
    daily_tokens: Option<u64>,
}
```

### Quota States

| State | Condition | Routing Behavior |
|-------|-----------|------------------|
| **Normal** | < 80% quota | Use optimal routing table |
| **Conserving** | 80-95% quota | Prefer GLM-4.5-Air, NVIDIA fast, Ollama |
| **Critical** | > 95% quota | Free models only (Ollama + GLM-4.5-Air) |
| **Unknown** | No quota data | Use request counting with conservative estimates |

### Fallback Decision Logic

```
Request arrives
       │
       ▼
Check quota state
       │
   ┌───┴─────────┐
   │             │
Normal       Conserving/Critical
   │                 │
   ▼                 ▼
Optimal         Filter models
routing        to free/cheap only
```

### Tracking Metrics

**Per-Request Tracking:**
- `prompt_tokens` - from API response
- `completion_tokens` - from API response
- `total_tokens` - sum for quota calc
- `request_count` - per provider per minute

**Persistence:**
- SQLite database at `~/.zeroclaw/quota.db`
- Survives restarts
- Hourly rollback cleanup (keep 30 days)

---

## Benchmarking & Metrics System

### UsageLogger Design

```rust
pub struct UsageLogger {
    db: SqlitePool,
}

pub struct RequestMetrics {
    id: String,
    timestamp: DateTime<Utc>,
    provider: String,
    model: String,
    task_hint: String,

    // Performance metrics
    response_time_ms: u64,
    time_to_first_token_ms: Option<u64>,

    // Cost metrics
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
    estimated_cost_usd: f64,

    // Quality metrics
    success: bool,
    error_type: Option<String>,
    user_rating: Option<u8>, // 1-5, manual feedback
}
```

### Automatic Benchmarking

**Data Collection:**
- Every request logged to SQLite (`~/.zeroclaw/metrics.db`)
- Rolling averages calculated per (model, task_hint) pair
- Tracks: response time, cost per task, success rate

**Auto-Adjustment:**
- After N requests (default: 50) per model/task combination
- Recalculate optimal routing based on:
  - Weighted score: `response_time * 0.4 + cost * 0.4 + success_rate * 0.2`
  - Update routing table if new winner emerges

**Benchmark Query Example:**
```sql
-- Find best model for coding tasks
SELECT
    model,
    AVG(response_time_ms) as avg_time,
    AVG(estimated_cost_usd) as avg_cost,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
    COUNT(*) as sample_size
FROM metrics
WHERE task_hint = 'code'
  AND timestamp > datetime('now', '-7 days')
GROUP BY model
HAVING sample_size >= 10
ORDER BY
    (avg_time * 0.4 + avg_cost * 1000 * 0.4 + (100 - success_rate) * 0.2) ASC
LIMIT 1;
```

### Manual Benchmark Command

```bash
# Run parallel benchmark on all models
zeroclaw benchmark run --task "code" --parallel

# Generate performance report
zeroclaw metrics report --period 7d --format table

# Compare specific models
zeroclaw benchmark compare --models glm-4.7,codestral --task "coding"
```

---

## Configuration Structure

### Updated config.toml

```toml
# ================================================================
# QUOTA TRACKING
# ================================================================
[quota_tracker]
enabled = true
daily_quota_estimate = 1000000  # tokens, adjust based on plan
threshold_percent = 80.0
cache_path = "~/.zeroclaw/quota.db"
reset_time = "00:00"  # Daily reset at midnight

[quota_tracker.provider_limits]
zai = { requests_per_minute = 60, daily_tokens = 1000000 }
openrouter = { requests_per_minute = 20, requests_per_day = 50 }
nvidia = { requests_per_minute = 40 }
mistral = { requests_per_minute = 30, requests_per_day = 2000 }
ollama = { requests_per_minute = 1000 }  # local, effectively unlimited

# ================================================================
# BENCHMARKING & METRICS
# ================================================================
[benchmarking]
enabled = true
metrics_db = "~/.zeroclaw/metrics.db"
auto_adjust_after = 50  # requests per model/task combo before auto-adjust
log_failed_requests = true
retention_days = 30

[benchmarking.cost_per_token]
# Z.AI pricing (estimated, update with actual)
"glm-5" = { prompt = 0.002, completion = 0.006 }
"glm-4.7" = { prompt = 0.001, completion = 0.003 }
"glm-4.6" = { prompt = 0.0005, completion = 0.0015 }
"glm-4.5" = { prompt = 0.0003, completion = 0.0009 }
"glm-4.5v" = { prompt = 0.0005, completion = 0.0015 }
"glm-4.5-air" = { prompt = 0.0, completion = 0.0 }  # free tier

# Other providers (estimated)
"codestral" = { prompt = 0.001, completion = 0.003 }
"mistral-large" = { prompt = 0.002, completion = 0.006 }

# ================================================================
# MODEL ROUTING (ENHANCED)
# ================================================================
[[model_routes]]
hint = "default"
provider = "zai"
model = "glm-4.7"
fallbacks = [
    { provider = "nvidia", model = "mistralai/Mistral-7B-Instruct-v0.3" },
    { provider = "zai", model = "glm-4.6" }
]

[[model_routes]]
hint = "code"
provider = "mistral"
model = "codestral"
fallbacks = [
    { provider = "zai", model = "glm-4.7" },
    { provider = "zai", model = "glm-4.6" }
]

[[model_routes]]
hint = "complex"
provider = "zai"
model = "glm-5"
fallbacks = [
    { provider = "zai", model = "glm-4.7" },
    { provider = "openrouter", model = "anthropic/claude-sonnet-4-20250514" }
]

[[model_routes]]
hint = "fast"
provider = "nvidia"
model = "mistralai/Mistral-7B-Instruct-v0.3"
fallbacks = [
    { provider = "zai", model = "glm-4.5-air" },
    { provider = "ollama", model = "qwen2.5-coder:7b" }
]
```

---

## Implementation Components

### New Crates

```
backend/crates/
├── quota-tracker/          # NEW
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs         # Public API
│       ├── tracker.rs     # Core tracking logic
│       ├── state.rs       # Quota state management
│       └── schema.rs      # SQLite schema
│
├── usage-logger/           # NEW
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs         # Public API
│       ├── logger.rs      # Logging logic
│       ├── metrics.rs     # Metrics data structures
│       └── benchmark.rs   # Benchmark analysis
│
└── benchmark/              # NEW (CLI commands)
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        ├── runner.rs      # Benchmark execution
        └── report.rs      # Report generation
```

### Modified Crates

```
backend/crates/model-router/
└── src/
    └── router.rs          # ADD: Quota-aware routing
                            # ADD: Benchmark-based routing
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `zeroclaw quota status` | Show current quota usage |
| `zeroclaw quota reset` | Reset daily counters |
| `zeroclaw quota set --tokens N` | Set quota estimate |
| `zeroclaw benchmark run` | Run benchmarks |
| `zeroclaw benchmark compare` | Compare models |
| `zeroclaw metrics report` | Show performance report |

---

## Deployment Strategy

### Development Setup

```bash
# All services run locally
cd backend
cargo run -- daemon

cd frontend-web
npm run dev

# Qdrant in Docker
docker compose up -d
```

**Access:**
- Backend: `http://localhost:42617`
- Frontend: `http://localhost:5173`
- Qdrant: `http://localhost:6333`

### Production Promotion

```bash
# One command to go production
zeroclaw deploy --production
```

**What `deploy --production` does:**

1. Builds release binary: `cargo build --release`
2. Installs to `~/.cargo/bin/`
3. Creates systemd service: `/etc/systemd/system/zeroclaw.service`
4. Enables auto-start on boot
5. Configures Caddy reverse proxy with HTTPS
6. Sets up log rotation: `/etc/logrotate.d/zeroclaw`
7. Enables health checks
8. Configures graceful shutdown

### Production Features

| Feature | Implementation |
|---------|----------------|
| **Auto-restart** | systemd `Restart=always` |
| **HTTPS** | Caddy auto-renewal Let's Encrypt |
| **Log rotation** | logrotate, keep 30 days |
| **Health check** | `GET /health` endpoint |
| **Graceful shutdown** | Signal handler, drain queue |
| **Monitoring** | Structured logs to journald |

### systemd Service

```ini
[Unit]
Description=ZeroClaw AI Agent Daemon
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/.zeroclaw
ExecStart=$HOME/.cargo/bin/zeroclaw daemon
Restart=always
RestartSec=10
Environment="PATH=$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin"

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

---

## API Provider Configuration

### Z.AI (Primary)

```toml
api_key = "0ebd978f2bd44798a27bfb6f7fd01489.K1cuWqx1vWYfclJU"
api_url = "https://api.z.ai/api/coding/paas/v4"

[model_providers.zai]
name = "zai"
base_url = "https://api.z.ai/api/coding/paas/v4"
requires_openai_auth = true

# Available models
models = ["glm-5", "glm-4.7", "glm-4.6", "glm-4.5", "glm-4.5v", "glm-4.5-air"]
```

### NVIDIA NIM

```toml
[model_providers.nvidia]
name = "nvidia"
base_url = "https://integrate.api.nvidia.com/v1"
api_key = "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"
requires_openai_auth = true

# Fast models for rapid iteration
models = ["mistralai/Mistral-7B-Instruct-v0.3", "meta/llama-3.1-405b-instruct"]
```

### Mistral (Codestral)

```toml
[model_providers.mistral]
name = "mistral"
base_url = "https://api.mistral.ai/v1"
api_key = "Y4nlDWB7i1OuhIbCWqmAs4ewnS1vXjYm"
requires_openai_auth = true

# Coding specialist
models = ["codestral", "mistral-large-latest"]
```

### OpenRouter (Backup)

```toml
[model_providers.openrouter]
name = "openrouter"
base_url = "https://openrouter.ai/api/v1"
api_key = "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"
requires_openai_auth = true
```

### Ollama (Local Fallback)

```toml
[model_providers.ollama]
name = "ollama"
base_url = "http://127.0.0.1:11434"
requires_openai_auth = false
```

---

## Success Criteria

| Criteria | Measurement | Target |
|----------|-------------|--------|
| **Routing accuracy** | Tasks use optimal model | > 90% |
| **Quota tracking** | Estimated vs actual | < 10% error |
| **Fallback latency** | Time to switch providers | < 100ms |
| **Benchmark auto-adjust** | Routing improves over time | Measurable after 100 tasks |
| **Production uptime** | systemd service availability | > 99.9% |
| **Cold start time** | Binary startup | < 100ms |

---

## Implementation Phases

### Phase 1: Core Routing (Week 1)
- [ ] Create `quota-tracker` crate
- [ ] Create `usage-logger` crate
- [ ] Modify `model-router` for quota-aware routing
- [ ] Update `config.toml` with new sections
- [ ] Add CLI commands for quota/status

### Phase 2: Benchmarking (Week 2)
- [ ] Create `benchmark` crate
- [ ] Implement auto-adjustment logic
- [ ] Add benchmark CLI commands
- [ ] Create metrics report generator
- [ ] Test with sample workloads

### Phase 3: Production Hardening (Week 3)
- [ ] Implement `deploy --production`
- [ ] Create systemd service template
- [ ] Configure Caddy integration
- [ ] Add health check endpoint
- [ ] Set up log rotation

### Phase 4: Testing & Documentation (Week 4)
- [ ] Integration testing
- [ ] Load testing with rate limits
- [ ] Update user documentation
- [ ] Create deployment guide
- [ ] Performance benchmarking

---

## Security Considerations

1. **API Keys in Transit**
   - All provider APIs use HTTPS
   - Keys stored in `config.toml` (user permissions only)
   - Optional encryption via `[secrets.encrypt = true]`

2. **Sandboxing**
   - `[security.sandbox]` already configured
   - Workspace-only execution: `[autonomy.workspace_only = true]`
   - Forbidden paths protected

3. **Rate Limit Protection**
   - Per-provider request tracking
   - Automatic backoff on 429 responses
   - Exponential backoff in `[reliability]`

4. **Audit Logging**
   - `[security.audit.enabled = true]`
   - All requests logged with timestamps
   - Cost tracking enabled

---

## Monitoring & Observability

### Log Output

```bash
# View logs in real-time
journalctl -u zeroclaw -f

# Filter for quota events
journalctl -u zeroclaw | grep -i quota

# Filter for routing decisions
journalctl -u zeroclaw | grep -i routing
```

### Metrics Query Examples

```sql
-- Daily token usage
SELECT DATE(timestamp) as date, SUM(total_tokens) as tokens
FROM metrics
WHERE timestamp > datetime('now', '-30 days')
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Provider success rate
SELECT provider,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
    COUNT(*) as total_requests
FROM metrics
WHERE timestamp > datetime('now', '-7 days')
GROUP BY provider
ORDER BY success_rate DESC;

-- Model performance by task type
SELECT model, task_hint,
    AVG(response_time_ms) as avg_time,
    AVG(estimated_cost_usd) as avg_cost
FROM metrics
WHERE success = true
GROUP BY model, task_hint
ORDER BY task_hint, avg_time;
```

---

## Future Enhancements

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| **Predictive routing** | Use ML to predict best model based on query content | Low |
| **Cost optimization** | Multi-arm bandit for cost/performance tradeoff | Medium |
| **Provider health** | Active health checks, pre-emptive failover | Medium |
| **Custom pricing API** | Fetch real-time pricing from providers | Low |
| **User feedback loop** | Manual thumbs up/down for routing decisions | Low |

---

## References

- **Z.AI Documentation**: https://docs.z.ai
- **ZeroClaw Repository**: https://github.com/kamilarndt/zeroclaw-migration-bundle
- **Migration Guide**: `/tmp/zeroclaw-migration-bundle/MIGRATION_GUIDE.md`
- **Existing Config**: `/tmp/zeroclaw-migration-bundle/config/config.toml`

---

**Document Version:** 1.0
**Last Updated:** 2026-03-13
**Status:** Ready for Implementation Planning
