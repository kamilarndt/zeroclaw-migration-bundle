# ZeroClaw - Pełne Uprawnienia Programistyczne

**Data**: 2026-03-13 12:45 UTC
**Status**: ✅ Aktywny
**Poziom**: Full Autonomy

---

## ✅ Konfiguracja Pełnych Uprawnień

ZeroClaw został skonfigurowany z **pełnymi mocami programistycznymi**:

### 🔓 Autonomia

```toml
[autonomy]
level = "full"                    # Pełen autonom
workspace_only = false            # Dostęp do całego systemu
allowed_commands = ["*"]          # Wszystkie komendy dozwolone
forbidden_paths = []              # Brak zabronionych ścieżek
allowed_roots = ["/"]             # Dostęp do całego systemu plików
max_actions_per_hour = 10000      # 10,000 akcji/godz
auto_approve = ["*"]              # Auto-akceptacja wszystkiego
always_ask = []                   # Bez pytania o zgodę
```

### 🛡️ Bezpieczeństwo

```toml
[security.sandbox]
backend = "none"                  # Bez sandboxowania

[security.resources]
max_memory_mb = 16384             # 16 GB RAM
max_cpu_time_seconds = 600        # 10 min na operację
max_subprocesses = 200            # 200 procesów równoległych
```

### 🤖 Agent

```toml
[agent]
max_tool_iterations = 200         # 200 iteracji narzędzi
max_context_tokens = 200000       # 200K tokenów kontekstu
parallel_tools = true             # Równoległe narzędzia
auto_spawn = true                 # Auto-spawn agentów
max_active_hands = 20             # 20 aktywnych "rąk"
```

### 🌐 Sieć

```toml
[http_request]
enabled = true
allowed_domains = ["*"]           # Wszystkie domeny
max_response_size = 50000000      # 50 MB

[web_fetch]
enabled = true
allowed_domains = ["*"]
max_response_size = 10000000      # 10 MB

[web_search]
enabled = true
provider = "duckduckgo"
max_results = 20
```

### 🧩 Skills

**Załadowane 23 skills**:
- random-contributor
- generate-asset-price-chart
- d3js-data-visualization
- news-aggregation
- anonymous-file-upload
- nostr-logging-system
- generate-qr-code-natively
- csv-data-summarizer
- changelog-generator
- city-tourism-website-builder
- using-telegram-bot
- browser-automation-agent
- ip-lookup
- pdf-manipulation
- web-search-api
- using-web-scraping
- using-youtube-download
- ... i więcej

---

## 🚀 Możliwości

### Shell i System
- ✅ Wszystkie komendy UNIX/Linux
- ✅ Dostęp do całego systemu plików (`/`)
- ✅ Edycja plików w dowolnej lokalizacji
- ✅ Instalacja pakietów (npm, cargo, pip, itp.)
- ✅ Zarządzanie procesami
- ✅ Docker i kontenery

### Programowanie
- ✅ Edycja kodu w dowolnym języku
- ✅ Uruchamianie testów
- ✅ Kompilacja i build
- ✅ Git operations (commit, push, pull, itp.)
- ✅ Operacje na repozytoriach

### Sieć
- ✅ HTTP/HTTPS requests
- ✅ Web scraping
- ✅ API calls
- ✅ Pobieranie plików
- ✅ Web search

### Multimodalne
- ✅ Przetwarzanie obrazów
- ✅ Generowanie kodu
- ✅ Analiza danych
- ✅ Automatyzacja

---

## 📋 Konfiguracja

### Główny Plik
**Ścieżka**: `~/.zeroclaw/config.toml`

### Kluczowe Sekcje

1. **[autonomy]** - Pełne uprawnienia
2. **[security]** - Bez ograniczeń
3. **[agent]** - Maksymalne limity
4. **[http_request]** - Pełny dostęp sieciowy
5. **[web_fetch]** - Pełny dostęp web
6. **[web_search]** - Wyszukiwanie włączone
7. **[skills]** - Open skills włączone

---

## 🎯 Przykłady Użycia

### Przez Telegram (@karndt_bot)

```bash
# Systemowe
ls -la /home/ubuntu/
ps aux | grep zeroclaw

# Programistyczne
git status
npm install
cargo build

# Zaawansowane
docker ps
kubectl get pods

# Dane
cat ~/playwright-test/package.json
grep "model" ~/.zeroclaw/config.toml
```

### Przez CLI
```bash
# Interaktywny tryb
~/.cargo/bin/zeroclaw agent

# Zadań z powłoki
echo "ls -la /tmp/" | ~/.cargo/bin/zeroclaw agent
```

---

## ⚙️ Limity

| Zasób | Limit |
|-------|-------|
| Akcje/godzina | 10,000 |
| Koszt/dzień | $1000 |
| Pamięć | 16 GB |
| CPU | 10 min/operacja |
| Procesy | 200 równolegle |
| Iteracje | 200 |
| Kontekst | 200K tokenów |
| Ręce agentów | 20 aktywnych |

---

## 📊 Status

```
✅ ZeroClaw Running (PID: 836)
✅ Full Autonomy Level
✅ All Commands Allowed
✅ Full File System Access (/)
✅ No Sandbox Restrictions
✅ Open Skills Enabled (23 skills)
✅ Web Access Full
✅ 16 Model Routes Active
```

---

## 🔧 Zarządzanie

### Status
```bash
pgrep -a zeroclaw
```

### Restart
```bash
pkill -9 zeroclaw
source ~/.zeroclaw/.env
~/.cargo/bin/zeroclaw channel start &
```

### Logi
```bash
tail -f ~/.zeroclaw/logs/channel-new.log
```

### Konfiguracja
```bash
cat ~/.zeroclaw/config.toml
```

---

## 📝 Wskazówki

1. **Pełna autonomia** - ZeroClaw może wykonywać dowolne operacje
2. **Brak limitów** - Maksymalne limity ustawione
3. **Cały system** - Dostęp do `/` i wszystkich komend
4. **Auto-akceptacja** - Wszystko zatwierdzone automatycznie
5. **Sieć pełna** - Wszystkie domeny i protokoły dozwolone

---

## ⚠️ Ostrzeżenia

- **Pełne uprawnienia** = **Pełna odpowiedzialność**
- **Auto-akceptacja** = **Brak pytań o zgodę**
- **Dostęp do /** = **Możliwość modyfikacji systemu**
- **Wszystkie komendy** = **W tym rm, dd, itp.**

**Używaj ostrożnie i rozważnie!**

---

**Data konfiguracji**: 2026-03-13 12:45 UTC
**Poziom**: Full Programming Powers
**Status**: ✅ Aktywny i gotowy do pracy
