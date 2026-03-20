# ZeroClaw OS - Migration Bundle

> **Zero overhead. Zero compromise. 100% Rust. 100% Agnostic.** 🦀

Kompletny zestaw migracyjny ZeroClaw OS - fastest, smallest AI assistant działający na sprzęcie za $10 z zużyciem <5MB RAM.

---

## 📦 Zawartość pakietu

Ten folder zawiera kompletny obraz systemu ZeroClaw OS gotowy do wdrożenia na świeżym serwerze Ubuntu:

```
zeroclaw-migration-bundle/
├── backend/              # Backend Rust (zeroclaw binary)
│   ├── src/             # Główne źródła
│   ├── crates/          # Workspace crates
│   │   ├── robot-kit/   # Robot control toolkit
│   │   ├── quota-tracker/   # Śledzenie zużycia API
│   │   └── usage-logger/    # Logowanie metryk
│   ├── web-workspace/  # Frontend assets
│   └── docs/            # Dokumentacja techniczna
│
├── frontend-web/         # React 19 + TypeScript PWA
│   ├── src/             # Komponenty UI
│   │   ├── components/  # Reużywalne komponenty
│   │   ├── pages/       # Strony aplikacji
│   │   ├── stores/      # Zustand state management
│   │   └── types/       # Definicje TypeScript
│   └── package.json
│
├── frontend-portal/      # Portal użytkownika
├── storage/              # Dane przechowywania
├── config/               # Konfiguracje
│   ├── config.toml      # Główna konfiguracja
│   └── caddy-config.json # Reverse proxy config
│
├── docs/                 # Dokumentacja
│   ├── MASTER_ARCHITECTURE.md
│   ├── DEEP_AUDIT_AND_TESTS_2026.md
│   └── REFACTORING_PLAN.md
│
├── snapshots/            # Migawki systemu
└── MIGRATION_GUIDE.md    # Przewodnik wdrożenia
```

---

## 🚀 Szybki start

### Wymagania systemowe

- **OS:** Ubuntu 22.04 LTS lub 24.04 LTS
- **RAM:** Min. 4GB (zalecane 8GB do developmentu)
- **Storage:** 20GB wolnego miejsca
- **CPU:** x86_64 lub ARM64

### Instalacja (5 minut)

```bash
# 1. Skopiuj ten folder na serwer docelowy
scp -r zeroclaw-migration-bundle/ user@server:~/

# 2. Zaloguj się na serwer i uruchom instalację
ssh user@server
cd ~/zeroclaw-migration-bundle

# 3. Zainstaluj zależności (Ubuntu/Debian)
sudo apt update && sudo apt install -y curl wget git build-essential pkg-config libssl-dev

# 4. Zainstaluj Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# 5. Zainstaluj Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 6. Zainstaluj Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

### Budowanie i wdrożenie

```bash
# 1. Zbuduj backend (10-30 min)
cd ~/zeroclaw-migration-bundle/backend
cargo install --path .

# 2. Zbuduj frontend
cd ~/zeroclaw-migration-bundle/frontend-web
npm install && npm run build

# 3. Skopiuj artefakty
mkdir -p ~/.zeroclaw/{web,workspace}
cp -r dist/* ~/.zeroclaw/web/
cp ~/zeroclaw-migration-bundle/config/config.toml ~/.zeroclaw/
cp ~/zeroclaw-migration-bundle/config/caddy-config.json ~/.caddy/Caddyfile

# 4. Uruchom Qdrant (vector DB)
cd ~/.zeroclaw
cat > docker-compose.yml <<'EOF'
services:
  qdrant:
    image: qdrant/qdrant:v1.12.0
    container_name: zeroclaw-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./qdrant_storage:/qdrant/storage
    restart: unless-stopped
EOF
docker compose up -d

# 5. Skonfiguruj API keys
nano ~/.zeroclaw/config.toml
# Zastąp placeholderowe klucze właściwymi wartościami

# 6. Uruchom ZeroClaw
zeroclaw daemon
```

---

## 📋 Szczegółowy przewodnik

Patrz **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** dla pełnych instrukcji wdrożenia w tym:

- Kompletna instalacja zależności
- Konfiguracja Docker i Qdrant
- Migracja stanu z istniejącej instalacji
- Konfiguracja systemd service
- Konfiguracja Caddy reverse proxy
- Skrypty weryfikacji health check
- Troubleshooting

---

## 🏗️ Architektura

### Backend (Rust)

```
zeroclaw (v0.1.7)
├── CLI Commands
│   ├── daemon          # Główny proces demona
│   ├── channel         # Zarządzanie kanałami
│   ├── quota           # Śledzenie zużycia API
│   └── benchmark       # Testy wydajnościowe
│
├── Channels
│   ├── Telegram        # Bot Telegram
│   ├── Discord         # Bot Discord
│   ├── Slack           # Slack app
│   ├── WebSocket       # Browser connections
│   └── CLI             # Terminal interface
│
├── Providers
│   ├── Z.AI            # Primary: GLM models
│   ├── OpenRouter      # Multi-provider routing
│   ├── NVIDIA NIM      # NVIDIA AI endpoints
│   ├── Mistral         # Mistral AI
│   └── Ollama          # Local models
│
├── Smart Routing
│   ├── Quota Tracker   # Automatyczne zarządzanie limitami
│   ├── State Machine   # Normal → Conserving → Critical
│   └── Benchmarks      # Optymalizacja wydajności
│
└── Memory
    ├── SQLite          # Persistent storage
    ├── Qdrant          # Vector search
    └── Embeddings      # Semantic search
```

### Frontend (React 19 + TypeScript)

```
zeroclaw-os-pwa
├── Pages
│   ├── Dashboard       # Główny panel
│   ├── Chat            # Interface czatu
│   ├── Channels        # Zarządzanie kanałami
│   ├── Quota           # Monitoring zużycia
│   └── Settings        # Konfiguracja
│
├── Components
│   ├── AgentGrid       # Siatka agentów
│   ├── FlowCanvas      # Edytor workflow
│   ├── ChatInterface   # Komponent czatu
│   └── Metrics         # Wykresy i statystyki
│
└── Stores (Zustand)
    ├── agentStore      # Stan agentów
    ├── chatStore       # Stan rozmów
    └── quotaStore      # Stan zużycia
```

---

## 🎯 Kluczowe funkcje

### Smart Routing
Automatyczny wybór modelu na podstawie:
- Aktualnego zużycia kwoty
- Typu zadania (kodowanie, analiza, creative)
- Benchmarków wydajności
- Kosztu tokena

### Multi-Provider
Jednolity interfejs dla wielu dostawców AI:
- **Z.AI:** GLM-4, GLM-4-Flash (domyślne)
- **OpenRouter:** Claude, GPT-4, Llama 3
- **NVIDIA:** Nemotron, Llama
- **Mistral:** Mistral, Mixtral
- **Ollama:** Lokalne modele

### Quota Tracking
- Automatyczne przełączanie na free models przy 80% zużycia
- Śledzenie tokenów per request
- Ostrzeżenia przed wyczerpaniem limitu
- Historyczne statystyki

### Channels
- **Telegram:** Pełna integracja z bota
- **Discord:** Slash commands
- **Slack:** Interactive messages
- **WebSocket:** Real-time browser
- **CLI:** Terminal interface

---

## 🔧 Konfiguracja

Główny plik konfiguracyjny: `~/.zeroclaw/config.toml`

```toml
# Domyślny provider i model
default_provider = "zai"
default_model = "glm-4-flash"

# Providers
[model_providers.zai]
base_url = "https://api.z.ai/api/coding/paas/v4"
api_key = "ZAI_API_KEY_ENV"

# Quota tracking
[quota_tracker]
enabled = true
threshold_percent = 80.0

# Telegram
[channels_config.telegram]
bot_token = "TELEGRAM_BOT_TOKEN"
```

**Ważne:** Zastąp wszystkie placeholderowe klucze właściwymi wartościami!

---

## 📊 Monitorowanie

### Status CLI

```bash
# Sprawdź zużycie quota
zeroclaw quota status

# Uruchom benchmark
zeroclaw benchmark run

# Sprawdź status kanałów
zeroclaw channel status

# Wyświetl logi
journalctl -u zeroclaw -f
```

### Web Dashboard

Otwórz przeglądarkę: `https://your-domain.com`

- Dashboard: Przegląd agentów i zadań
- Chat: Interfejs konwersacyjny
- Channels: Zarządzanie kanałami
- Quota: Szczegółowa analiza zużycia
- Settings: Konfiguracja systemu

---

## 🧪 Testowanie

### Backend

```bash
cd backend
cargo test                    # Unit tests
cargo test --test integration # Integration tests
cargo clippy                  # Linting
```

### Frontend

```bash
cd frontend-web
npm test                      # Unit tests
npm run test:e2e             # E2E with Playwright
npm run type-check           # TypeScript check
```

---

## 📚 Dokumentacja

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Pełny przewodnik wdrożenia
- **[backend/README.md](./backend/README.md)** - Dokumentacja backend
- **[backend/CLAUDE.md](./backend/CLAUDE.md)** - Kontekst dla AI assistant
- **[backend/docs/](./backend/docs/)** - Dokumentacja techniczna
  - MASTER_ARCHITECTURE.md - Architektura systemu
  - DEEP_AUDIT_AND_TESTS_2026.md - Audyt i testy
  - REFACTORING_PLAN.md - Plan refaktoryzacji

---

## 🤝 Współpraca

### Otwórz issue
Jeśli znalazłeś błąd lub masz sugestię, otwórz issue na GitHub.

### Pull Requests
1. Forknij repozytorium
2. Utwórz branch feature (`git checkout -b feature/amazing-feature`)
3. Zcommituj zmiany (`git commit -m 'feat: add amazing feature'`)
4. Pushnij branch (`git push origin feature/amazing-feature`)
5. Otwórz Pull Request

---

## 📄 Licencja

Dual-licensed under MIT OR Apache-2.0:

- [MIT License](./backend/LICENSE-MIT)
- [Apache License 2.0](./backend/LICENSE-APACHE)

---

## 🔗 Linki

- **GitHub:** https://github.com/zeroclaw-labs/zeroclaw
- **X (Twitter):** [@zeroclawlabs](https://x.com/zeroclawlabs)
- **Telegram:** [t.me/zeroclawlabs](https://t.me/zeroclawlabs)
- **WeChat Group:** [QR Code](https://zeroclawlabs.cn/group.jpg)
- **Donate:** [Buy Me a Coffee](https://buymeacoffee.com/argenistherose)

---

## 📝 Version Info

- **Backend:** v0.1.7
- **Frontend:** v1.0.0
- **Last Updated:** 2026-03-20
- **Rust Version:** 1.87+
- **Node Version:** 20.x

---

**Stworzono z ❤️ przez ZeroClaw Labs**
