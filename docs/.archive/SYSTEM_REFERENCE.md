# ZeroClaw System Reference Manual

> **On-Demand Deep-Dive Documentation**
> Use this manual when troubleshooting routing, databases, or services.
> For quick reference, see `~/CLAUDE.md` (Constitution).

---

## Table of Contents

1. [Caddy Reverse Proxy Architecture](#caddy-reverse-proxy-architecture)
2. [Qdrant Vector Database Setup](#qdrant-vector-database-setup)
3. [Service Management Cheatsheet](#service-management-cheatsheet)
4. [ML & Python Environment](#ml--python-environment)
5. [Critical File Paths](#critical-file-paths)

---

## Caddy Reverse Proxy Architecture

### Overview
ZeroClaw uses Caddy as a reverse proxy to route traffic between public domains (port 80/443) and the internal ZeroClaw daemon (port 42617).

### Configuration

**Config File:** `~/.caddy/caddy-config.json` (JSON format)

**Domains Served:**
- `karndt.pl` → Portal frontend (`~/.zeroclaw/workspace/portal`)
- `dash.karndt.pl` → Dashboard frontend (`~/.zeroclaw/workspace/web/dist`)

### Routing Rules

| Path Pattern | Target | Purpose |
|--------------|--------|---------|
| `/api/*` | `127.0.0.1:42617` | ZeroClaw API (strips Cloudflare headers) |
| `/ws/*` | `127.0.0.1:42617` | WebSocket connections |
| `/pair` | `127.0.0.1:42617` | Device pairing endpoint |
| `/health` | `127.0.0.1:42617` | Health check endpoint |
| `/*` (catch-all) | Static files | Frontend SPA fallback to index.html |

### Header Sanitization
API routes (`/api/*`, `/pair`) strip these Cloudflare headers to prevent spoofing:
- `CF-Connecting-IP`, `CF-Ray`, `X-Forwarded-For`, `X-Real-IP`, `True-Client-IP`
- `CF-IPCountry`, `CF-Visitor`, `CF-EW-Via`
- `Sec-Fetch-*`, `Sec-CH-UA-*`, `DNT`, `User-Agent`

### Frontend Roots

| Domain | Root Path | Purpose |
|--------|-----------|---------|
| karndt.pl | `~/.zeroclaw/workspace/portal` | Main portal |
| dash.karndt.pl | `~/.zeroclaw/workspace/web/dist` | Admin dashboard |

### Management Commands

**Reload Caddy (after config changes):**
```bash
caddy reload --config ~/.caddy/caddy-config.json
```

**Check Caddy status:**
```bash
~/.zeroclaw/scripts/caddy-manage.sh status
```

**View Caddy logs:**
```bash
~/.zeroclaw/scripts/caddy-manage.sh logs
# or
tail -f /tmp/caddy-8080.log
```

**Restart Caddy:**
```bash
~/.zeroclaw/scripts/caddy-manage.sh restart
```

---

## Qdrant Vector Database Setup

### Purpose
Qdrant provides the vector storage for ZeroClaw's semantic memory and RAG (Retrieval-Augmented Generation) capabilities.

### Docker Deployment (Recommended)

**Standard Docker Run Command:**
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

**Parameters Explained:**
- `6333:6333` - HTTP API port
- `6334:6334` - gRPC API port
- `~/.zeroclaw/qdrant_storage:/qdrant/storage:z` - Persistent storage volume
- `QDRANT__TELEMETRY_DISABLED=true` - Disable telemetry
- `MAX_SEARCH_THREADS=2` - Limit CPU usage for search operations

### Management Commands

**Check Qdrant status:**
```bash
docker ps | grep qdrant
# or
curl http://127.0.0.1:6333/collections
```

**View Qdrant logs:**
```bash
docker logs --tail 50 qdrant
```

**Restart Qdrant:**
```bash
docker restart qdrant
```

**Recreate Qdrant (if corrupted):**
```bash
docker stop qdrant && docker rm qdrant
# Then re-run the docker run command above
```

### Troubleshooting Qdrant

**If Qdrant hangs on "Recovering WAL":**
1. Stop container: `docker stop qdrant && docker rm qdrant`
2. Backup storage: `cp -r ~/.zeroclaw/qdrant_storage ~/.zeroclaw/qdrant_storage.backup`
3. Restart with fresh container (see docker run command above)

**Common Issues:**
- WSL2 network bridge problems → Use native installation instead of Docker
- Port conflicts → Check with `ss -tuln | grep 6333`
- Storage corruption → Restore from backup or recreate collection

---

## Service Management Cheatsheet

### ZeroClaw Daemon

**Restart Daemon (with memory backup):**
```bash
~/.zeroclaw/scripts/daemon-safe-restart.sh restart
```

**Start Daemon (first time):**
```bash
~/.zeroclaw/start-daemon.sh
```

**Stop Daemon:**
```bash
~/.zeroclaw/scripts/daemon-safe-restart.sh stop
# or
pkill -f "zeroclaw daemon"
```

**Check Daemon Status:**
```bash
pgrep -f "zeroclaw daemon"
# or
curl http://127.0.0.1:42617/health
```

**Daemon Logs:**
```bash
tail -f ~/.zeroclaw/daemon.log
# or (for auto-restart logs)
tail -f /tmp/zeroclaw-daemon-autorestart.log
```

**Memory Backup Only:**
```bash
~/.zeroclaw/scripts/daemon-safe-restart.sh backup
```

**Restore Latest Memory Backup:**
```bash
~/.zeroclaw/scripts/daemon-safe-restart.sh restore
```

### Rust Backend (Recompilation)

**Rebuild and Install:**
```bash
cd ~/Workspaces/zeroclaw-custom
cargo install --path .
```

**Binary Location:** `~/.cargo/bin/zeroclaw`

**After rebuild, restart daemon:** `~/.zeroclaw/scripts/daemon-safe-restart.sh restart`

### React Frontend (Rebuild)

**Build Dashboard:**
```bash
cd ~/.zeroclaw/workspace/web
npm run build
```

**Build Portal:**
```bash
cd ~/.zeroclaw/workspace/portal
npm run build
```

**Output Locations:**
- Dashboard: `~/.zeroclaw/workspace/web/dist/`
- Portal: `~/.zeroclaw/workspace/portal/dist/`

**Note:** Caddy auto-serves from these directories. No restart needed after build.

### Caddy Proxy

**Reload After Config Changes:**
```bash
caddy reload --config ~/.caddy/caddy-config.json
```

**Full Restart:**
```bash
~/.zeroclaw/scripts/caddy-manage.sh restart
```

**Start on Port 8080 (testing, no sudo):**
```bash
~/.zeroclaw/scripts/caddy-manage.sh start
```

**Start on Ports 80/443 (production, requires sudo):**
```bash
sudo caddy run --config ~/.zeroclaw/workspace/caddyfile-dashboard --adapter caddyfile
```

---

## ML & Python Environment

### Critical Libraries

**Location:** `~/.local/lib/python3.12/site-packages/`

**Core ML Packages:**
- `torch` (2.10.0) - PyTorch framework
- `sentence-transformers` (5.2.3) - Embedding models
- `transformers` (5.3.0) - Hugging Face transformers
- `cuda` (12.9.4) - NVIDIA CUDA bindings

**Additional Libraries:** `~/bin/lib/ollama/`

### ⚠️ CRITICAL WARNING

**NEVER DELETE these directories:**
- `~/.local/lib/python3.12/` - Contains PyTorch, CUDA, and transformer models
- `~/bin/lib/` - Contains Ollama runtime libraries

These are large binary packages (several GB) that are difficult to reinstall and are required for:
- Local embedding generation (RAG)
- GPU acceleration (if available)
- Ollama LLM integration

### Model Storage

**Embedding Model:** `paraphrase-multilingual-MiniLM-L12-v2` (local only, no MemOS)

**Model Cache:** `~/.cache/huggingface/` and `~/.cache/torch/`

---

## Critical File Paths

### Configuration

| File | Purpose |
|------|---------|
| `~/.zeroclaw/config.toml` | Main ZeroClaw config (runtime: native) |
| `~/.caddy/caddy-config.json` | Caddy reverse proxy rules |

### Databases

| File/Path | Purpose |
|-----------|---------|
| `~/.zeroclaw/memory/brain.db` | SQLite relational database |
| `~/.zeroclaw/qdrant_storage/` | Qdrant vector storage volume |
| `127.0.0.1:6333` | Qdrant HTTP API |

### Binaries

| Path | Purpose |
|------|---------|
| `~/.cargo/bin/zeroclaw` | ZeroClaw daemon binary |
| `/usr/bin/caddy` | Caddy web server |

### Logs

| File | Purpose |
|------|---------|
| `~/.zeroclaw/daemon.log` | Daemon main log |
| `/tmp/zeroclaw-daemon-autorestart.log` | Daemon restart log |
| `/tmp/caddy-8080.log` | Caddy log (port 8080) |
| `/tmp/caddy-dashboard.log` | Caddy log (ports 80/443) |

### Scripts

| Directory | Purpose |
|-----------|---------|
| `~/.zeroclaw/scripts/` | Operational scripts (daemon, caddy) |
| `~/Workspaces/zeroclaw-custom/scripts/` | Project scripts (CI, install) |

---

## Quick Troubleshooting Flow

### "API not responding"
1. Check daemon: `curl http://127.0.0.1:42617/health`
2. Check logs: `tail -f ~/.zeroclaw/daemon.log`
3. Restart daemon: `~/.zeroclaw/scripts/daemon-safe-restart.sh restart`

### "Frontend not loading"
1. Check Caddy: `~/.zeroclaw/scripts/caddy-manage.sh status`
2. Check build exists: `ls ~/.zeroclaw/workspace/web/dist/`
3. Rebuild if missing: `cd ~/.zeroclaw/workspace/web && npm run build`

### "Vector search failing"
1. Check Qdrant: `curl http://127.0.0.1:6333/collections`
2. Check container: `docker ps | grep qdrant`
3. View logs: `docker logs --tail 50 qdrant`
4. Restart if needed: `docker restart qdrant`

### "Memory lost after restart"
1. Check backups: `ls -lh ~/.zeroclaw/memory/backups/`
2. Restore: `~/.zeroclaw/scripts/daemon-safe-restart.sh restore`

---

**Last Updated:** 2026-03-09
**Constitution:** `~/CLAUDE.md`
**Workspace:** `~/Workspaces/zeroclaw-custom/`
