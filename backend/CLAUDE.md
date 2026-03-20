# ZeroClaw CLAU.md

> **NOTE**: This is the backend-specific documentation. For the full system documentation, see [CLAUDE.md](../../../../CLAUDE.md) in the main workspace.

## Project Overview

ZeroClaw is a fast, lightweight AI assistant built in Rust with smart routing capabilities. This document provides context for AI assistants working on this codebase.

## Quick Reference

### Architecture
- **Backend:** Rust (Cargo workspace)
- **Frontend:** React 19 + TypeScript + Vite
- **Database:** SQLite (rusqlite)
- **Communication:** WebSocket, HTTP/REST
- **Deployment:** systemd + Caddy (production)

### Key Features
- **Smart Routing:** Automatic model selection based on quota and task type
- **Multi-Provider:** Z.AI, OpenRouter, NVIDIA NIM, Mistral, Ollama
- **Quota Tracking:** Token usage monitoring with automatic fallback
- **Benchmarking:** Performance-based model optimization
- **Channels:** Telegram, Discord, Slack, WebSocket, CLI
- **Memory:** SQLite with vector search (Qdrant integration)

### Workspace Structure
```
backend/
├── Cargo.toml              # Main workspace
├── src/                    # Main binary source
│   ├── agent/              # Agent orchestration
│   ├── commands/           # CLI commands (quota, benchmark, etc)
│   ├── config/             # Configuration management
│   ├── channels/           # Channel implementations
│   ├── gateway/            # HTTP/WebSocket gateway
│   ├── providers/          # AI provider integrations
│   ├── routing/            # Smart routing logic
│   └── bin/                # Binary entry points
│       ├── tui/            # Terminal UI
│       └── main.rs         # Main CLI
├── crates/                 # Workspace crates
│   ├── quota-tracker/      # Quota tracking crate
│   │   ├── src/
│   │   │   ├── tracker.rs  # Main quota tracker
│   │   │   ├── state.rs    # Quota state machine
│   │   │   ├── provider.rs # Provider definitions
│   │   │   └── schema.rs   # Database schema
│   └── usage-logger/       # Metrics logging crate
│       ├── src/
│       │   ├── metrics.rs  # Request metrics
│       │   ├── schema.rs   # Metrics database
│       │   └── benchmark.rs# Benchmark analysis
├── config/                 # Configuration files
├── docs/                   # Documentation
└── web-workspace/          # Frontend assets
```

## Development Workflow

### 1. Making Changes

**For backend changes:**
```bash
cd /path/to/zeroclaw-migration-bundle/.worktrees/smart-routing/backend
# Edit code
cargo build --release
cargo test
```

**For frontend changes:**
```bash
cd frontend-web
# Edit code
npm run build
cp -r dist/* ../backend/web-workspace/dist/
```

**For quota-tracker/usage-logger crates:**
```bash
cd backend
cargo build -p quota-tracker
cargo test -p quota-tracker
```

### 2. Testing

**Unit tests:**
```bash
cargo test
```

**Integration tests:**
```bash
cargo test --test integration
```

**Manual testing:**
```bash
# Start channels
export ZAI_API_KEY="your_key"
zeroclaw channel start

# Test quota tracking
zeroclaw quota status

# Test via Telegram
# Send message to @bot_name
```

### 3. Committing Changes

Follow conventional commits:
```
feat: add new provider support
fix: resolve quota tracking race condition
docs: update smart routing guide
refactor: improve benchmark algorithm
```

## Key Concepts

### Smart Routing

**Quota State Machine:**
- **Normal** (0-80%): Full access to all paid models
- **Conserving** (80-95%): Prefer efficient models
- **Critical** (95%+): Only free models

**Routing Decision:**
```
Request → Classify task → Check quota state → Select model → Execute
```

**Model Selection Priority:**
1. Task-specific routing (if configured)
2. Quota state constraints
3. Benchmark performance scores
4. Cost optimization

### Provider Implementation

**Adding a new provider:**

1. Implement `Provider` trait in `src/providers/mod.rs`
2. Add configuration in `config.toml`
3. Update quota limits in `quota_tracker`
4. Add to provider registry

**Example:**
```rust
// src/providers/new_provider.rs
use crate::providers::traits::*;

pub struct NewProvider {
    client: reqwest::Client,
    api_key: String,
}

impl Provider for NewProvider {
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse> {
        // Implementation
    }
}
```

### Channel Architecture

**Channel lifecycle:**
```
Start → Initialize → Listen for messages → Process → Respond → Loop
```

**Adding a new channel:**

1. Create `src/channels/new_channel.rs`
2. Implement channel traits
3. Add to channel registry in `src/channels/mod.rs`
4. Update config schema
5. Add CLI commands in `src/commands/mod.rs`

### Memory System

**Storage hierarchy:**
```
SQLite (persistent) ← → In-memory cache ← → Vector embeddings (Qdrant)
```

**Memory operations:**
- `recall`: Search by semantic similarity
- `remember`: Store with embeddings
- `forget`: Remove from all stores
- `hygiene`: Auto-cleanup old memories

## Configuration

### Config File Structure

`~/.zeroclaw/config.toml`:
```toml
# Provider configuration
[model_providers.zai]
base_url = "https://api.z.ai/api/coding/paas/v4"

# Channel configuration
[channels_config.telegram]
bot_token = "..."

# Quota tracking
[quota_tracker]
enabled = true
threshold_percent = 80.0

# Memory
[memory]
backend = "sqlite"
auto_save = true
```

### Environment Variables

Required for custom providers:
```bash
export ZAI_API_KEY="..."
export OPENROUTER_API_KEY="..."
export NVIDIA_API_KEY="..."
export MISTRAL_API_KEY="..."
```

### Schema Validation

Config schema is generated from Rust structs:
```rust
// src/config/schema.rs
#[derive(Debug, Deserialize, Serialize)]
pub struct Config {
    pub default_provider: String,
    pub default_model: String,
    pub model_providers: HashMap<String, ModelProviderConfig>,
    // ...
}
```

## Error Handling

### Error Types

```rust
use anyhow::{Result, Error, bail, anyhow};

// Use Result for fallible operations
pub async fn process_request() -> Result<Response> {
    if invalid {
        bail!("Invalid request");
    }
    Ok(response)
}

// Use thiserror for domain-specific errors
use thiserror::Error;

#[derive(Error, Debug)]
pub enum QuotaError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Quota exceeded")]
    Exceeded,
}
```

### Logging

```rust
use tracing::{info, warn, error, debug};

info!("Starting quota tracker");
warn!("Quota at 80%, switching to conservation mode");
error!("Failed to connect to provider: {}", err);
debug!("Processing request: {:?}", request);
```

## Performance Considerations

### Async/Await

**Preferred:**
```rust
async fn handle_request() -> Result<Response> {
    let data = fetch_data().await?;
    process(data).await
}
```

**Avoid blocking:**
```rust
// DON'T: std::thread::sleep
// DO: tokio::time::sleep
tokio::time::sleep(Duration::from_secs(1)).await;
```

### Memory Management

- Use `Arc` for shared state
- Use `tokio::sync::RwLock` for concurrent access
- Avoid large stack allocations
- Stream large responses instead of buffering

### Database Optimization

```rust
// Use prepared statements
let mut stmt = conn.prepare_cached("SELECT * FROM table WHERE id = ?")?;

// Batch operations
conn.execute("INSERT INTO table VALUES (?1, ?2)", params)?;

// Create indexes
conn.execute("CREATE INDEX IF NOT EXISTS idx_name ON table(col)", [])?;
```

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quota_state() {
        let state = QuotaState::from_usage_percentage(0.85, 0.8);
        assert_eq!(state, QuotaState::Conserving);
    }
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_quota_tracking() {
    let tracker = QuotaTracker::new(test_config())?;
    tracker.record_usage(Provider::Zai, 100, 200)?;
    let usage = tracker.get_usage_percentage();
    assert!(usage > 0.0);
}
```

### Manual Testing Checklist

- [ ] Quota status updates after requests
- [ ] Models switch at quota thresholds
- [ ] Channels receive and send messages
- [ ] Memory persists across restarts
- [ ] Frontend chats persist on refresh
- [ ] Benchmarks record correctly
- [ ] Error handling works as expected

## Common Tasks

### Add a New CLI Command

1. Create `src/commands/new_command.rs`
2. Implement command logic
3. Register in `src/commands/mod.rs`
4. Add to `src/main.rs` CLI definition

```rust
// src/commands/new_command.rs
use clap::Subcommand;
use anyhow::Result;

#[derive(Subcommand, Debug)]
pub enum NewCommand {
    DoSomething { arg: String },
}

pub async fn handle_new_command(cmd: NewCommand) -> Result<()> {
    match cmd {
        NewCommand::DoSomething { arg } => {
            println!("Doing something with {}", arg);
        }
    }
    Ok(())
}
```

### Debug Routing Issues

```bash
# Enable trace logging
export RUST_LOG=zeroclaw::routing=trace

# Check quota state
zeroclaw quota status

# View routing decisions
tail -f ~/.zeroclaw/logs/channel.log | grep "route"
```

### Reset Quota Tracking

```bash
# SQLite
rm ~/.zeroclaw/quota.db

# Via CLI
zeroclaw quota reset
```

### Update Database Schema

```rust
// crates/quota-tracker/src/schema.rs
pub fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute("CREATE TABLE IF NOT EXISTS...", [])?;
    // Add new migrations
    Ok(())
}
```

## Debugging Tips

### Enable Debug Logging

```bash
export RUST_LOG=debug,zeroclaw=trace
zeroclaw channel start
```

### Check Database Contents

```bash
sqlite3 ~/.zeroclaw/quota.db
.tables
SELECT * FROM quota_usage;
SELECT * FROM request_log;
```

### Monitor WebSocket Messages

```javascript
// Browser console
ws.addEventListener('message', (e) => {
    console.log('WS:', JSON.parse(e.data));
});
```

### Profile Performance

```bash
# Flame graph
cargo install flamegraph
cargo flamegraph

# Heap profiling
export HEAPPROFILE=/tmp/heap
```

## Important Constraints

### Compilation
- Rust 1.87+ required
- Use `--release` for production builds
- `codegen-units = 1` for low-memory builds

### Deployment
- Must set `ZAI_API_KEY` environment variable
- `quota.db` must be writable
- `qdrant_storage` directory required for vector search

### Security
- Never commit API keys
- Use `chmod 600 ~/.zeroclaw/config.toml`
- Validate all user inputs
- Sanitize shell commands

## Style Guidelines

### Rust
- Use `cargo fmt` before committing
- Run `cargo clippy` and fix warnings
- Prefer `anyhow::Result` over `Box<dyn Error>`
- Use `tracing` instead of `println!`

### TypeScript/React
- Use functional components with hooks
- Prefer Zustand for state management
- Use TypeScript strict mode
- Format with Prettier

### Documentation
- Document public APIs with `///`
- Use examples in doc comments
- Keep README.md up to date
- Update CLAUDE.md when changing architecture

## Troubleshooting

### Build Errors

**"failed to resolve: could not find bin"**
- Check module paths in `src/bin/`
- Ensure `src/bin/tui/mod.rs` exists

**"Only one package may specify links"**
- Check for conflicting `rusqlite` and `sqlx` dependencies
- Use `rusqlite` with `bundled` feature

### Runtime Errors

**"Custom API key not set"**
- Set environment variable: `export ZAI_API_KEY="..."`
- Or use `zeroclaw onboard` to configure

**"Telegram pairing required"**
- Send `/bind <code>` to your bot
- Check bot token is correct

### Performance Issues

**Slow response times**
- Check quota state (may be in critical mode)
- Verify provider rate limits
- Check benchmark scores

**High memory usage**
- Reduce `max_context_tokens`
- Enable memory hygiene
- Check for memory leaks

## Resources

### Internal Documentation
- `docs/smart-routing-guide.md` - Smart routing setup
- `docs/quota-tracking.md` - Quota tracking basics
- `src/agents/` - Agent system docs
- `src/providers/` - Provider implementations

### External References
- [Tokio Documentation](https://tokio.rs/)
- [Actix Documentation](https://actix.rs/)
- [React 19 Docs](https://react.dev/)
- [Rust Book](https://doc.rust-lang.org/book/)

### Tools
- `cargo` - Package manager
- `tokio-console` - Async debugging
- `sqlite3` - Database inspection
- `jq` - JSON processing

## Project-Specific Patterns

### Quota Tracking Pattern

```rust
// Record usage after every request
if let Some(usage) = response.usage {
    quota_tracker.record_usage(
        provider,
        usage.prompt_tokens,
        usage.completion_tokens
    )?;
}

// Check quota before routing
let quota_state = quota_tracker.get_state();
if !quota_state.allows_paid_models() {
    route_to_free_model();
}
```

### Channel Message Pattern

```rust
// All channels implement this
async fn handle_message(&self, msg: Message) -> Result<Response> {
    // 1. Parse message
    // 2. Route to appropriate handler
    // 3. Process request
    // 4. Format response
    // 5. Send back
}
```

### Memory Persistence Pattern

```rust
// Auto-save after changes
memory.recall(query).await?;
memory.remember(data).await?;
// Automatically persisted to SQLite
```

## Version History

### v0.1.7 (Current)
- Smart routing implementation
- Multi-provider support (Z.AI, OpenRouter, NVIDIA, Mistral)
- Quota tracking with automatic fallback
- Benchmark-based optimization
- Chat persistence fixes
- Telegram integration

### Previous Versions
- See git history for details

## Contributing

### Before Starting Work
1. Check existing issues and PRs
2. Read relevant documentation
3. Create a feature branch
4. Set up local development environment

### During Development
1. Write tests for new features
2. Update documentation
3. Follow style guidelines
4. Test changes manually

### Before Submitting
1. Run `cargo test` and `cargo clippy`
2. Format code with `cargo fmt`
3. Update README.md if needed
4. Ensure all tests pass

## Getting Help

### Internal
- Check `docs/` directory
- Review existing code patterns
- Ask in team chat

### External
- Rust Discord: https://discord.gg/rust-lang
- Tokio Discord: https://tokio.rs/discord
- Stack Overflow: Tag questions with `zeroclaw` and `rust`

## Notes

### Platform-Specific
- **Linux**: Full feature support
- **macOS**: Most features, no `rppal` (GPIO)
- **Windows**: Basic functionality, limited channel support

### Feature Flags
- `channel-matrix` - Enable Matrix channel
- `channel-lark` - Enable Lark/Feishu channels
- `sandbox-landlock` - Use Landlock sandboxing
- `observability-otel` - OpenTelemetry tracing

### Known Limitations
- Quota tracking is SQLite-specific (not distributed)
- Channel binding is per-daemon (not shared)
- Vector search requires Qdrant running
- Web dashboard requires Gateway server

---

**Last Updated:** 2026-03-13
**Version:** 0.1.7
**Status:** Active Development
