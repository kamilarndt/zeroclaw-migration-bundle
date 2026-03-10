# ZeroClaw Master Architecture

> **Single Source of Truth** | Last Updated: 2026-03-10
> The definitive reference for ZeroClaw system architecture, configuration, and operations.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Critical Paths & Commands](#critical-paths--commands)
4. [Memory Ecosystem](#memory-ecosystem)
5. [Configuration Reference](#configuration-reference)
6. [Service Management](#service-management)
7. [Source Structure](#source-structure)
8. [Strict Directives](#strict-directives)

---

## System Overview

**ZeroClaw** is a 100% Rust AI agent framework with:
- Zero overhead, zero compromise design philosophy
- Runs on $10 hardware with <5MB RAM
- Multi-provider LLM support (OpenRouter, Anthropic, OpenAI, Ollama, GLM, etc.)
- Channel integrations (Telegram, Discord, Matrix, WhatsApp, Nostr, Email, etc.)
- Local-only memory with vector search (Qdrant) and relational storage (SQLite)
- Hardware peripheral support (STM32, Raspberry Pi GPIO, ESP32)

**Version:** 0.1.7
**License:** MIT OR Apache-2.0
**Repository:** https://github.com/zeroclaw-labs/zeroclaw

---

## Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  Web Dashboard (React) │ Portal │ CLI │ Gateway API (42617)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Caddy Reverse Proxy                       │
│  (karndt.pl → Portal, dash.karndt.pl → Dashboard, /api → Daemon)│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ZeroClaw Daemon (Rust)                       │
├─────────────────────────────────────────────────────────────────┤
│ Agent Loop │ Tools │ Memory │ Channels │ Providers │ Auth       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Memory & Storage Layer                       │
├─────────────────────────────────────────────────────────────────┤
│ Qdrant (Vector) │ SQLite (Relational) │ File System            │
└─────────────────────────────────────────────────────────────────┘
```

### Core Modules

| Module | Description |
|--------|-------------|
| `src/agent/` | Agent loop, decision logic, prompt parsing |
| `src/providers/` | LLM provider abstraction with fault tolerance |
| `src/memory/` | Vector and relational storage with RAG |
| `src/channels/` | Platform integrations (Telegram, Discord, etc.) |
| `src/gateway/` | HTTP/WebSocket API server |
| `src/tools/` | Tool execution framework |
| `src/auth/` | JWT authentication and pairing |
| `src/config/` | Configuration management |
| `src/security/` | OTP, emergency-stop, sandboxing |

### Source Structure

```
src/
├── agent/          # Core agent loop and logic
├── approval/       # Approval workflows
├── auth/           # Authentication (JWT, pairing)
├── channels/       # Platform integrations
├── config/         # Configuration schema and loading
├── cost/           # Cost tracking
├── daemon/         # Daemon process management
├── gateway/        # HTTP/WebSocket API server
├── hardware/       # Hardware abstraction layer
├── integrations/   # External integrations (Composio)
├── memory/         # Storage backends (SQLite, Qdrant, Lucid)
├── providers/      # LLM provider implementations
├── runtime/        # Runtime context and execution
├── security/       # Security features (OTP, estop, sandbox)
├── tools/          # Tool definitions and execution
└── ...
```

---

## Critical Paths & Commands

### Development Paths

| Path | Purpose |
|------|---------|
| `~/Workspaces/zeroclaw-custom/` | Backend source (Build: `cargo install --path .`) |
| `~/.cargo/bin/zeroclaw` | Active binary |
| `~/.zeroclaw/config.toml` | Main configuration (Runtime: native) |
| `~/.zeroclaw/web/` | Frontend source (Build: `npm run build → dist/`) |
| `~/.caddy/caddy-config.json` | Caddy reverse proxy config |

### Database Paths

| Path | Purpose |
|------|---------|
| `~/.zeroclaw/memory/brain.db` | SQLite relational database |
| `~/.zeroclaw/qdrant_storage/` | Qdrant vector storage volume |
| `127.0.0.1:6333` | Qdrant HTTP API |

### Log Files

| Path | Purpose |
|------|---------|
| `~/.zeroclaw/daemon.log` | Daemon main log |
| `/tmp/zeroclaw-daemon-autorestart.log` | Daemon restart log |
| `/tmp/caddy-*.log` | Caddy proxy logs |

### Scripts

| Directory | Purpose |
|-----------|---------|
| `~/.zeroclaw/scripts/` | Operational scripts (daemon, caddy) |
| `~/Workspaces/zeroclaw-custom/scripts/` | Project scripts (CI, install) |

---

## Memory Ecosystem

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Vector DB | Qdrant (Docker) | Semantic search and embeddings |
| Relational DB | SQLite | Structured data and metadata |
| Embeddings | Local (`paraphrase-multilingual-MiniLM-L12-v2`) | No external API calls |

### RAG Configuration

```toml
[agent]
compact_context = true    # For 13B or smaller models
rag_chunk_limit = 2       # Maximum RAG chunks per query

[memory]
backend = "sqlite"
auto_save = true
embedding_provider = "none"  # Local only
```

### Qdrant Docker Deployment

```bash
docker run -d \
  -p 6333:6333 \
  -p 6334:6334 \
  -v ~/.zeroclaw/qdrant_storage:/qdrant/storage:z \
  -e QDRANT__TELEMETRY_DISABLED=true \
  -e QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=2 \
  --name qdrant \
  --restart unless-stopped \
  qdrant/qdrant
```

---

## Configuration Reference

### Core Settings

| Key | Default | Purpose |
|-----|---------|---------|
| `default_provider` | `openrouter` | LLM provider ID |
| `default_model` | `anthropic/claude-sonnet-4-6` | Model to use |
| `default_temperature` | `0.7` | Response randomness |

### Agent Configuration

```toml
[agent]
compact_context = false
max_tool_iterations = 10
max_history_messages = 50
parallel_tools = false
tool_dispatcher = "auto"
```

### Gateway Configuration

```toml
[gateway]
host = "127.0.0.1"
port = 42617
require_pairing = true
allow_public_bind = false
```

### Memory Configuration

```toml
[memory]
backend = "sqlite"           # sqlite, lucid, markdown, none
auto_save = true
embedding_provider = "none"
embedding_model = "text-embedding-3-small"
vector_weight = 0.7
keyword_weight = 0.3
```

### Security Configuration

```toml
[security.otp]
enabled = false
method = "totp"
gated_actions = ["shell", "file_write", "browser_open"]
gated_domains = []

[security.estop]
enabled = false
state_file = "~/.zeroclaw/estop-state.json"
```

### Autonomy Configuration

```toml
[autonomy]
level = "supervised"          # read_only, supervised, full
workspace_only = true
allowed_commands = []         # Required for shell execution
forbidden_paths = ["/etc", "/root", "/proc", "/sys", "~/.ssh"]
max_actions_per_hour = 20
```

### Provider Routes

```toml
[[model_routes]]
hint = "reasoning"
provider = "openrouter"
model = "provider/model-id"

[[embedding_routes]]
hint = "semantic"
provider = "openai"
model = "text-embedding-3-small"
dimensions = 1536
```

### Channel Configuration

All channels are deny-by-default (empty allowlist = deny all).

```toml
[channels_config.telegram]
bot_token = "your_bot_token"
allowed_usernames = ["user1", "user2"]

[channels_config.nostr]
private_key = "nsec1..." or hex
relays = ["relay.damus.io", "nos.lol"]
allowed_pubkeys = ["npub1...", "*"]

[channels_config.whatsapp]
# Cloud API mode
access_token = "your_token"
phone_number_id = "your_id"
allowed_numbers = ["1234567890", "*"]

# Web mode (requires --features whatsapp-web)
session_path = "~/.zeroclaw/whatsapp.db"
pair_phone = "1234567890"
```

### Config Path Resolution

1. `ZEROCLAW_WORKSPACE` environment variable
2. `~/.zeroclaw/active_workspace.toml` marker
3. Default: `~/.zeroclaw/config.toml`

---

## Service Management

### ZeroClaw Daemon

```bash
# Start daemon (first time)
~/.zeroclaw/start-daemon.sh

# Restart daemon (with memory backup)
~/.zeroclaw/scripts/daemon-safe-restart.sh restart

# Stop daemon
~/.zeroclaw/scripts/daemon-safe-restart.sh stop

# Check status
pgrep -f "zeroclaw daemon"
curl http://127.0.0.1:42617/health

# View logs
tail -f ~/.zeroclaw/daemon.log
```

### Rust Backend (Rebuild)

```bash
cd ~/Workspaces/zeroclaw-custom
cargo install --path .
# Binary: ~/.cargo/bin/zeroclaw
```

### React Frontend (Rebuild)

```bash
cd ~/.zeroclaw/workspace/web
npm run build
# Output: ~/.zeroclaw/workspace/web/dist/

cd ~/.zeroclaw/workspace/portal
npm run build
# Output: ~/.zeroclaw/workspace/portal/dist/
```

### Caddy Proxy

```bash
# Reload after config changes
caddy reload --config ~/.caddy/caddy-config.json

# Check status
~/.zeroclaw/scripts/caddy-manage.sh status

# Restart
~/.zeroclaw/scripts/caddy-manage.sh restart

# View logs
tail -f /tmp/caddy-*.log
```

### Qdrant Vector Database

```bash
# Check status
docker ps | grep qdrant
curl http://127.0.0.1:6333/collections

# Restart
docker restart qdrant

# View logs
docker logs --tail 50 qdrant

# Recreate (if corrupted)
docker stop qdrant && docker rm qdrant
# Re-run docker run command from above
```

---

## Source Structure

### Key Dependencies

| Category | Crates |
|----------|--------|
| Async Runtime | `tokio` (minimal features) |
| HTTP Client | `reqwest` (rustls-tls) |
| HTTP Server | `axum` (gateway API) |
| Serialization | `serde`, `serde_json` |
| Database | `rusqlite` (bundled) |
| WebSocket | `tokio-tungstenite` |
| Logging | `tracing`, `tracing-subscriber` |
| Crypto | `chacha20poly1305` (AEAD), `ring` (HMAC) |
| Hardware | `tokio-serial`, `nusb`, `probe-rs` (optional) |
| Observability | `opentelemetry` (optional) |

### Build Features

| Feature | Description |
|---------|-------------|
| `hardware` | Enable hardware peripherals |
| `channel-matrix` | Matrix channel support |
| `channel-lark` | Lark channel support |
| `memory-postgres` | PostgreSQL memory backend |
| `observability-otel` | OpenTelemetry export |
| `whatsapp-web` | Native WhatsApp client |
| `rag-pdf` | PDF extraction for datasheet RAG |
| `probe` | STM32/Nucleo debug probe |

### Build Profiles

```toml
[profile.release]
opt-level = "z"      # Optimize for size
lto = "fat"          # Maximum cross-crate optimization
codegen-units = 1    # Serialized codegen (low-memory)
strip = true          # Remove debug symbols
panic = "abort"      # Reduce binary size
```

Use `cargo build --profile release-fast` for faster compilation on powerful machines.

---

## Strict Directives

### Async Safety (CRITICAL)

**NEVER block the Tokio event loop.** Wrap ALL CPU-heavy/sync operations in:

```rust
tokio::task::spawn_blocking(|| {
    // CPU-intensive work here
    content_hash(data)
    vec_to_bytes(data)
})
.await?
```

Affected operations:
- `content_hash` calculations
- `vec_to_bytes` conversions
- Embedding computations
- Large file I/O

### File Organization

- **NO** `.backup` files in active directories
- Move backups strictly to `~/.zeroclaw/.archive/`
- Clean up `/tmp` and `~/bin` after tasks
- Archive only, never delete active configs

### IDE Protection

- **NEVER** kill `antigravity-server` (user's active IDE)
- Kill only orphaned `claude` sessions

### Memory Limits

- `rag_chunk_limit = 2` (maximum context chunks)
- `compact_context = true` (for 13B or smaller models)
- Use `bootstrap_max_chars = 6000` in compact mode

---

## Caddy Reverse Proxy Architecture

### Configuration File

`~/.caddy/caddy-config.json` (JSON format)

### Routing Rules

| Path Pattern | Target | Purpose |
|--------------|--------|---------|
| `/api/*` | `127.0.0.1:42617` | ZeroClaw API (strips CF headers) |
| `/ws/*` | `127.0.0.1:42617` | WebSocket connections |
| `/pair` | `127.0.0.1:42617` | Device pairing endpoint |
| `/health` | `127.0.0.1:42617` | Health check endpoint |
| `/*` | Static files | Frontend SPA fallback |

### Domains

| Domain | Root Path | Purpose |
|--------|-----------|---------|
| `karndt.pl` | `~/.zeroclaw/workspace/portal` | Main portal |
| `dash.karndt.pl` | `~/.zeroclaw/workspace/web/dist` | Admin dashboard |

### Header Sanitization

API routes strip these Cloudflare headers to prevent spoofing:
- `CF-Connecting-IP`, `CF-Ray`, `X-Forwarded-For`, `X-Real-IP`
- `CF-IPCountry`, `CF-Visitor`, `CF-EW-Via`
- `Sec-Fetch-*`, `Sec-CH-UA-*`, `DNT`, `User-Agent`

---

## Quick Troubleshooting

### API not responding

```bash
curl http://127.0.0.1:42617/health
tail -f ~/.zeroclaw/daemon.log
~/.zeroclaw/scripts/daemon-safe-restart.sh restart
```

### Frontend not loading

```bash
~/.zeroclaw/scripts/caddy-manage.sh status
ls ~/.zeroclaw/workspace/web/dist/
cd ~/.zeroclaw/workspace/web && npm run build
```

### Vector search failing

```bash
curl http://127.0.0.1:6333/collections
docker ps | grep qdrant
docker logs --tail 50 qdrant
docker restart qdrant
```

### Memory lost after restart

```bash
ls -lh ~/.zeroclaw/memory/backups/
~/.zeroclaw/scripts/daemon-safe-restart.sh restore
```

---

**Constitution:** `~/CLAUDE.md`
**Workspace:** `~/Workspaces/zeroclaw-custom/`
**Documentation Hub:** This file (MASTER_ARCHITECTURE.md)
