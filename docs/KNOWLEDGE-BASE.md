# ZeroClaw - Kompletne Źródło Wiedzy

**Ostatnia aktualizacja**: 2026-03-13 17:45 UTC
**Wersja**: 1.1
**Status**: Produkcja z Memory Preservation

---

## 📑 Spis Treści

1. [Struktura Projektu](#struktura-projektu)
2. [Pliki Źródłowe](#pliki-źródłowe)
3. [Konfiguracja](#konfiguracja)
4. [Model Routing](#model-routing)
5. [Memory i Konwersacje](#memory-i-konwersacje)
6. [Testy Automatyczne](#testy-automatyczne)
7. [Dokumentacja](#dokumentacja)
8. [API i Dostawcy](#api-i-dostawcy)
9. [Skrypty i Narzędzia](#skrypty-i-narzędzia)
10. [Troubleshooting](#troubleshooting)
11. [Szybki Start](#szybki-start)

---

## 🏗️ Struktura Projektu

### Główna Lokalizacja Workspace
```
/home/ubuntu/
├── zeroclaw-migration-bundle/     # Repozytorium źródłowe
├── playwright-test/                # Testy automatyczne
├── .zeroclaw/                      # Konfiguracja runtime
├── telegram-bot-testing/           # Legacy testy
└── KNOWLEDGE-BASE.md               # Ten dokument
```

---

## 💻 Pliki Źródłowe

### Backend (Rust)
**Lokalizacja**: `/home/ubuntu/zeroclaw-migration-bundle/backend/`

**Kluczowe pliki**:
```
backend/
├── src/
│   ├── main.rs                     # Punkt startowy aplikacji
│   ├── providers/                  # Implementacje dostawców AI
│   │   ├── glm.rs                  # GLM Provider (Z.AI)
│   │   ├── mod.rs                  # Moduł providers
│   │   └── traits.rs               # Definicje trait Provider
│   ├── channels/                   # Kanały komunikacji
│   │   ├── telegram.rs             # Telegram bot
│   │   └── mod.rs
│   ├── config/                     # Konfiguracja
│   │   ├── schema.rs               # Schema TOML
│   │   └── mod.rs
│   └── agents/                     # System agentów
├── Cargo.toml                      # Zależności Rust
└── tests/                          # Testy jednostkowe
```

**Dokumentacja backend**:
- `/home/ubuntu/zeroclaw-migration-bundle/docs/` - Dokumentacja techniczna
- `/home/ubuntu/zeroclaw-migration-bundle/MIGRATION_GUIDE.md` - Przewodnik migracji

### Frontend (Web)
**Lokalizacja**: `/home/ubuntu/zeroclaw-migration-bundle/frontend-web/`

```
frontend-web/
├── src/                            # Źródła React/TypeScript
├── package.json                    # Zależności Node.js
└── public/                         # Zasoby statyczne
```

### Frontend Portal
**Lokalizacja**: `/home/ubuntu/zeroclaw-migration-bundle/frontend-portal/`

```
frontend-portal/
├── src/                            # Źródła portalu
└── package.json
```

---

## ⚙️ Konfiguracja

### Główny Plik Konfiguracyjny
**Ścieżka**: `/home/ubuntu/.zeroclaw/config.toml`

**Struktura**:
```toml
# Dostawca domyślny
default_provider = "custom:https://api.z.ai/api/coding/paas/v4"
api_key = "TWOJ_KLUCZ_API"
default_model = "glm-4.7"
default_temperature = 0.7

# Routing modeli (16 tras)
[[model_routes]]
hint = "premium"
provider = "custom:https://api.z.ai/api/coding/paas/v4"
model = "glm-4.7"

# ... więcej tras

# Dostawcy
[model_providers.openrouter]
name = "openrouter"
base_url = "https://openrouter.ai/api/v1"

[model_providers.nvidia]
name = "nvidia"
base_url = "https://integrate.api.nvidia.com/v1"

[model_providers.mistral]
name = "mistral"
base_url = "https://api.mistral.ai/v1"

[model_providers.ollama]
name = "ollama"
base_url = "http://localhost:11434"

# Kanały
[channels_config.telegram]
bot_token = "TELEGRAM_BOT_TOKEN"
allowed_users = ["Kamarndt"]

# Pamięć
[memory]
backend = "sqlite"
auto_save = true
```

### Zmienne Środowiskowe
**Ścieżka**: `/home/ubuntu/.zeroclaw/.env`

```bash
# Z.AI (GLM Models)
GLM_API_KEY=id.secret
ZAI_API_KEY=id.secret

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# NVIDIA NIM
NVIDIA_API_KEY=nvapi-...

# Mistral
MISTRAL_API_KEY=...
```

---

## 🔄 Model Routing

### Konfiguracja Tras
**Plik**: `/home/ubuntu/.zeroclaw/config.toml`

### Lista Wszystkich Tras (16)

| Hint | Provider | Model | Endpoint | Przeznaczenie |
|------|----------|-------|----------|---------------|
| `premium` | custom (ZAI) | glm-4.7 | coding | Wysoka jakość |
| `review` | custom (ZAI) | glm-4.7 | coding | Code review |
| `coding` | custom (ZAI) | glm-4.5 | coding | Generowanie kodu |
| `code` | custom (ZAI) | glm-4.5 | coding | Zadania kodu |
| `default` | custom (ZAI) | glm-4.5 | coding | Domyślne |
| `quick` | custom (ZAI) | glm-4.5 | coding | Szybkie |
| `vision` | custom (ZAI) | glm-4.5v | coding | Obrazy |
| `complex` | custom (ZAI) | glm-5 | standard | Skomplikowane |
| `deep` | custom (ZAI) | glm-5 | standard | Głęboka analiza |
| `architect` | custom (ZAI) | glm-5 | standard | Architektura |
| `nvidia` | nvidia | llama-3.3-70b | - | NVIDIA NIM |
| `mistral` | mistral | codestral-latest | - | Mistral |
| `openrouter` | openrouter | claude-sonnet-4 | - | OpenRouter |
| `local` | ollama | qwen2.5-coder:7b | - | Lokalne |
| `fast` | ollama | qwen2.5-coder:7b | - | Szybkie |
| `cheap` | ollama | qwen2.5-coder:7b | - | Tanie |

### Jak Używać Tras

**W Telegram (@karndt_bot)**:
```
premium: Co to jest 2+2?
complex: Wyjaśnij kwantówkę
coding: Napisz hello world
nvidia: Test NVIDIA
```

**Programatycznie**:
```javascript
// Użyj hint w prompt
hint:premium twoje pytanie
hint:complex złożone zadanie
```

---

## 🧠 Memory i Konwersacje

### Jak Działa Memory w ZeroClaw

ZeroClaw używa **semantic search** (wyszukiwanie semantyczne) do pobierania kontekstu konwersacji:

1. **Individualne wiadomości są zapisywane** w bazie SQLite (`brain.db`)
2. **Kontekst jest pobierany na podstawie podobieństwa** do aktualnej wiadomości
3. **Po restarcie**: historii runtime nie ma, ale memories są w bazie danych

### Konfiguracja Embeddings

```toml
[[embedding_routes]]
hint = "default"
provider = "openrouter"
model = "openai/text-embedding-3-small"
dimensions = 1536
```

**Status**: ✅ Skonfigurowane (od 2026-03-13 14:45)

### Baza Danych Memory

**Lokalizacja**: `~/.zeroclaw/workspace/memory/brain.db`

**Struktura**:
- `memories` - Główna tabela z wiadomościami
- `conversation_history` - ✅ **NOWA: Historia konwersacji zachowana**
- `memories_fts` - Full-text search index
- `embedding_cache` - Cache embeddingów
- `agent_tasks` - Zadania agentów

**Format klucza**:
```
telegram_Kamarndt_telegram_6776474378_69
```
Składnia: `{channel}_{username}_{message_id}`

---

### 💾 MEMORY PERSISTENCE (NOWE!)

**✅ ROZWIĄZANIE**: ZeroClaw teraz **zachowuje historię konwersacji** po restarcie!

**System automatycznego backup/restore:**
```bash
# Automatyczny restart z zachowaniem pamięci
bash ~/.zeroclaw/scripts/restart_with_memory.sh
```

**Co się dzieje:**
1. **PRZED restartem**: Backup do `memory_backups/memory_backup_TIMESTAMP.json`
2. **PO restarcie**: Restore z bazy danych + JSON cache
3. **Kontekst**: Przywracane do `conversation_history.json`

**Lokalizacje**:
- Backup: `~/.zeroclaw/workspace/memory_backups/`
- JSON Cache: `~/.zeroclaw/workspace/conversation_history.json`
- Skrypty: `~/.zeroclaw/scripts/backup_memory.sh`, `restore_memory.sh`

**Skills odpowiedzialne**:
- `memory-persistence` - Automatyczny system backup/restore
- `load-conversation-history` - Ładowanie historii dla kontekstu

---

### Monitoring Memory

### Monitoring Memory

```bash
# Sprawdź liczbę memories
python3 -c "
import sqlite3
conn = sqlite3.connect('~/.zeroclaw/workspace/memory/brain.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM memories')
print('Total memories:', cursor.fetchone()[0])
"

# Zobacz ostatnie wiadomości
python3 -c "
import sqlite3
conn = sqlite3.connect('~/.zeroclaw/workspace/memory/brain.db')
cursor = conn.cursor()
cursor.execute('SELECT key, content, created_at FROM memories WHERE key LIKE \"%Kamarndt%\" ORDER BY created_at DESC LIMIT 10')
for key, content, created in cursor.fetchall():
    print(f'{created}: {content[:60]}...')
"
```

---

## 🧪 Testy Automatyczne

### Lokalizacja Testów
**Główny katalog**: `/home/ubuntu/playwright-test/`

### Lista Skryptów Testowych

| Skrypt | Ścieżka | Przeznaczenie |
|--------|---------|---------------|
| Session Test | `session-test.js` | Główny test z sesją persistującą |
| Automated Verify | `automated-verify.js` | Weryfikacja automatyczna |
| Full Suite | `full-test-suite.js` | Pełna suita testów |
| Manual Test | `manual-test.js` | Test manualny |
| Route Test | `test-all-routes.js` | Test wszystkich tras |
| Auto Send | `auto-send.js` | Automatyczne wysyłanie |
| Monitor Routing | `monitor-routing.sh` | Monitor tras |
| Quick Test | `quick-test.sh` | Szybki test |

### Uruchamianie Testów

```bash
# Szybki test
cd /home/ubuntu/playwright-test
bash quick-test.sh

# Pełny test automatyczny
node session-test.js

# Monitorowanie tras
bash monitor-routing.sh

# Test wszystkich tras
node test-all-routes.js
```

### Pliki Wsparcia Testów

**Dokumentacja testów**:
- `/home/ubuntu/playwright-test/README.md` - Główna dokumentacja
- `/home/ubuntu/playwright-test/ALL-ROUTES-CONFIGURED.md` - Konfiguracja tras
- `/home/ubuntu/playwright-test/MODEL-ROUTING-TEST.md` - Test tras
- `/home/ubuntu/playwright-test/ZAI-CODING-SETUP.md` - Setup Z.AI

**Sesja Telegram**:
- `/home/ubuntu/playwright-test/telegram-session.json` - Zapisana sesja

**Zależności Node.js**:
- `/home/ubuntu/playwright-test/package.json`
- `/home/ubuntu/playwright-test/package-lock.json`

---

## 📚 Dokumentacja

### Główna Dokumentacja
**Lokalizacja**: `/home/ubuntu/zeroclaw-migration-bundle/docs/`

```
docs/
├── superpowers/                   # Dokumentacja Superpowers
│   ├── plans/                     # Plany implementacji
│   └── specs/                     # Specyfikacje
└── zeroclaw/                      # Dokumentacja ZeroClaw
```

### Kluczowe Dokumenty

| Dokument | Ścieżka | Opis |
|----------|---------|------|
| Migration Guide | `/home/ubuntu/zeroclaw-migration-bundle/MIGRATION_GUIDE.md` | Przewodnik migracji |
| Workspace Summary | `/home/ubuntu/WORKSPACE-COPY-SUMMARY.md` | Podsumowanie workspace |
| Test Documentation | `/home/ubuntu/playwright-test/README.md` | Dokumentacja testów |
| Routing Config | `/home/ubuntu/playwright-test/ALL-ROUTES-CONFIGURED.md` | Konfiguracja routing |
| Z.AI Setup | `/home/ubuntu/playwright-test/ZAI-CODING-SETUP.md` | Setup Z.AI Coding Plan |
| Knowledge Base | `/home/ubuntu/KNOWLEDGE-BASE.md` | Ten dokument |

### Dokumentacja GitHub

**Repozytorium**: https://github.com/kamilarndt/zeroclaw-migration-bundle

**Lokalne kopie**:
- `/home/ubuntu/zeroclaw-migration-bundle/.git/` - Historia Git
- `/home/ubuntu/zeroclaw-migration-bundle/.worktrees/` - Git worktrees

---

## 🔌 API i Dostawcy

### Dostawcy AI

#### 1. Z.AI (GLM)
**Typ**: Coding Plan
**Endpoint**: `https://api.z.ai/api/coding/paas/v4`
**Auth**: Bearer token
**Modele**: glm-4.5, glm-4.5v, glm-4.7, glm-5
**Klucz**: `ZAI_API_KEY` w `/home/ubuntu/.zeroclaw/.env`

**Dokumentacja**: `/home/ubuntu/playwright-test/ZAI-CODING-SETUP.md`

#### 2. OpenRouter
**Endpoint**: `https://openrouter.ai/api/v1`
**Auth**: Bearer token
**Modele**: Wiele (Claude, GPT-4, itp.)
**Klucz**: `OPENROUTER_API_KEY`

#### 3. NVIDIA NIM
**Endpoint**: `https://integrate.api.nvidia.com/v1`
**Auth**: Bearer token
**Modele**: meta/llama-3.3-70b-instruct
**Klucz**: `NVIDIA_API_KEY`

#### 4. Mistral
**Endpoint**: `https://api.mistral.ai/v1`
**Auth**: Bearer token
**Modele**: codestral-latest
**Klucz**: `MISTRAL_API_KEY`

#### 5. Ollama (Lokalny)
**Endpoint**: `http://localhost:11434`
**Auth**: Brak
**Modele**: qwen2.5-coder:7b, codellama:7b
**Status**: ✅ Aktywny

### Implementacja Providerów
**Kod źródłowy**: `/home/ubuntu/zeroclaw-migration-bundle/backend/src/providers/`

- `glm.rs` - Implementacja GLM Provider
- `mod.rs` - Eksport modułu
- `traits.rs` - Interfejs Provider

---

## 🛠️ Skrypty i Narzędzia

### Skrypty Zarządzania

#### 1. Memory Preservation (NOWE!)
**Ścieżka**: `~/.zeroclaw/scripts/`

| Skrypt | Opis |
|--------|------|
| `backup_memory.sh` | Zrzut pamięci PRZED restartem |
| `restore_memory.sh` | Przywracenie PO restarcie |
| `restart_with_memory.sh` | **Pełny restart z zachowaniem kontekstu** |

**Użycie**:
```bash
# Automatyczny restart z zachowaniem pamięci
bash ~/.zeroclaw/scripts/restart_with_memory.sh

# Ręczny backup
bash ~/.zeroclaw/scripts/backup_memory.sh

# Ręczne przywracanie
bash ~/.zeroclaw/scripts/restore_memory.sh
```

**Backup Location**: `~/.zeroclaw/workspace/memory_backups/`
- Ostatnie 10 backupów
- Automatyczne czyszczenie starych

#### 2. Monitor Routing
**Ścieżka**: `/home/ubuntu/playwright-test/monitor-routing.sh`
**Opis**: Monitoruje routing w czasie rzeczywistym

#### 3. Quick Test
**Ścieżka**: `/home/ubuntu/playwright-test/quick-test.sh`
**Opis**: Szybki test z sesją

### Narzędzia Deweloperskie

**Zarządzanie ZeroClaw**:
```bash
# Status
pgrep -a zeroclaw

# Restart
pkill -9 zeroclaw
source ~/.zeroclaw/.env
~/.cargo/bin/zeroclaw channel start &

# Logi
tail -f ~/.zeroclaw/logs/channel-new.log
```

**Zarządzanie Ollama**:
```bash
# Status
curl http://127.0.0.1:11434/api/tags

# List modele
ollama list

# Pobierz model
ollama pull qwen2.5-coder:7b
```

**Zarządzanie Testami**:
```bash
# Zależności
cd /home/ubuntu/playwright-test
npm install

# Uruchom test
node session-test.js
```

---

## 🔧 Troubleshooting

### Problemy z ZeroClaw

**ZeroClaw nie działa**:
```bash
# 1. Sprawdź status
pgrep -a zeroclaw

# 2. Sprawdź logi
tail -50 ~/.zeroclaw/logs/channel-new.log

# 3. Restart
pkill -9 zeroclaw
source ~/.zeroclaw/.env
~/.cargo/bin/zeroclaw channel start &
```

**Błędy API**:
```bash
# Sprawdź klucze
cat ~/.zeroclaw/.env

# Sprawdź konfigurację
cat ~/.zeroclaw/config.toml | grep -A 20 "model_routes"
```

### Problemy z Routing

**Trasa nie działa**:
1. Sprawdź logi: `tail -f ~/.zeroclaw/logs/channel-new.log`
2. Szukaj: `provider=` i `model=`
3. Upewnij się że hint jest poprawny

**Monitorowanie routing**:
```bash
bash /home/ubuntu/playwright-test/monitor-routing.sh
```

### Problemy z Telegram

**Bot nie odpowiada**:
1. Sprawdź czy ZeroClaw działa: `pgrep zeroclaw`
2. Sprawdź logi: `tail -50 ~/.zeroclaw/logs/channel-new.log`
3. Sprawdź uprawnienia: `cat ~/.zeroclaw/config.toml | grep -A 5 telegram`

**Reset sesji**:
```bash
rm /home/ubuntu/playwright-test/telegram-session.json
# Uruchom test ponownie
```

**Bot nie pamięta konwersacji po restarcie**:
- **Status**: ⚠️ **Ograniczenie architektury** - patrz sekcja [Memory i Konwersacje](#memory-i-konwersacje)
- **Powód**: ZeroClaw używa semantic search, nie chat history persistence
- **Rozwiązanie**: Embeddings skonfigurowane (2026-03-13) dla lepszego context retrieval
- **Workaround**: Używaj specyficzne tematy w wiadomościach dla lepszego semantic search

### Problemy z Ollama

**Ollama nie działa**:
```bash
# Sprawdź status
curl http://127.0.0.1:11434/api/tags

# Zrestartuj
pkill -9 ollama
ollama serve &
```

**Model nie dostępny**:
```bash
# Pobierz model
ollama pull qwen2.5-coder:7b

# Sprawdź listę
ollama list
```

---

## 🚀 Szybki Start

### Testowanie Bota Telegram

**1. Uruchom monitoring**:
```bash
bash /home/ubuntu/playwright-test/monitor-routing.sh
```

**2. Wyślij wiadomość testową do @karndt_bot**:
```
premium: What is 2+2?
```

**3. Obserwuj logi** - powinieneś widzieć:
```
provider=custom:https://api.z.ai/api/coding/paas/v4
model=glm-4.7
```

### Testowanie Wszystkich Tras

**Skrypt**: `/home/ubuntu/playwright-test/test-all-routes.js`

```bash
cd /home/ubuntu/playwright-test
node test-all-routes.js
```

### Pełny Test Automatyczny

**Skrypt**: `/home/ubuntu/playwright-test/session-test.js`

```bash
cd /home/ubuntu/playwright-test
node session-test.js
```

---

## 📊 Status Systemu

### Aktualna Konfiguracja

**ZeroClaw**: ✅ Running
- PID: Sprawdź `pgrep -a zeroclaw`
- Model: glm-4.7
- Provider: custom (ZAI Coding Plan)

**Ollama**: ✅ Running
- Endpoint: http://127.0.0.1:11434
- Model: qwen2.5-coder:7b

**Telegram Bot**: ✅ Active
- Bot: @karndt_bot
- Uprawnienia: Kamarndt

**Model Routing**: ✅ 16 tras skonfigurowanych

---

## 📝 Dziennik Zmian

### 2026-03-13
- ✅ Zainstalowano Ollama z qwen2.5-coder:7b
- ✅ Skonfigurowano 16 tras model routing
- ✅ Aktywowano Z.AI Coding Plan
- ✅ Skopiowano wszystkie pliki do /home/ubuntu/
- ✅ Utworzono Knowledge Base

---

## 🔗 Przydatne Linki

### Wewnętrzne
- [ZeroClaw Source](file:///home/ubuntu/zeroclaw-migration-bundle/)
- [Test Scripts](file:///home/ubuntu/playwright-test/)
- [Config](file:///home/ubuntu/.zeroclaw/config.toml)

### Zewnętrzne
- [ZeroClaw GitHub](https://github.com/zeroclaw-labs/zeroclaw)
- [Z.AI Documentation](https://docs.z.ai/devpack/tool/openclaw)
- [OpenClaw Documentation](https://docs.openclaw.ai/)
- [Ollama Documentation](https://ollama.com/)

---

## 📞 Wsparcie

### Logi
- ZeroClaw: `~/.zeroclaw/logs/channel-new.log`
- Ollama: `/tmp/ollama.log`

### Konfiguracja
- ZeroClaw: `~/.zeroclaw/config.toml`
- Środowisko: `~/.zeroclaw/.env`

### Testy
- Katalog testów: `/home/ubuntu/playwright-test/`
- Dokumentacja testów: `/home/ubuntu/playwright-test/README.md`

---

**Autor**: System
**Wersja**: 1.0
**Ostatnia aktualizacja**: 2026-03-13 13:40 UTC
**Status**: ✅ Aktualny
