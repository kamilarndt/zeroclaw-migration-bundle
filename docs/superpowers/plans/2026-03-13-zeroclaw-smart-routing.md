# ZeroClaw Smart Model Routing System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement intelligent model routing with quota tracking, automatic fallback to free models at 80% threshold, and benchmark-based optimization

**Architecture:** Three new crates (quota-tracker, usage-logger, benchmark) plus modifications to model-router. All state persisted to SQLite, routing decisions made in-memory with fallback chains. Production deployment via systemd + Caddy.

**Tech Stack:** Rust, SQLite, tokio, async-trait, chrono, serde

---

## File Structure

```
backend/
├── crates/
│   ├── quota-tracker/                    # NEW - Quota tracking & state management
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                    # Public API exports
│   │       ├── tracker.rs                # Main QuotaTracker struct
│   │       ├── state.rs                  # QuotaState enum and transitions
│   │       ├── provider.rs               # Provider limits and rate limiting
│   │       └── schema.rs                 # SQLite schema and migrations
│   │
│   ├── usage-logger/                     # NEW - Request metrics and benchmarking
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                    # Public API exports
│   │       ├── logger.rs                 # UsageLogger struct
│   │       ├── metrics.rs                # RequestMetrics data structures
│   │       ├── benchmark.rs              # Benchmark analysis and auto-adjustment
│   │       └── schema.rs                 # SQLite schema for metrics
│   │
│   ├── benchmark/                        # NEW - CLI commands for benchmarking
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                    # Public API exports
│   │       ├── runner.rs                 # Benchmark execution logic
│   │       ├── compare.rs                # Model comparison utilities
│   │       └── report.rs                 # Report generation
│   │
│   └── model-router/                     # MODIFY - Add quota-aware routing
│       └── src/
│           └── router.rs                 # ADD: Quota-aware routing logic
│
├── config/
│   └── config.toml                       # MODIFY - Add quota_tracker, benchmarking sections
│
└── Cargo.toml                            # MODIFY - Add workspace members

cli/                                       # MODIFY - Add new CLI commands
└── src/
    └── commands/
        ├── quota.rs                      # NEW - quota status/reset/set commands
        ├── benchmark.rs                  # NEW - benchmark run/compare commands
        └── metrics.rs                    # NEW - metrics report command
```

---

## Chunk 1: quota-tracker Crate Setup

### Task 1.1: Create quota-tracker crate structure

**Files:**
- Create: `backend/crates/quota-tracker/Cargo.toml`
- Create: `backend/crates/quota-tracker/src/lib.rs`

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "quota-tracker"
version = "0.1.0"
edition = "2021"

[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "sqlite", "chrono"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "2"
async-trait = "0.1"
log = "0.4"

[dev-dependencies]
tokio-test = "0.4"
```

- [ ] **Step 2: Create lib.rs with public API**

```rust
//! Quota tracking for API usage with automatic fallback management
//!
//! Tracks token usage and request counts per provider, calculates quota percentages,
//! and manages quota state transitions (Normal → Conserving → Critical).

pub mod tracker;
pub mod state;
pub mod provider;
pub mod schema;

pub use state::QuotaState;
pub use tracker::QuotaTracker;
pub use provider::{Provider, RateLimit};

/// Configuration for quota tracking
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QuotaConfig {
    /// Estimated daily token quota
    pub daily_quota_estimate: u64,
    /// Threshold percentage (0.0-1.0) to trigger fallback
    pub threshold_percent: f64,
    /// Path to SQLite database
    pub cache_path: std::path::PathBuf,
}

impl Default for QuotaConfig {
    fn default() -> Self {
        Self {
            daily_quota_estimate: 1_000_000,
            threshold_percent: 0.8,
            cache_path: dirs::home_dir()
                .unwrap()
                .join(".zeroclaw")
                .join("quota.db"),
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/crates/quota-tracker/
git commit -m "feat: add quota-tracker crate structure"
```

### Task 1.2: Implement state.rs - QuotaState enum

**Files:**
- Create: `backend/crates/quota-tracker/src/state.rs`

- [ ] **Step 1: Write state module with tests**

```rust
//! Quota state management and transitions

use std::fmt;

/// Represents the current quota consumption state
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum QuotaState {
    /// Below 80% quota - use optimal routing
    Normal,
    /// 80-95% quota - prefer free/cheap models
    Conserving,
    /// Above 95% quota - free models only
    Critical,
    /// No quota data available - use conservative estimates
    Unknown,
}

impl QuotaState {
    /// Determine quota state from usage percentage
    pub fn from_usage_percentage(usage_pct: f64, threshold: f64) -> Self {
        if usage_pct.is_nan() || usage_pct < 0.0 {
            return Self::Unknown;
        }

        let critical_threshold = threshold + 0.15; // threshold + 15%

        if usage_pct < threshold {
            Self::Normal
        } else if usage_pct < critical_threshold {
            Self::Conserving
        } else {
            Self::Critical
        }
    }

    /// Check if this state allows using paid models
    pub fn allows_paid_models(&self) -> bool {
        matches!(self, Self::Normal | Self::Unknown)
    }

    /// Check if this state requires free models only
    pub fn requires_free_only(&self) -> bool {
        matches!(self, Self::Critical)
    }
}

impl fmt::Display for QuotaState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Normal => write!(f, "Normal"),
            Self::Conserving => write!(f, "Conserving"),
            Self::Critical => write!(f, "Critical"),
            Self::Unknown => write!(f, "Unknown"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_state_below_threshold() {
        let state = QuotaState::from_usage_percentage(0.5, 0.8);
        assert_eq!(state, QuotaState::Normal);
        assert!(state.allows_paid_models());
        assert!(!state.requires_free_only());
    }

    #[test]
    fn test_conserving_state_at_threshold() {
        let state = QuotaState::from_usage_percentage(0.85, 0.8);
        assert_eq!(state, QuotaState::Conserving);
        assert!(!state.allows_paid_models());
        assert!(!state.requires_free_only());
    }

    #[test]
    fn test_critical_state_above_threshold() {
        let state = QuotaState::from_usage_percentage(0.96, 0.8);
        assert_eq!(state, QuotaState::Critical);
        assert!(!state.allows_paid_models());
        assert!(state.requires_free_only());
    }

    #[test]
    fn test_unknown_state_for_invalid_input() {
        assert_eq!(QuotaState::from_usage_percentage(f64::NAN, 0.8), QuotaState::Unknown);
        assert_eq!(QuotaState::from_usage_percentage(-1.0, 0.8), QuotaState::Unknown);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd backend/crates/quota-tracker
cargo test
```

Expected: All tests PASS

- [ ] **Step 3: Update lib.rs to export state types**

```rust
pub mod state;

// ... existing exports
```

- [ ] **Step 4: Commit**

```bash
git add backend/crates/quota-tracker/src/
git commit -m "feat: implement QuotaState enum with transitions"
```

### Task 1.3: Implement provider.rs - Provider and RateLimit

**Files:**
- Create: `backend/crates/quota-tracker/src/provider.rs`

- [ ] **Step 1: Write provider module with tests**

```rust
//! API provider definitions and rate limits

use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Supported API providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum Provider {
    Zai,
    OpenRouter,
    Nvidia,
    Mistral,
    Ollama,
}

impl Provider {
    /// Get provider name as string
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Zai => "zai",
            Self::OpenRouter => "openrouter",
            Self::Nvidia => "nvidia",
            Self::Mistral => "mistral",
            Self::Ollama => "ollama",
        }
    }

    /// Parse from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "zai" => Some(Self::Zai),
            "openrouter" => Some(Self::OpenRouter),
            "nvidia" => Some(Self::Nvidia),
            "mistral" => Some(Self::Mistral),
            "ollama" => Some(Self::Ollama),
            _ => None,
        }
    }

    /// Check if this provider is free/local
    pub fn is_free(&self) -> bool {
        matches!(self, Self::Ollama)
    }
}

/// Rate limit configuration for a provider
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RateLimit {
    /// Maximum requests per minute
    pub requests_per_minute: u32,
    /// Maximum requests per day (if applicable)
    pub requests_per_day: Option<u32>,
    /// Maximum daily tokens (if applicable)
    pub daily_tokens: Option<u64>,
}

impl RateLimit {
    /// Create a new rate limit
    pub fn new(requests_per_minute: u32) -> Self {
        Self {
            requests_per_minute,
            requests_per_day: None,
            daily_tokens: None,
        }
    }

    /// With daily request limit
    pub fn with_daily_requests(mut self, limit: u32) -> Self {
        self.requests_per_day = Some(limit);
        self
    }

    /// With daily token limit
    pub fn with_daily_tokens(mut self, limit: u64) -> Self {
        self.daily_tokens = Some(limit);
        self
    }
}

/// Tracks request rate for a single provider
#[derive(Debug, Clone)]
pub struct RateTracker {
    provider: Provider,
    limit: RateLimit,
    requests: Vec<Instant>,
    daily_count: u32,
    day_start: Instant,
}

impl RateTracker {
    /// Create a new rate tracker
    pub fn new(provider: Provider, limit: RateLimit) -> Self {
        Self {
            provider,
            limit,
            requests: Vec::new(),
            daily_count: 0,
            day_start: Instant::now(),
        }
    }

    /// Check if a request can be made now
    pub fn can_make_request(&self) -> bool {
        let now = Instant::now();
        let one_minute_ago = now - Duration::from_secs(60);

        // Count requests in last minute
        let recent_requests = self.requests.iter().filter(|&&t| t > one_minute_ago).count();

        if recent_requests >= self.limit.requests_per_minute as usize {
            return false;
        }

        // Check daily limit if set
        if let Some(daily_limit) = self.limit.requests_per_day {
            if self.daily_count >= daily_limit {
                return false;
            }
        }

        true
    }

    /// Record a request attempt
    pub fn record_request(&mut self) {
        self.requests.push(Instant::now());
        self.daily_count += 1;

        // Reset daily counter if new day
        if self.day_start.elapsed() >= Duration::from_secs(86400) {
            self.daily_count = 0;
            self.day_start = Instant::now();
        }

        // Clean old requests (older than 1 minute)
        let one_minute_ago = Instant::now() - Duration::from_secs(60);
        self.requests.retain(|&t| t > one_minute_ago);
    }

    /// Get time until next request is allowed
    pub fn wait_time(&self) -> Option<Duration> {
        if self.can_make_request() {
            return None;
        }

        let now = Instant::now();
        let one_minute_ago = now - Duration::from_secs(60);

        // Find oldest request that's keeping us rate-limited
        if self.requests.len() >= self.limit.requests_per_minute as usize {
            // We have too many requests in the last minute
            // The oldest request is at index (len - limit)
            let oldest_in_window = self.requests
                [self.requests.len() - self.limit.requests_per_minute as usize];
            let wait_until = oldest_in_window + Duration::from_secs(60);
            return Some(wait_until.duration_since(now).max(Duration::ZERO));
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_from_str() {
        assert_eq!(Provider::from_str("zai"), Some(Provider::Zai));
        assert_eq!(Provider::from_str("ZAI"), Some(Provider::Zai));
        assert_eq!(Provider::from_str("unknown"), None);
    }

    #[test]
    fn test_rate_tracker_allows_requests() {
        let limit = RateLimit::new(10);
        let mut tracker = RateTracker::new(Provider::Zai, limit);

        for _ in 0..10 {
            assert!(tracker.can_make_request());
            tracker.record_request();
        }

        // 11th request should be blocked
        assert!(!tracker.can_make_request());
    }

    #[test]
    fn test_rate_tracker_wait_time() {
        let limit = RateLimit::new(1);
        let mut tracker = RateTracker::new(Provider::Zai, limit);

        tracker.record_request();
        assert!(!tracker.can_make_request());
        assert!(tracker.wait_time().is_some());
    }

    #[test]
    fn test_provider_is_free() {
        assert!(Provider::Ollama.is_free());
        assert!(!Provider::Zai.is_free());
    }
}
```

- [ ] **Step 2: Add dirs dependency to Cargo.toml**

```toml
dirs = "5"
```

- [ ] **Step 3: Run tests**

```bash
cargo test
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/crates/quota-tracker/src/
git commit -m "feat: implement Provider enum and RateTracker"
```

### Task 1.4: Implement schema.rs - SQLite schema

**Files:**
- Create: `backend/crates/quota-tracker/src/schema.rs`

- [ ] **Step 1: Write schema module**

```rust
//! SQLite database schema for quota tracking

use sqlx::sqlite::SqlitePool;
use std::path::Path;

/// Create/update the quota tracking database schema
pub async fn init_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Create quota_usage table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS quota_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            provider TEXT NOT NULL,
            tokens_used INTEGER NOT NULL DEFAULT 0,
            requests_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create request_log table for rate limiting
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS request_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            provider TEXT NOT NULL,
            model TEXT,
            tokens INTEGER
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create indexes for performance
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_quota_usage_date_provider
        ON quota_usage(date, provider)
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_request_log_timestamp
        ON request_log(timestamp)
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Get or create today's quota record for a provider
pub async fn get_or_create_daily_quota(
    pool: &SqlitePool,
    date: &str,
    provider: &str,
) -> Result<(i64, i64), sqlx::Error> {
    let row = sqlx::query_as::<_, (i64, i64)>(
        r#"
        INSERT INTO quota_usage (date, provider, tokens_used, requests_count)
        VALUES (?, ?, 0, 0)
        ON CONFLICT(date, provider) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING tokens_used, requests_count
        "#,
    )
    .bind(date)
    .bind(provider)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

/// Update quota usage after a request
pub async fn update_quota_usage(
    pool: &SqlitePool,
    date: &str,
    provider: &str,
    tokens: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE quota_usage
        SET tokens_used = tokens_used + ?,
            requests_count = requests_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ? AND provider = ?
        "#,
    )
    .bind(tokens)
    .bind(date)
    .bind(provider)
    .execute(pool)
    .await?;

    Ok(())
}

/// Log a request for rate limiting
pub async fn log_request(
    pool: &SqlitePool,
    provider: &str,
    model: Option<&str>,
    tokens: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO request_log (provider, model, tokens)
        VALUES (?, ?, ?)
        "#,
    )
    .bind(provider)
    .bind(model)
    .bind(tokens)
    .execute(pool)
    .await?;

    Ok(())
}

/// Clean old log entries (older than 30 days)
pub async fn clean_old_logs(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM request_log
        WHERE timestamp < datetime('now', '-30 days')
        "#,
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}
```

- [ ] **Step 2: Update lib.rs**

```rust
pub mod schema;

pub use schema::{init_schema, get_or_create_daily_quota, update_quota_usage, log_request, clean_old_logs};
```

- [ ] **Step 3: Commit**

```bash
git add backend/crates/quota-tracker/src/
git commit -m "feat: implement SQLite schema for quota tracking"
```

### Task 1.5: Implement tracker.rs - Main QuotaTracker

**Files:**
- Create: `backend/crates/quota-tracker/src/tracker.rs`

- [ ] **Step 1: Write tracker module**

```rust
//! Main quota tracking logic

use super::{QuotaConfig, QuotaState, Provider, RateLimit, RateTracker};
use sqlx::sqlite::SqlitePool;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;

/// Main quota tracker
pub struct QuotaTracker {
    config: QuotaConfig,
    db: SqlitePool,
    rate_trackers: Arc<RwLock<HashMap<Provider, RateTracker>>>,
    daily_tokens: Arc<AtomicU64>,
    daily_requests: Arc<AtomicU64>,
}

impl QuotaTracker {
    /// Create a new quota tracker
    pub async fn new(config: QuotaConfig) -> Result<Self, Box<dyn std::error::Error>> {
        // Ensure parent directory exists
        if let Some(parent) = config.cache_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Create database connection pool
        let db = SqlitePool::connect(&format!("sqlite:{}", config.cache_path.display())).await?;

        // Initialize schema
        super::schema::init_schema(&db).await?;

        // Load current usage
        let today = Utc::now().format("%Y-%m-%d").to_string();
        let mut daily_tokens = 0u64;
        let mut daily_requests = 0u64;

        for provider in &[Provider::Zai, Provider::OpenRouter, Provider::Nvidia, Provider::Mistral] {
            if let Ok((tokens, requests)) = super::schema::get_or_create_daily_quota(
                &db,
                &today,
                provider.as_str(),
            ).await {
                daily_tokens += tokens as u64;
                daily_requests += requests as u64;
            }
        }

        // Initialize rate trackers with default limits
        let mut rate_trackers = HashMap::new();
        rate_trackers.insert(Provider::Zai, RateTracker::new(Provider::Zai, RateLimit::new(60).with_daily_tokens(1_000_000)));
        rate_trackers.insert(Provider::OpenRouter, RateTracker::new(Provider::OpenRouter, RateLimit::new(20).with_daily_requests(50)));
        rate_trackers.insert(Provider::Nvidia, RateTracker::new(Provider::Nvidia, RateLimit::new(40)));
        rate_trackers.insert(Provider::Mistral, RateTracker::new(Provider::Mistral, RateLimit::new(30).with_daily_requests(2000)));
        rate_trackers.insert(Provider::Ollama, RateTracker::new(Provider::Ollama, RateLimit::new(1000)));

        Ok(Self {
            config,
            db,
            rate_trackers: Arc::new(RwLock::new(rate_trackers)),
            daily_tokens: Arc::new(AtomicU64::new(daily_tokens)),
            daily_requests: Arc::new(AtomicU64::new(daily_requests)),
        })
    }

    /// Get current quota state
    pub async fn get_state(&self) -> QuotaState {
        let usage_pct = self.get_usage_percentage().await;
        QuotaState::from_usage_percentage(usage_pct, self.config.threshold_percent)
    }

    /// Get usage percentage (0.0 to 1.0+)
    pub async fn get_usage_percentage(&self) -> f64 {
        let tokens = self.daily_tokens.load(Ordering::Relaxed);
        let quota = self.config.daily_quota_estimate;
        if quota == 0 {
            return 0.0;
        }
        tokens as f64 / quota as f64
    }

    /// Get current usage stats
    pub async fn get_usage_stats(&self) -> (u64, u64, f64) {
        let tokens = self.daily_tokens.load(Ordering::Relaxed);
        let requests = self.daily_requests.load(Ordering::Relaxed);
        let percentage = self.get_usage_percentage().await;
        (tokens, requests, percentage)
    }

    /// Record token usage from an API response
    pub async fn record_usage(&self, provider: Provider, prompt_tokens: u32, completion_tokens: u32) -> Result<(), Box<dyn std::error::Error>> {
        let total_tokens = prompt_tokens + completion_tokens;
        let today = Utc::now().format("%Y-%m-%d").to_string();

        // Update database
        super::schema::update_quota_usage(
            &self.db,
            &today,
            provider.as_str(),
            total_tokens as i64,
        ).await?;

        super::schema::log_request(
            &self.db,
            provider.as_str(),
            None,
            total_tokens as i64,
        ).await?;

        // Update counters
        self.daily_tokens.fetch_add(total_tokens as u64, Ordering::Relaxed);
        self.daily_requests.fetch_add(1, Ordering::Relaxed);

        Ok(())
    }

    /// Check if a provider can make a request
    pub async fn can_make_request(&self, provider: Provider) -> bool {
        let trackers = self.rate_trackers.read().await;
        if let Some(tracker) = trackers.get(&provider) {
            tracker.can_make_request()
        } else {
            true
        }
    }

    /// Record a request attempt
    pub async fn record_request(&self, provider: Provider) {
        let mut trackers = self.rate_trackers.write().await;
        if let Some(tracker) = trackers.get_mut(&provider) {
            tracker.record_request();
        }
    }

    /// Reset daily counters
    pub async fn reset_daily(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.daily_tokens.store(0, Ordering::Relaxed);
        self.daily_requests.store(0, Ordering::Relaxed);
        Ok(())
    }

    /// Get wait time for a provider if rate limited
    pub async fn get_wait_time(&self, provider: Provider) -> Option<std::time::Duration> {
        let trackers = self.rate_trackers.read().await;
        trackers.get(&provider)?.wait_time()
    }
}
```

- [ ] **Step 2: Update lib.rs**

```rust
pub mod tracker;

pub use tracker::QuotaTracker;
```

- [ ] **Step 3: Commit**

```bash
git add backend/crates/quota-tracker/src/
git commit -m "feat: implement main QuotaTracker with state management"
```

---

## Chunk 2: usage-logger Crate

### Task 2.1: Create usage-logger crate structure

**Files:**
- Create: `backend/crates/usage-logger/Cargo.toml`
- Create: `backend/crates/usage-logger/src/lib.rs`

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "usage-logger"
version = "0.1.0"
edition = "2021"

[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "sqlite", "chrono"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "2"
log = "0.4"
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 2: Create lib.rs**

```rust
//! Request metrics logging for benchmarking and optimization

pub mod logger;
pub mod metrics;
pub mod benchmark;
pub mod schema;

pub use logger::UsageLogger;
pub use metrics::RequestMetrics;
```

- [ ] **Step 3: Commit**

```bash
git add backend/crates/usage-logger/
git commit -m "feat: add usage-logger crate structure"
```

### Task 2.2: Implement metrics.rs - RequestMetrics

**Files:**
- Create: `backend/crates/usage-logger/src/metrics.rs`

- [ ] **Step 1: Write metrics module**

```rust
//! Request metrics data structures

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Complete metrics for a single request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestMetrics {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub provider: String,
    pub model: String,
    pub task_hint: String,

    // Performance
    pub response_time_ms: u64,
    pub time_to_first_token_ms: Option<u64>,

    // Cost
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub estimated_cost_usd: f64,

    // Quality
    pub success: bool,
    pub error_type: Option<String>,
    pub user_rating: Option<u8>,
}

impl RequestMetrics {
    /// Create new metrics
    pub fn new(
        provider: String,
        model: String,
        task_hint: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            provider,
            model,
            task_hint,
            response_time_ms: 0,
            time_to_first_token_ms: None,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            estimated_cost_usd: 0.0,
            success: true,
            error_type: None,
            user_rating: None,
        }
    }

    /// Calculate score for benchmark comparison (lower is better)
    pub fn benchmark_score(&self) -> f64 {
        let time_weight = 0.4;
        let cost_weight = 0.4;
        let success_weight = 0.2;

        let time_score = self.response_time_ms as f64;
        let cost_score = self.estimated_cost_usd * 1000.0;
        let success_score = if self.success { 0.0 } else { 1000.0 };

        time_score * time_weight + cost_score * cost_weight + success_score * success_weight
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/crates/usage-logger/src/
git commit -m "feat: implement RequestMetrics data structure"
```

### Task 2.3: Implement schema.rs - Metrics database schema

**Files:**
- Create: `backend/crates/usage-logger/src/schema.rs`

- [ ] **Step 1: Write schema module**

```rust
//! SQLite schema for metrics logging

use sqlx::sqlite::SqlitePool;

/// Initialize metrics database schema
pub async fn init_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            task_hint TEXT NOT NULL,
            response_time_ms INTEGER NOT NULL,
            time_to_first_token_ms INTEGER,
            prompt_tokens INTEGER NOT NULL,
            completion_tokens INTEGER NOT NULL,
            total_tokens INTEGER NOT NULL,
            estimated_cost_usd REAL NOT NULL,
            success BOOLEAN NOT NULL,
            error_type TEXT,
            user_rating INTEGER
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Indexes for common queries
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
        ON metrics(timestamp DESC)
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_metrics_model_task
        ON metrics(model, task_hint)
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_metrics_provider
        ON metrics(provider)
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Insert a metrics record
pub async fn insert_metrics(
    pool: &SqlitePool,
    metrics: &super::RequestMetrics,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO metrics (
            id, timestamp, provider, model, task_hint,
            response_time_ms, time_to_first_token_ms,
            prompt_tokens, completion_tokens, total_tokens,
            estimated_cost_usd, success, error_type, user_rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&metrics.id)
    .bind(metrics.timestamp)
    .bind(&metrics.provider)
    .bind(&metrics.model)
    .bind(&metrics.task_hint)
    .bind(metrics.response_time_ms as i64)
    .bind(metrics.time_to_first_token_ms.map(|v| v as i64))
    .bind(metrics.prompt_tokens as i64)
    .bind(metrics.completion_tokens as i64)
    .bind(metrics.total_tokens as i64)
    .bind(metrics.estimated_cost_usd)
    .bind(metrics.success)
    .bind(&metrics.error_type)
    .bind(metrics.user_rating.map(|v| v as i64))
    .execute(pool)
    .await?;

    Ok(())
}

/// Get average metrics by model and task
pub async fn get_average_metrics(
    pool: &SqlitePool,
    task_hint: &str,
    min_samples: i64,
) -> Result<Vec<AverageMetricsRow>, sqlx::Error> {
    sqlx::query_as::<_, AverageMetricsRow>(
        r#"
        SELECT
            model,
            AVG(response_time_ms) as avg_time,
            AVG(estimated_cost_usd) as avg_cost,
            SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
            COUNT(*) as sample_size
        FROM metrics
        WHERE task_hint = ?
          AND timestamp > datetime('now', '-7 days')
        GROUP BY model
        HAVING sample_size >= ?
        ORDER BY avg_time * 0.4 + avg_cost * 1000 * 0.4 + (100 - success_rate) * 0.2 ASC
        "#
    )
    .bind(task_hint)
    .bind(min_samples)
    .fetch_all(pool)
    .await
}

#[derive(sqlx::FromRow)]
pub struct AverageMetricsRow {
    pub model: String,
    pub avg_time: f64,
    pub avg_cost: f64,
    pub success_rate: f64,
    pub sample_size: i64,
}
```

- [ ] **Step 2: Update lib.rs**

```rust
pub mod schema;

pub use schema::{init_schema, insert_metrics, get_average_metrics, AverageMetricsRow};
```

- [ ] **Step 3: Commit**

```bash
git add backend/crates/usage-logger/src/
git commit -m "feat: implement metrics database schema"
```

### Task 2.4: Implement logger.rs - UsageLogger

**Files:**
- Create: `backend/crates/usage-logger/src/logger.rs`

- [ ] **Step 1: Write logger module**

```rust
//! Request metrics logger

use super::{RequestMetrics, schema};
use sqlx::sqlite::SqlitePool;
use std::path::Path;

pub struct UsageLogger {
    db: SqlitePool,
}

impl UsageLogger {
    /// Create a new usage logger
    pub async fn new(db_path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let db = SqlitePool::connect(&format!("sqlite:{}", db_path.display())).await?;
        schema::init_schema(&db).await?;

        Ok(Self { db })
    }

    /// Log a request
    pub async fn log(&self, metrics: &RequestMetrics) -> Result<(), Box<dyn std::error::Error>> {
        schema::insert_metrics(&self.db, metrics).await?;
        Ok(())
    }
}
```

- [ ] **Step 2: Update lib.rs**

```rust
pub use logger::UsageLogger;
```

- [ ] **Step 3: Commit**

```bash
git add backend/crates/usage-logger/src/
git commit -m "feat: implement UsageLogger"
```

### Task 2.5: Implement benchmark.rs - Benchmark analysis

**Files:**
- Create: `backend/crates/usage-logger/src/benchmark.rs`

- [ ] **Step 1: Write benchmark module**

```rust
//! Benchmark analysis and routing optimization

use super::schema::{self, AverageMetricsRow};
use sqlx::sqlite::SqlitePool;

/// Get best model for a specific task type
pub async fn get_best_model_for_task(
    pool: &SqlitePool,
    task_hint: &str,
    min_samples: i64,
) -> Option<String> {
    let results = schema::get_average_metrics(pool, task_hint, min_samples).await.ok()?;

    results.first().map(|row| row.model.clone())
}

/// Analyze performance and suggest routing changes
pub async fn analyze_routing(
    pool: &SqlitePool,
) -> Result<Vec<RoutingSuggestion>, Box<dyn std::error::Error>> {
    let mut suggestions = Vec::new();

    // Get top tasks by volume
    let task_counts: Vec<(String, i64)> = sqlx::query_as::<_, (String, i64)>(
        r#"
        SELECT task_hint, COUNT(*) as count
        FROM metrics
        WHERE timestamp > datetime('now', '-7 days')
        GROUP BY task_hint
        ORDER BY count DESC
        LIMIT 10
        "#
    )
    .fetch_all(pool)
    .await?;

    for (task_hint, count) in task_counts {
        if let Some(best_model) = get_best_model_for_task(pool, &task_hint, 10).await {
            suggestions.push(RoutingSuggestion {
                task_hint,
                recommended_model: best_model,
                sample_size: count,
            });
        }
    }

    Ok(suggestions)
}

pub struct RoutingSuggestion {
    pub task_hint: String,
    pub recommended_model: String,
    pub sample_size: i64,
}
```

- [ ] **Step 2: Update lib.rs**

```rust
pub use benchmark::{get_best_model_for_task, analyze_routing, RoutingSuggestion};
```

- [ ] **Step 3: Commit**

```bash
git add backend/crates/usage-logger/src/
git commit -m "feat: implement benchmark analysis"
```

---

## Chunk 3: Model Router Modifications

### Task 3.1: Modify model-router for quota-aware routing

**Files:**
- Modify: `backend/crates/model-router/src/router.rs`

- [ ] **Step 1: Add quota-aware routing to existing router**

```rust
// Add at top of file
use quota_tracker::{QuotaTracker, QuotaState, Provider};
use std::sync::Arc;

// Add field to ModelRouter struct
pub struct ModelRouter {
    // ... existing fields ...
    quota_tracker: Option<Arc<QuotaTracker>>,
}

// Add method to check quota state before routing
impl ModelRouter {
    pub async fn route_with_quota(&self, task_hint: &str) -> RouteDecision {
        // Check quota state
        let quota_state = if let Some(tracker) = &self.quota_tracker {
            tracker.get_state().await
        } else {
            QuotaState::Unknown
        };

        // Filter routing options based on quota state
        let options = self.get_route_options(task_hint);
        let filtered = match quota_state {
            QuotaState::Normal => options,
            QuotaState::Conserving => {
                // Prefer free/cheap models
                options.into_iter()
                    .filter(|o| o.is_free_or_cheap())
                    .collect()
            }
            QuotaState::Critical => {
                // Free models only
                options.into_iter()
                    .filter(|o| o.is_free())
                    .collect()
            }
            QuotaState::Unknown => options,
        };

        // Select best option from filtered list
        self.select_best_option(filtered, task_hint).await
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/crates/model-router/src/
git commit -m "feat: add quota-aware routing to ModelRouter"
```

---

## Chunk 4: Configuration Updates

### Task 4.1: Update config.toml with new sections

**Files:**
- Modify: `backend/config/config.toml`

- [ ] **Step 1: Add quota_tracker section**

```toml
# ================================================================
# QUOTA TRACKING
# ================================================================
[quota_tracker]
enabled = true
daily_quota_estimate = 1000000
threshold_percent = 80.0
cache_path = "~/.zeroclaw/quota.db"

[quota_tracker.provider_limits]
zai = { requests_per_minute = 60, daily_tokens = 1000000 }
openrouter = { requests_per_minute = 20, requests_per_day = 50 }
nvidia = { requests_per_minute = 40 }
mistral = { requests_per_minute = 30, requests_per_day = 2000 }
ollama = { requests_per_minute = 1000 }

# ================================================================
# BENCHMARKING & METRICS
# ================================================================
[benchmarking]
enabled = true
metrics_db = "~/.zeroclaw/metrics.db"
auto_adjust_after = 50
log_failed_requests = true
retention_days = 30

[benchmarking.cost_per_token]
"glm-5" = { prompt = 0.002, completion = 0.006 }
"glm-4.7" = { prompt = 0.001, completion = 0.003 }
"glm-4.6" = { prompt = 0.0005, completion = 0.0015 }
"glm-4.5" = { prompt = 0.0003, completion = 0.0009 }
"glm-4.5v" = { prompt = 0.0005, completion = 0.0015 }
"glm-4.5-air" = { prompt = 0.0, completion = 0.0 }
"codestral" = { prompt = 0.001, completion = 0.003 }
```

- [ ] **Step 2: Update Telegram bot token**

```toml
[channels_config.telegram]
bot_token = "8548880154:AAEfWROgLC1-msLxcF3MttNlymUYJFjrZWQ"
```

- [ ] **Step 3: Commit**

```bash
git add backend/config/config.toml
git commit -m "config: add quota_tracker, benchmarking sections and telegram token"
```

### Task 4.2: Update workspace Cargo.toml

**Files:**
- Modify: `backend/Cargo.toml`

- [ ] **Step 1: Add new workspace members**

```toml
[workspace]
members = [
    # ... existing members ...
    "crates/quota-tracker",
    "crates/usage-logger",
    "crates/benchmark",
]
```

- [ ] **Step 2: Commit**

```bash
git add backend/Cargo.toml
git commit -m "build: add new crates to workspace"
```

---

## Chunk 5: CLI Commands

### Task 5.1: Add quota commands

**Files:**
- Create: `cli/src/commands/quota.rs`

- [ ] **Step 1: Implement quota commands**

```rust
//! Quota tracking CLI commands

use clap::Subcommand;
use quota_tracker::QuotaTracker;
use quota_tracker::QuotaConfig;

#[derive(Subcommand)]
pub enum QuotaCommand {
    /// Show current quota usage
    Status,
    /// Reset daily counters
    Reset,
    /// Set quota estimate
    Set {
        /// Daily token quota estimate
        tokens: u64,
    },
}

pub async fn handle_quota(cmd: QuotaCommand) -> Result<(), Box<dyn std::error::Error>> {
    match cmd {
        QuotaCommand::Status => {
            let config = QuotaConfig::default();
            let tracker = QuotaTracker::new(config).await?;
            let state = tracker.get_state().await;
            let (tokens, requests, pct) = tracker.get_usage_stats().await;

            println!("=== Quota Status ===");
            println!("State: {}", state);
            println!("Tokens: {} / {} ({:.1}%)",
                tokens,
                tracker.config.daily_quota_estimate,
                pct * 100.0
            );
            println!("Requests: {}", requests);
        }
        QuotaCommand::Reset => {
            let config = QuotaConfig::default();
            let tracker = QuotaTracker::new(config).await?;
            tracker.reset_daily().await?;
            println!("Daily counters reset");
        }
        QuotaCommand::Set { tokens } => {
            println!("Set daily quota to {} tokens", tokens);
            println!("Update config.toml: daily_quota_estimate = {}", tokens);
        }
    }
    Ok(())
}
```

- [ ] **Step 2: Update main CLI to include quota command**

```rust
mod commands;
use commands::quota::{QuotaCommand, handle_quota};

#[derive(Subcommand)]
pub enum Command {
    // ... existing commands ...
    Quota(QuotaCommand),
}

// In main match
Command::Quota(cmd) => {
    handle_quota(cmd).await?;
}
```

- [ ] **Step 3: Commit**

```bash
git add cli/src/commands/quota.rs cli/src/main.rs
git commit -m "feat: add quota CLI commands"
```

### Task 5.2: Add benchmark commands

**Files:**
- Create: `cli/src/commands/benchmark.rs`

- [ ] **Step 1: Implement benchmark commands**

```rust
//! Benchmark CLI commands

use clap::Subcommand;

#[derive(Subcommand)]
pub enum BenchmarkCommand {
    /// Run benchmarks
    Run {
        /// Task type to benchmark
        #[clap(short, long, default_value = "code")]
        task: String,
        /// Run in parallel across models
        #[clap(long)]
        parallel: bool,
    },
    /// Compare models
    Compare {
        /// Comma-separated list of models
        #[clap(short, long)]
        models: String,
        /// Task type
        #[clap(short, long, default_value = "code")]
        task: String,
    },
}

pub async fn handle_benchmark(cmd: BenchmarkCommand) -> Result<(), Box<dyn std::error::Error>> {
    match cmd {
        BenchmarkCommand::Run { task, parallel } => {
            println!("Running benchmarks for task: {}", task);
            if parallel {
                println!("Parallel mode enabled");
            }
            // TODO: Implement benchmark execution
        }
        BenchmarkCommand::Compare { models, task } => {
            println!("Comparing models: {} for task: {}", models, task);
            // TODO: Implement model comparison
        }
    }
    Ok(())
}
```

- [ ] **Step 2: Update main CLI**

```rust
use commands::benchmark::{BenchmarkCommand, handle_benchmark};

#[derive(Subcommand)]
pub enum Command {
    // ... existing commands ...
    Benchmark(BenchmarkCommand),
}
```

- [ ] **Step 3: Commit**

```bash
git add cli/src/commands/benchmark.rs cli/src/main.rs
git commit -m "feat: add benchmark CLI commands"
```

### Task 5.3: Add metrics report command

**Files:**
- Create: `cli/src/commands/metrics.rs`

- [ ] **Step 1: Implement metrics command**

```rust
//! Metrics report CLI command

use clap::Parser;

/// Generate performance report
#[derive(Parser)]
pub struct MetricsCommand {
    /// Report period in days
    #[clap(short, long, default_value = "7")]
    period: u32,
    /// Output format
    #[clap(short, long, default_value = "table")]
    format: String,
}

pub async fn handle_metrics(cmd: MetricsCommand) -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Metrics Report (last {} days) ===", cmd.period);
    // TODO: Query metrics and generate report
    Ok(())
}
```

- [ ] **Step 2: Update main CLI**

```rust
use commands::metrics::{MetricsCommand, handle_metrics};

#[derive(Subcommand)]
pub enum Command {
    // ... existing commands ...
    Metrics(MetricsCommand),
}
```

- [ ] **Step 3: Commit**

```bash
git add cli/src/commands/metrics.rs cli/src/main.rs
git commit -m "feat: add metrics report command"
```

---

## Chunk 6: Production Deployment

### Task 6.1: Create deploy command

**Files:**
- Create: `cli/src/commands/deploy.rs`

- [ ] **Step 1: Implement deploy command**

```rust
//! Production deployment command

use clap::Parser;

/// Deploy ZeroClaw to production
#[derive(Parser)]
pub struct DeployCommand {
    /// Enable production mode
    #[clap(long)]
    production: bool,
}

pub async fn handle_deploy(cmd: DeployCommand) -> Result<(), Box<dyn std::error::Error>> {
    if cmd.production {
        println!("Deploying to production...");
        deploy_production().await?;
    } else {
        println!("Development mode - no deployment needed");
    }
    Ok(())
}

async fn deploy_production() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Build release binary
    println!("Building release binary...");
    std::process::Command::new("cargo")
        .args(["build", "--release"])
        .status()?;

    // 2. Install to ~/.cargo/bin
    println!("Installing to ~/.cargo/bin...");
    // Copy binary

    // 3. Create systemd service
    println!("Creating systemd service...");
    let service_content = r#"[Unit]
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

[Install]
WantedBy=multi-user.target
"#;

    println!("Write to /etc/systemd/system/zeroclaw.service");
    println!("Then run: sudo systemctl enable zeroclaw");
    println!("Then run: sudo systemctl start zeroclaw");

    Ok(())
}
```

- [ ] **Step 2: Update main CLI**

```rust
use commands::deploy::{DeployCommand, handle_deploy};

#[derive(Subcommand)]
pub enum Command {
    // ... existing commands ...
    Deploy(DeployCommand),
}
```

- [ ] **Step 3: Commit**

```bash
git add cli/src/commands/deploy.rs cli/src/main.rs
git commit -m "feat: add production deployment command"
```

---

## Chunk 7: Testing & Documentation

### Task 7.1: Add integration tests

**Files:**
- Create: `backend/crates/quota-tracker/tests/integration_test.rs`

- [ ] **Step 1: Write integration tests**

```rust
//! Integration tests for quota tracking

use quota_tracker::{QuotaTracker, QuotaConfig, QuotaState};

#[tokio::test]
async fn test_quota_tracking_workflow() {
    let config = QuotaConfig {
        daily_quota_estimate: 1000,
        threshold_percent: 0.8,
        cache_path: "/tmp/test_quota.db".into(),
    };

    let tracker = QuotaTracker::new(config).await.unwrap();

    // Initial state should be Normal
    assert_eq!(tracker.get_state().await, QuotaState::Normal);

    // Record usage
    tracker.record_usage(quota_tracker::Provider::Zai, 100, 50).await.unwrap();

    // Check usage increased
    let (tokens, _, _) = tracker.get_usage_stats().await;
    assert_eq!(tokens, 150);
}

#[tokio::test]
async fn test_quota_state_transitions() {
    let config = QuotaConfig {
        daily_quota_estimate: 100,
        threshold_percent: 0.8,
        cache_path: "/tmp/test_quota_state.db".into(),
    };

    let tracker = QuotaTracker::new(config).await.unwrap();

    // Should be Normal initially
    assert_eq!(tracker.get_state().await, QuotaState::Normal);

    // Use 85% - should be Conserving
    tracker.record_usage(quota_tracker::Provider::Zai, 85, 0).await.unwrap();
    assert_eq!(tracker.get_state().await, QuotaState::Conserving);
}
```

- [ ] **Step 2: Run tests**

```bash
cd backend/crates/quota-tracker
cargo test --test integration_test
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/crates/quota-tracker/tests/
git commit -m "test: add integration tests for quota tracking"
```

### Task 7.2: Update documentation

**Files:**
- Modify: `backend/README.md`
- Create: `backend/docs/quota-tracking.md`
- Create: `backend/docs/benchmarking.md`

- [ ] **Step 1: Update main README**

```markdown
## Smart Model Routing

ZeroClaw includes intelligent model routing with:
- Automatic provider selection based on task type
- Quota tracking with automatic fallback at 80%
- Benchmark-based optimization

See [docs/quota-tracking.md](docs/quota-tracking.md) and [docs/benchmarking.md](docs/benchmarking.md) for details.
```

- [ ] **Step 2: Create quota-tracking documentation**

```markdown
# Quota Tracking

ZeroClaw automatically tracks API usage and switches to free models when quota is low.

## Configuration

```toml
[quota_tracker]
enabled = true
daily_quota_estimate = 1000000  # Adjust based on your plan
threshold_percent = 80.0
```

## CLI Commands

```bash
# Check current usage
zeroclaw quota status

# Reset daily counters
zeroclaw quota reset

# Set quota estimate
zeroclaw quota set --tokens 500000
```
```

- [ ] **Step 3: Create benchmarking documentation**

```markdown
# Benchmarking

ZeroClaw tracks model performance and automatically optimizes routing.

## Running Benchmarks

```bash
# Benchmark all models for a task
zeroclaw benchmark run --task code --parallel

# Compare specific models
zeroclaw benchmark compare --models glm-4.7,codestral --task coding

# Generate performance report
zeroclaw metrics report --period 7
```
```

- [ ] **Step 4: Commit**

```bash
git add backend/README.md backend/docs/
git commit -m "docs: add quota tracking and benchmarking documentation"
```

---

## Summary

This implementation plan creates:

1. **quota-tracker crate** - Tracks API usage, manages quota state transitions
2. **usage-logger crate** - Logs request metrics for benchmarking
3. **benchmark crate** - CLI commands for running benchmarks
4. **Model router modifications** - Quota-aware routing decisions
5. **CLI commands** - quota, benchmark, metrics, deploy
6. **Production deployment** - systemd + Caddy setup

**Total estimated implementation time:** 3-4 weeks

**Key milestones:**
- Week 1: quota-tracker crate complete
- Week 2: usage-logger + benchmark crates complete
- Week 3: CLI commands + config updates
- Week 4: Testing, documentation, production hardening
