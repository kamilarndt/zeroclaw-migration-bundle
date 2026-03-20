# Deployment Guide - ZeroClaw OS

Szczegółowy przewodnik wdrażania ZeroClaw OS w różnych środowiskach.

---

## 📋 Spis treści

1. [Production Deployment](#production-deployment)
2. [Development Setup](#development-setup)
3. [Docker Deployment](#docker-deployment)
4. [Monitoring & Logging](#monitoring--logging)
5. [Backup Strategy](#backup-strategy)
6. [Security Hardening](#security-hardening)

---

## 🚀 Production Deployment

### Wymagania produkcyjne

- **Serwer:** Ubuntu 22.04/24.04 LTS
- **RAM:** 4GB minimum (8GB+ zalecane dla wielu agentów)
- **CPU:** 2+ cores
- **Storage:** 50GB+ SSD
- **Network:** Stabilne połączenie internetowe

### Krok 1: Przygotowanie serwera

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install fail2ban (security)
sudo apt install -y fail2ban

# Configure firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Krok 2: Zainstaluj ZeroClaw

```bash
# Clone lub copy migration bundle
cd ~/
cp -r zeroclaw-migration-bundle ~/.zeroclaw-install
cd ~/.zeroclaw-install/backend

# Install w release mode
cargo install --path . --release

# Verify installation
~/.cargo/bin/zeroclaw --version
```

### Krok 3: Skonfiguruj środowisko

```bash
# Create production directories
sudo mkdir -p /var/lib/zeroclaw
sudo mkdir -p /var/log/zeroclaw
sudo chown -R $USER:$USER /var/lib/zeroclaw
sudo chown -R $USER:$USER /var/log/zeroclaw

# Copy configuration
sudo cp config/config.toml /etc/zeroclaw.toml
sudo chmod 600 /etc/zeroclaw.toml

# Edit production config
sudo nano /etc/zeroclaw.toml
```

### Krok 4: Skonfiguruj systemd service

```bash
sudo tee /etc/systemd/system/zeroclaw.service <<'EOF'
[Unit]
Description=ZeroClaw AI Agent Daemon
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=zeroclaw
Group=zeroclaw
WorkingDirectory=/var/lib/zeroclaw
ExecStart=/home/zeroclaw/.cargo/bin/zeroclaw daemon --config /etc/zeroclaw.toml
Restart=always
RestartSec=10
Environment="RUST_LOG=info"
Environment="ZAI_API_KEY_FILE=/etc/zeroclaw/api_key"

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/zeroclaw /var/log/zeroclaw

[Install]
WantedBy=multi-user.target
EOF

# Create zeroclaw user
sudo useradd -r -s /bin/false -d /var/lib/zeroclaw zeroclaw

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable zeroclaw
sudo systemctl start zeroclaw

# Check status
sudo systemctl status zeroclaw
```

### Krok 5: Skonfiguruj Caddy (HTTPS)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# Copy Caddyfile
sudo cp config/caddy-config.json /etc/caddy/Caddyfile

# Edit domain
sudo nano /etc/caddy/Caddyfile
# Replace your-domain.com with actual domain

# Restart Caddy
sudo systemctl restart caddy
```

---

## 💻 Development Setup

### Lokalne środowisko deweloperskie

```bash
# Clone repo
git clone https://github.com/zeroclaw-labs/zeroclaw.git
cd zeroclaw

# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Backend development
cd backend
cargo install --path .
cargo test
cargo watch -x check -x test  # Auto-reload on changes

# Frontend development
cd frontend-web
npm install
npm run dev
```

### Hot Reload Development

```bash
# Terminal 1: Backend with auto-reload
cd backend
cargo watch -x run

# Terminal 2: Frontend dev server
cd frontend-web
npm run dev

# Terminal 3: Qdrant
docker compose up -d
```

---

## 🐳 Docker Deployment

### Docker Compose Setup

```bash
# Create docker-compose.production.yml
cat > docker-compose.production.yml <<'EOF'
services:
  zeroclaw:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: zeroclaw
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/var/lib/zeroclaw
      - ./config.toml:/etc/zeroclaw/config.toml:ro
    environment:
      - RUST_LOG=info
      - ZAI_API_KEY=${ZAI_API_KEY}
    depends_on:
      - qdrant

  qdrant:
    image: qdrant/qdrant:v1.12.0
    container_name: zeroclaw-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
    volumes:
      - ./qdrant_storage:/qdrant/storage

  caddy:
    image: caddy:latest
    container_name: zeroclaw-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy_data:/data
      - ./caddy_config:/config
    depends_on:
      - zeroclaw

volumes:
  caddy_data:
  caddy_config:
EOF

# Start services
docker compose -f docker-compose.production.yml up -d

# View logs
docker compose -f docker-compose.production.yml logs -f
```

---

## 📊 Monitoring & Logging

### Health Check Script

```bash
#!/bin/bash
# /usr/local/bin/zeroclaw-healthcheck

echo "=== ZeroClaw Health Check ==="

# Check service
if systemctl is-active --quiet zeroclaw; then
    echo "✅ Service running"
else
    echo "❌ Service not running"
    exit 1
fi

# Check API
if curl -sf http://localhost:8080/health > /dev/null; then
    echo "✅ API responding"
else
    echo "❌ API not responding"
fi

# Check Qdrant
if curl -sf http://localhost:6333/collections > /dev/null; then
    echo "✅ Qdrant responding"
else
    echo "❌ Qdrant not responding"
fi

# Check disk space
DISK_USAGE=$(df /var/lib/zeroclaw | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo "✅ Disk usage: ${DISK_USAGE}%"
else
    echo "⚠️  Disk usage high: ${DISK_USAGE}%"
fi

# Check memory
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2*100}')
echo "💾 Memory usage: ${MEM_USAGE}%"
```

### Log Management

```bash
# Configure logrotate
sudo tee /etc/logrotate.d/zeroclaw <<'EOF'
/var/log/zeroclaw/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 zeroclaw zeroclaw
    postrotate
        systemctl reload zeroclaw > /dev/null 2>&1 || true
    endscript
}
EOF
```

---

## 💾 Backup Strategy

### Automated Backup Script

```bash
#!/bin/bash
# /usr/local/bin/zeroclaw-backup

BACKUP_DIR="/backup/zeroclaw"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup databases
tar czf "$BACKUP_DIR/db_$DATE.tar.gz" \
    /var/lib/zeroclaw/*.db

# Backup Qdrant data
tar czf "$BACKUP_DIR/qdrant_$DATE.tar.gz" \
    /var/lib/zeroclaw/qdrant_storage/

# Backup config
cp /etc/zeroclaw.toml "$BACKUP_DIR/config_$DATE.toml"

# Keep last 7 days, delete older
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.toml" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Cron Job

```bash
# Daily backup at 2 AM
sudo crontab -e

# Add line:
0 2 * * * /usr/local/bin/zeroclaw-backup >> /var/log/zeroclaw/backup.log 2>&1
```

---

## 🔒 Security Hardening

### Best Practices

1. **API Keys:**
   ```bash
   # Use environment variables, not hardcoded
   sudo nano /etc/zeroclaw/api_key
   chmod 600 /etc/zeroclaw/api_key
   ```

2. **File Permissions:**
   ```bash
   sudo chmod 600 /etc/zeroclaw.toml
   sudo chmod 640 /var/log/zeroclaw/*.log
   ```

3. **Rate Limiting:**
   ```toml
   # In config.toml
   [rate_limit]
   enabled = true
   requests_per_minute = 60
   burst = 10
   ```

4. **CORS:**
   ```toml
   [cors]
   allowed_origins = ["https://your-domain.com"]
   allowed_methods = ["GET", "POST"]
   ```

5. **Fail2ban:**
   ```bash
   sudo tee /etc/fail2ban/jail.local <<'EOF'
   [zeroclaw]
   enabled = true
   port = http,https
   filter = zeroclaw
   logpath = /var/log/zeroclaw/access.log
   maxretry = 5
   bantime = 3600
   EOF
   ```

---

## 📈 Performance Tuning

### Backend Optimization

```toml
# In config.toml
[performance]
max_connections = 100
connection_timeout = 30
request_timeout = 120
worker_threads = 4

[cache]
enabled = true
max_size_mb = 512
ttl_seconds = 3600
```

### Database Optimization

```bash
# SQLite optimization
sqlite3 /var/lib/zeroclaw/brain.db <<EOF
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=-64000;
PRAGMA temp_store=memory;
EOF
```

---

## 🔄 Updates & Maintenance

### Update Procedure

```bash
# 1. Backup first
sudo /usr/local/bin/zeroclaw-backup

# 2. Stop service
sudo systemctl stop zeroclaw

# 3. Update code
cd ~/.zeroclaw-install
git pull origin main

# 4. Rebuild
cd backend
cargo install --path . --force

# 5. Run migrations (if any)
~/.cargo/bin/zeroclaw migrate

# 6. Start service
sudo systemctl start zeroclaw

# 7. Verify
sudo systemctl status zeroclaw
```

---

## 🆘 Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u zeroclaw -n 50

# Check configuration
~/.cargo/bin/zeroclaw --config /etc/zeroclaw.toml validate

# Check ports
sudo netstat -tulpn | grep -E '(8080|6333)'
```

### High memory usage

```bash
# Check memory
free -h

# Restart service
sudo systemctl restart zeroclaw

# Reduce cache in config.toml
```

### Database locked

```bash
# Check for processes
sudo lsof /var/lib/zeroclaw/*.db

# Kill stale connections
sudo systemctl restart zeroclaw
```

---

**Last Updated:** 2026-03-20
