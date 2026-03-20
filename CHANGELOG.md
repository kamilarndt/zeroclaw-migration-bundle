# Changelog - ZeroClaw OS Migration Bundle

Wszystkie znaczące zmiany w tym projekcie będą dokumentowane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
a ten projekt jest zgodny z [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planowane
- Integracja z Nowa.ai
- Obsługa głosowa (voice channels)
- Panel administracyjny v2
- Automatyczne backupy konfiguracji

## [2026-03-20] - Migration Bundle v1.0.0

### Dodano
- **README.md** - Główna dokumentacja pakietu migracyjnego
- **CHANGELOG.md** - Historia zmian
- **package.json** - Root package.json do zarządzania monorepo
- Aktualizacja **MIGRATION_GUIDE.md** - Data ostatniej aktualizacji

### Zaktualizowano
- Backend v0.1.7 - Smart routing, multi-provider, quota tracking
- Frontend v1.0.0 - React 19 + TypeScript PWA
- Dokumentacja techniczna w `backend/docs/`
- Przykładowe konfiguracje w `config/`

### Zawartość pakietu
```
backend/           - Rust backend z wszystkimi zależnościami
frontend-web/      - React 19 PWA interface
frontend-portal/   - Portal użytkownika
config/            - Przykładowe konfiguracje
docs/              - Dokumentacja techniczna
storage/           - Dane przechowywania
snapshots/         - Migawki systemu
```

## [2026-03-13] - Backend v0.1.7

### Dodano
- Smart routing z automatycznym wyborem modelu
- Multi-provider support (Z.AI, OpenRouter, NVIDIA, Mistral, Ollama)
- Quota tracking ze state machine (Normal → Conserving → Critical)
- Benchmark system do optymalizacji wydajności
- Chat persistence w SQLite
- Telegram bot integration
- WebSocket gateway dla browser connections
- CLI commands (quota, benchmark, channel, daemon)

### Zmieniono
- Refaktoryzacja architektury na workspace z crate'ami
- quota-tracker crate - niezależne śledzenie zużycia
- usage-logger crate - logowanie metryk
- robot-kit crate - sterowanie hardware

### Naprawiono
- Race condition w quota tracking
- Memory leak w WebSocket connections
- Chat history persistence

## [2026-03-10] - Frontend v1.0.0

### Dodano
- React 19 z TypeScript strict mode
- Vite 7.0 dla szybkiego developmentu
- Zustand dla state management
- ReactFlow dla workflow editor
- Recharts dla wykresów i metryk
- PWA capabilities z vite-plugin-pwa
- Playwright dla E2E tests
- Vitest dla unit tests

### Komponenty
- Dashboard - Główny panel systemu
- ChatInterface - Interfejs konwersacyjny
- AgentGrid - Siatka agentów
- FlowCanvas - Edytor workflow
- MetricsPanel - Wykresy zużycia i statystyki
- SettingsPanel - Konfiguracja systemu

## [2026-02-XX] - Wcześniejsze wersje

### v0.1.6
- Dodanie Matrix channel support
- Poprawa E2EE encryption
- Lark/Feishu channel integration

### v0.1.5
- Discord slash commands
- Slack interactive messages
- CLI TUI improvements

### v0.1.4
- Qdrant vector database integration
- Semantic search w pamięci
- Embeddings cache

### v0.1.3
- SQLite database dla pamięci
- Chat history persistence
- Memory hygiene system

### v0.1.2
- WebSocket gateway
- Initial web interface
- Real-time updates

### v0.1.1
- Telegram bot
- Basic CLI
- Single provider (Z.AI)

### v0.1.0
- Pierwsza publiczna wersja
- Podstawowy agent system
- CLI interface

---

## Kategoryzacja zmian

- **Dodano** - Nowe funkcje
- **Zmieniono** - Zmiany w istniejącej funkcjonalności
- **Usunięto** - Usunięte funkcje
- **Naprawiono** - Poprawki błędów
- **Zabezpieczono** - Poprawki bezpieczeństwa
- **Zaktualizowano** - Aktualizacje zależności

---

## Linki

- [GitHub Releases](https://github.com/zeroclaw-labs/zeroclaw/releases)
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- [backend/CHANGELOG.md](./backend/CHANGELOG.md)
