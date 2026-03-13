# 📚 ZeroClaw - Indeks Dokumentacji

**Pełne źródło wiedzy o systemie ZeroClaw**

---

## 🎯 Szybki Start

**📖 Główna Knowledge Base**: [`KNOWLEDGE-BASE.md`](./KNOWLEDGE-BASE.md)
**⚡ Quick Reference**: [`QUICK-REFERENCE.md`](./QUICK-REFERENCE.md)

---

## 📂 Struktura Dokumentacji

### 1. Główne Dokumenty
| Dokument | Opis | Dla kogo |
|----------|------|----------|
| [`KNOWLEDGE-BASE.md`](./KNOWLEDGE-BASE.md) | Kompletna baza wiedzy | Wszyscy |
| [`QUICK-REFERENCE.md`](./QUICK-REFERENCE.md) | Szybki przewodnik | Użytkownicy |
| [`FULL-POWERS-CONFIG.md`](./FULL-POWERS-CONFIG.md) | Pełne uprawnienia | Admini |
| [`ENHANCED-CAPABILITIES.md`](./ENHANCED-CAPABILITIES.md) | Rozszerzone możliwości (500 iteracji, browser) | Deweloperzy |
| [`WORKSPACE-COPY-SUMMARY.md`](./WORKSPACE-COPY-SUMMARY.md) | Podsumowanie workspace | Deweloperzy |
| [`MEMORY-PERSISTENCE.md`](./MEMORY-PERSISTENCE.md) | **NOWE: System zachowywania pamięci** | Wszyscy |
| [`INDEX.md`](./INDEX.md) | Ten dokument | Wszyscy |

### 2. Pliki Źródłowe
| Zasób | Ścieżka | Opis |
|-------|---------|------|
| **Backend** | `/home/ubuntu/zeroclaw-migration-bundle/backend/` | Kod Rust |
| **Frontend** | `/home/ubuntu/zeroclaw-migration-bundle/frontend-web/` | React/TS |
| **Portal** | `/home/ubuntu/zeroclaw-migration-bundle/frontend-portal/` | Portal |
| **Dokumentacja** | `/home/ubuntu/zeroclaw-migration-bundle/docs/` | Dokumenty techniczne |

### 3. Testy Automatyczne
| Skrypt | Ścieżka | Opis |
|--------|---------|------|
| Session Test | `/home/ubuntu/playwright-test/session-test.js` | Główny test |
| Monitor Routing | `/home/ubuntu/playwright-test/monitor-routing.sh` | Monitor tras |
| Route Test | `/home/ubuntu/playwright-test/test-all-routes.js` | Test tras |
| Quick Test | `/home/ubuntu/playwright-test/quick-test.sh` | Szybki test |

### 4. Memory Persistence (NOWE!)
| Skrypt | Ścieżka | Opis |
|--------|---------|------|
| Backup Memory | `~/.zeroclaw/scripts/backup_memory.sh` | Backup PRZED restartem |
| Restore Memory | `~/.zeroclaw/scripts/restore_memory.sh` | Restore PO restarcie |
| Restart with Memory | `~/.zeroclaw/scripts/restart_with_memory.sh` | **Pełny restart z zachowaniem kontekstu** |
| Persist History | `~/.zeroclaw/scripts/persist_history.py` | Python script zarządzający historią |
| Backup Location | `~/.zeroclaw/workspace/memory_backups/` | Kopia zapasowa |

### 4. Dokumentacja Testów
| Dokument | Ścieżka |
|---------|---------|
| Test README | `/home/ubuntu/playwright-test/README.md` |
| Routing Config | `/home/ubuntu/playwright-test/ALL-ROUTES-CONFIGURED.md` |
| Z.AI Setup | `/home/ubuntu/playwright-test/ZAI-CODING-SETUP.md` |
| Routing Test | `/home/ubuntu/playwright-test/MODEL-ROUTING-TEST.md` |

### 5. Konfiguracja
| Plik | Ścieżka | Opis |
|------|---------|------|
| Config TOML | `~/.zeroclaw/config.toml` | Główna konfiguracja |
| Environment | `~/.zeroclaw/.env` | API keys |
| Logi | `~/.zeroclaw/logs/channel-new.log` | Logi runtime |

---

## 🔍 Tematy

### Model Routing
📖 **Pełna dokumentacja**: [`KNOWLEDGE-BASE.md#model-routing`](./KNOWLEDGE-BASE.md#-model-routing)

**16 skonfigurowanych tras**:
- Z.AI Coding Plan (glm-4.5, glm-4.5v, glm-4.7, glm-5)
- NVIDIA (llama-3.3-70b)
- Mistral (codestral)
- OpenRouter (claude-sonnet-4)
- Ollama (qwen2.5-coder:7b)

### API i Dostawcy
📖 **Pełna dokumentacja**: [`KNOWLEDGE-BASE.md#api-i-dostawcy`](./KNOWLEDGE-BASE.md#-api-i-dostawcy)

**Dostawcy**:
1. Z.AI (Coding Plan) - `https://api.z.ai/api/coding/paas/v4`
2. OpenRouter - `https://openrouter.ai/api/v1`
3. NVIDIA NIM - `https://integrate.api.nvidia.com/v1`
4. Mistral - `https://api.mistral.ai/v1`
5. Ollama (lokalny) - `http://localhost:11434`

### Testy Automatyczne
📖 **Pełna dokumentacja**: [`KNOWLEDGE-BASE.md#testy-automatyczne`](./KNOWLEDGE-BASE.md#-testy-automatyczne)

**Dostępne skrypty**:
- `session-test.js` - Test z sesją persistującą
- `automated-verify.js` - Weryfikacja automatyczna
- `monitor-routing.sh` - Monitor tras
- `test-all-routes.js` - Test wszystkich tras

### Troubleshooting
📖 **Pełna dokumentacja**: [`KNOWLEDGE-BASE.md#troubleshooting`](./KNOWLEDGE-BASE.md#-troubleshooting)

**Typowe problemy**:
- ZeroClaw nie działa
- Routing nie funkcjonuje
- Bot Telegram nie odpowiada
- Ollama niedostępny

---

## 🎓 Przewodniki Szybkie

### Dla Początkujących
1. 📖 Przeczytaj [`QUICK-REFERENCE.md`](./QUICK-REFERENCE.md)
2. 🧪 Uruchom `bash /home/ubuntu/playwright-test/quick-test.sh`
3. 💬 Wyślij wiadomość do @karndt_bot

### Dla Deweloperów
1. 📖 Przeczytaj [`KNOWLEDGE-BASE.md`](./KNOWLEDGE-BASE.md)
2. 💻 Zobacz źródła w `/home/ubuntu/zeroclaw-migration-bundle/backend/`
3. 🧪 Uruchom testy w `/home/ubuntu/playwright-test/`

### Dla Administratorów
1. 📖 Przeczytaj [`KNOWLEDGE-BASE.md`](./KNOWLEDGE-BASE.md)
2. ⚙️ Sprawdź `~/.zeroclaw/config.toml`
3. 📊 Monitoruj `tail -f ~/.zeroclaw/logs/channel-new.log`

---

## 📋 Checklist

### Instalacja i Konfiguracja
- [x] ZeroClaw zainstalowany
- [x] Z.AI Coding Plan aktywny
- [x] 16 tras skonfigurowanych
- [x] Ollama z qwen2.5-coder:7b
- [x] Telegram bot @karndt_bot aktywny
- [x] Testy automatyczne gotowe
- [x] Dokumentacja kompletna

### Testowanie
- [ ] Test each model route via Telegram
- [ ] Verify all providers respond correctly
- [ ] Check log files for errors
- [ ] Validate Ollama local routes

---

## 📞 Zasoby

### Wsparcie
- **Logi**: `~/.zeroclaw/logs/channel-new.log`
- **Config**: `~/.zeroclaw/config.toml`
- **Dokumentacja**: `/home/ubuntu/KNOWLEDGE-BASE.md`

### Narzędzia
- **Test Runner**: `/home/ubuntu/playwright-test/`
- **Source Code**: `/home/ubuntu/zeroclaw-migration-bundle/`
- **Scripts**: `/home/ubuntu/*.sh`

---

## 🔄 Aktualizacje

**Ostatnia aktualizacja**: 2026-03-13 17:45 UTC

**Wersja dokumentacji**: 1.1

**Nowe w wersji 1.1**:
- ✅ Memory Persistence - zachowanie kontekstu po restarcie
- ✅ System automatycznego backup/restore
- ✅ 26 skills (w tym memory-persistence, load-conversation-history)
- ✅ Skrypty do zarządzania pamięcią
- ✅ Qdrant vector database skonfigurowany

**Wersja dokumentacji**: 1.0

**Status**: ✅ Aktualny i kompletny

---

**📖 Pełna dokumentacja**: [`KNOWLEDGE-BASE.md`](./KNOWLEDGE-BASE.md)
**⚡ Szybki start**: [`QUICK-REFERENCE.md`](./QUICK-REFERENCE.md)
