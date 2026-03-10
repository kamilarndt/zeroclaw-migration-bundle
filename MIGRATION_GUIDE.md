# ZeroClaw OS Migration Guide

**Purpose:** Complete guide for deploying ZeroClaw OS on a fresh Ubuntu server from this migration bundle.

**Last Updated:** 2026-03-10

---

## Table of Contents

1. [Environment Prerequisites](#1-environment-prerequisites)
2. [Directory Setup](#2-directory-setup)
3. [Backend Installation (Rust)](#3-backend-installation-rust)
4. [Frontend Build (React/TypeScript)](#4-frontend-build-reacttypescript)
5. [Docker & Qdrant Setup](#5-docker--qdrant-setup)
6. [State Migration (Optional)]#6-state-migration-optional)
7. [Service Configuration](#7-service-configuration)
8. [Caddy Proxy Setup](#8-caddy-proxy-setup)
9. [Verification](#9-verification)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Environment Prerequisites

### 1.1 System Requirements
- **OS:** Ubuntu 22.04 LTS or 24.04 LTS (recommended)
- **RAM:** Minimum 4GB (8GB recommended for development)
- **Storage:** 20GB free space
- **CPU:** x86_64 or ARM64

### 1.2 Install Base Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential pkg-config libssl-dev

# Install Node.js 20.x (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
node --version  # Should be v20.x.x
npm --version   # Should be 10.x.x
```

### 1.3 Install Rust

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Verify Rust installation
rustc --version
cargo --version
```

### 1.4 Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker
docker --version
docker compose version
```

### 1.5 Install Caddy Web Server

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# Verify Caddy
caddy version
```

---

## 2. Directory Setup

```bash
# Create ZeroClaw directory structure
mkdir -p ~/.zeroclaw
mkdir -p ~/.zeroclaw/memory
mkdir -p ~/.zeroclaw/web
mkdir -p ~/.zeroclaw/workspace
mkdir -p ~/.caddy
```

---

## 3. Backend Installation (Rust)

### 3.1 Copy Backend Source

```bash
# From this migration bundle, copy backend to workspace
cp -r backend/ ~/.zeroclaw/workspace/
cd ~/.zeroclaw/workspace/backend

# OR if working directly from migration bundle:
cd ~/zeroclaw-migration-bundle/backend
```

### 3.2 Build ZeroClaw

```bash
# Build and install locally
cargo install --path .

# This will:
# 1. Compile all Rust crates
# 2. Install the zeroclaw binary to ~/.cargo/bin/zeroclaw
# 3. Take 10-30 minutes depending on hardware
```

### 3.3 Verify Binary Installation

```bash
# Check binary exists
~/.cargo/bin/zeroclaw --version
# OR if cargo bin is in PATH:
zeroclaw --version
```

**Note:** If `zeroclaw` command is not found, add to PATH:
```bash
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

## 4. Frontend Build (React/TypeScript)

### 4.1 Build Web Frontend

```bash
# Copy frontend source
cp -r frontend-web/ ~/.zeroclaw/workspace/web
cd ~/.zeroclaw/workspace/web

# Install dependencies
npm install

# Build for production
npm run build

# Copy built files to ZeroClaw web directory
cp -r dist/* ~/.zeroclaw/web/
```

### 4.2 Build Portal Frontend (If Exists)

```bash
# If frontend-portal has substantial content:
cd ~/zeroclaw-migration-bundle/frontend-portal

# If it has package.json, build it:
if [ -f package.json ]; then
    npm install
    npm run build
    cp -r dist/* ~/.zeroclaw/web/portal/
else
    # For minimal portal (just static files):
    cp -r * ~/.zeroclaw/web/portal/
fi
```

---

## 5. Docker & Qdrant Setup

### 5.1 Create Qdrant Docker Compose Configuration

```bash
cat > ~/.zeroclaw/docker-compose.yml <<'EOF'
services:
  qdrant:
    image: qdrant/qdrant:v1.12.0
    container_name: zeroclaw-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
      - QDRANT__LOG_LEVEL=INFO
    restart: unless-stopped
    command: ./qdrant --optimizers-build-index-parallelism=1 --optimizer-threads=1
EOF
```

### 5.2 Start Qdrant

```bash
cd ~/.zeroclaw
docker compose up -d

# Verify Qdrant is running
curl http://localhost:6333/collections

# Expected output: {"status":"ok","time":0.123...}
```

---

## 6. State Migration (Optional)

> **Only perform this section if migrating from an existing server and want to preserve existing memories/conversations.**

### 6.1 Transfer SQLite Database

```bash
# On OLD server: Create backup
cd ~/.zeroclaw/memory
tar czf /tmp/zeroclaw-state.tar.gz brain.db qdrant_storage/

# Transfer via SCP (from NEW server)
scp user@old-server:/tmp/zeroclaw-state.tar.gz /tmp/

# On NEW server: Extract
cd ~/.zeroclaw/memory
tar xzf /tmp/zeroclaw-state.tar.gz

# Verify database integrity
sqlite3 brain.db "SELECT COUNT(*) FROM memories;"
```

---

## 7. Service Configuration

### 7.1 Copy Configuration Files

```bash
# Copy config from migration bundle
cp ~/zeroclaw-migration-bundle/config/config.toml ~/.zeroclaw/config.toml

# IMPORTANT: Edit the config and replace placeholder API keys with real ones
nano ~/.zeroclaw/config.toml
```

### 7.2 Configure API Keys

Edit `~/.zeroclaw/config.toml` and replace all placeholder values:

```toml
# Example replacements needed:
api_key = "YOUR_API_KEY_HERE"           # Replace with actual Z.AI/OpenAI key
bot_token = "YOUR_TOKEN_HERE"           # Replace with actual Telegram bot token
# ... other keys
```

### 7.3 Create Systemd Service (Optional)

```bash
sudo tee /etc/systemd/system/zeroclaw.service <<'EOF'
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

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable zeroclaw
sudo systemctl start zeroclaw

# Check status
sudo systemctl status zeroclaw
```

---

## 8. Caddy Proxy Setup

### 8.1 Copy Caddy Configuration

```bash
# Copy Caddy config from migration bundle
cp ~/zeroclaw-migration-bundle/config/caddy-config.json ~/.caddy/Caddyfile

# OR if using JSON format:
cp ~/zeroclaw-migration-bundle/config/caddy-config.json ~/.caddy/caddy-config.json
```

### 8.2 Update Domain Configuration

Edit `~/.caddy/Caddyfile` and update:
- Domain names (replace `your-domain.com` with actual domain)
- SSL certificate paths (if using custom certs)

### 8.3 Start Caddy

```bash
# Start Caddy with custom config
sudo caddy start --config ~/.caddy/Caddyfile

# OR reload if already running
sudo caddy reload --config ~/.caddy/Caddyfile

# Verify Caddy is running
sudo systemctl status caddy
curl https://localhost -I
```

---

## 9. Verification

### 9.1 Health Check Script

```bash
#!/bin/bash
echo "=== ZeroClaw OS Health Check ==="
echo ""

# 1. Check Binary
echo "[1] Checking ZeroClaw binary..."
if command -v zeroclaw &> /dev/null; then
    echo "✅ ZeroClaw binary installed"
else
    echo "❌ ZeroClaw binary not found!"
fi

# 2. Check Qdrant
echo "[2] Checking Qdrant..."
if curl -s http://localhost:6333/collections | grep -q "ok"; then
    echo "✅ Qdrant is responding"
else
    echo "❌ Qdrant not responding!"
fi

# 3. Check Frontend
echo "[3] Checking frontend files..."
if [ -d "$HOME/.zeroclaw/web" ] && [ "$(ls -A $HOME/.zeroclaw/web)" ]; then
    echo "✅ Frontend files present"
else
    echo "❌ Frontend files missing!"
fi

# 4. Check Config
echo "[4] Checking configuration..."
if [ -f "$HOME/.zeroclaw/config.toml" ]; then
    echo "✅ Config file exists"
    if grep -q "YOUR_API_KEY_HERE" ~/.zeroclaw/config.toml; then
        echo "⚠️  WARNING: Placeholder API keys still present!"
    else
        echo "✅ API keys configured"
    fi
else
    echo "❌ Config file missing!"
fi

echo ""
echo "=== Health Check Complete ==="
```

---

## 10. Troubleshooting

### 10.1 Build Failures

**Problem:** Rust build fails with compilation errors
```bash
# Solution: Update Rust and dependencies
rustup update
cargo clean
cargo install --path .
```

### 10.2 Qdrant Connection Refused

**Problem:** Cannot connect to Qdrant on port 6333
```bash
# Solution: Check Docker container
docker ps -a | grep qdrant
docker logs zeroclaw-qdrant
docker restart zeroclaw-qdrant
```

### 10.3 Frontend Build Errors

**Problem:** npm install fails with dependencies
```bash
# Solution: Clean and reinstall
cd ~/.zeroclaw/workspace/web
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## Quick Start Command Summary

```bash
# Complete setup (run as one-liner after prerequisites):
mkdir -p ~/.zeroclaw/{memory,web,workspace} ~/.caddy && \
cd ~/zeroclaw-migration-bundle/backend && cargo install --path . && \
cd ~/zeroclaw-migration-bundle/frontend-web && npm install && npm run build && \
cp -r dist/* ~/.zeroclaw/web/ && \
cp ~/zeroclaw-migration-bundle/config/config.toml ~/.zeroclaw/ && \
cp ~/zeroclaw-migration-bundle/config/caddy-config.json ~/.caddy/Caddyfile && \
nano ~/.zeroclaw/config.toml  # Edit API keys!
```

---

**End of Migration Guide**
