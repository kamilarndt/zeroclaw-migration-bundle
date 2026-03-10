# Changelog

All notable changes to ZeroClaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Process Group Management**: Implemented comprehensive process group (PGID) support for all shell command executions, enabling clean termination of entire process trees including child processes
- **Workspace Isolation**: Added `HandWorkspace` module providing isolated temporary directories (`/tmp/zeroclaw/hands/{hand_id}`) for each agent hand instance, preventing file conflicts between concurrent operations
- **Automatic Workspace Cleanup**: Implemented automatic cleanup of workspace directories when hands complete, ensuring no temporary files are left behind
- **CPU-Aware Resource Management**: Added `CpuMonitor` module with configurable idle threshold (0-100) for CPU-aware scheduling and resource management
- **CPU Idle Threshold Configuration**: Added configurable CPU idle threshold to determine when system has sufficient resources for background operations
- **Smart Scheduling**: Integrated CPU monitoring into memory hygiene system, waiting for idle periods before running maintenance operations
- **UFW Firewall Script**: Created comprehensive UFW (Uncomplicated Firewall) configuration script at `scripts/configure_ufw.sh` for secure deployments
- **Automated Firewall Setup**: Integrated UFW configuration into bootstrap process with automatic execution during installation (skippable via `SKIP_FIREWALL=1`)
- **LocalStorage Utility**: Implemented `localStore` utility for frontend persistence with `zeroclaw_` prefix for namespacing
- **IndexedDB Storage**: Implemented `idbStore` utility for large-scale frontend data persistence including messages and conversation history
- **State Synchronization**: Added initial state fetch hooks for consistent UI state across page reloads
- **A2A Stream Reconnection**: Enhanced A2A (Agent-to-Agent) stream hooks with automatic reconnection logic for resilient network communication

### Security
- **Legacy XOR cipher migration**: The `enc:` prefix (XOR cipher) is now deprecated. 
  Secrets using this format will be automatically migrated to `enc2:` (ChaCha20-Poly1305 AEAD)
  when decrypted via `decrypt_and_migrate()`. A `tracing::warn!` is emitted when legacy
  values are encountered. The XOR cipher will be removed in a future release.

### Added
- `SecretStore::decrypt_and_migrate()` — Decrypts secrets and returns a migrated `enc2:` 
  value if the input used the legacy `enc:` format
- `SecretStore::needs_migration()` — Check if a value uses the legacy `enc:` format
- `SecretStore::is_secure_encrypted()` — Check if a value uses the secure `enc2:` format
- **Telegram mention_only mode** — New config option `mention_only` for Telegram channel.
  When enabled, bot only responds to messages that @-mention the bot in group chats.
  Direct messages always work regardless of this setting. Default: `false`.

### Deprecated
- `enc:` prefix for encrypted secrets — Use `enc2:` (ChaCha20-Poly1305) instead.
  Legacy values are still decrypted for backward compatibility but should be migrated.

### Fixed
- **Process tree termination** — Fixed orphaned process issue by implementing process group (PGID) tracking and killing entire process trees on interruption
- **Workspace file conflicts** — Fixed concurrent operation file conflicts by implementing isolated workspace directories per hand instance
- **Resource exhaustion** — Fixed potential resource exhaustion during high load by implementing CPU-aware scheduling that waits for idle periods
- **Firewall security** — Added automated UFW firewall configuration with default-deny policy, rate limiting, and SSH preservation
- **Frontend state loss** — Fixed state loss across page reloads by implementing dual storage strategy (localStorage + IndexedDB)
- **Network resilience** — Fixed fragile network communication by adding automatic reconnection logic to A2A stream hooks

### Changed
- **Shell command execution** — All shell commands now execute in dedicated process groups for clean termination
- **Memory hygiene** — Memory hygiene operations now wait for CPU idle periods before running
- **Bootstrap process** — Bootstrap now includes automatic UFW firewall configuration step
- **Frontend persistence** — Migrated from ephemeral state to persistent dual storage (localStorage + IndexedDB)
- **Workspace architecture** — Each hand instance now operates in isolated workspace at `/tmp/zeroclaw/hands/{hand_id}`

### Fixed
- **Gemini thinking model support** — Responses from thinking models (e.g. `gemini-3-pro-preview`)
  are now handled correctly. The provider skips internal reasoning parts (`thought: true`) and
  signature parts (`thoughtSignature`), extracting only the final answer text. Falls back to
  thinking content when no non-thinking response is available.
- Updated default gateway port to `42617`.
- Removed all user-facing references to port `3000`.
- **Onboarding channel menu dispatch** now uses an enum-backed selector instead of hard-coded
  numeric match arms, preventing duplicated pattern arms and related `unreachable pattern`
  compiler warnings in `src/onboard/wizard.rs`.
- **OpenAI native tool spec parsing** now uses owned serializable/deserializable structs,
  fixing a compile-time type mismatch when validating tool schemas before API calls.

## [0.1.0] - 2026-02-13

### Added
- **Core Architecture**: Trait-based pluggable system for Provider, Channel, Observer, RuntimeAdapter, Tool
- **Provider**: OpenRouter implementation (access Claude, GPT-4, Llama, Gemini via single API)
- **Channels**: CLI channel with interactive and single-message modes
- **Observability**: NoopObserver (zero overhead), LogObserver (tracing), MultiObserver (fan-out)
- **Security**: Workspace sandboxing, command allowlisting, path traversal blocking, autonomy levels (ReadOnly/Supervised/Full), rate limiting
- **Tools**: Shell (sandboxed), FileRead (path-checked), FileWrite (path-checked)
- **Memory (Brain)**: SQLite persistent backend (searchable, survives restarts), Markdown backend (plain files, human-readable)
- **Heartbeat Engine**: Periodic task execution from HEARTBEAT.md
- **Runtime**: Native adapter for Mac/Linux/Raspberry Pi
- **Config**: TOML-based configuration with sensible defaults
- **Onboarding**: Interactive CLI wizard with workspace scaffolding
- **CLI Commands**: agent, gateway, status, cron, channel, tools, onboard
- **CI/CD**: GitHub Actions with cross-platform builds (Linux, macOS Intel/ARM, Windows)
- **Tests**: 159 inline tests covering all modules and edge cases
- **Binary**: 3.1MB optimized release build (includes bundled SQLite)

### Security
- Path traversal attack prevention
- Command injection blocking
- Workspace escape prevention
- Forbidden system path protection (`/etc`, `/root`, `~/.ssh`)

[0.1.0]: https://github.com/theonlyhennygod/zeroclaw/releases/tag/v0.1.0
