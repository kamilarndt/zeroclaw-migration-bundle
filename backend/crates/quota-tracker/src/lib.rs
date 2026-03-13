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
            cache_path: std::path::PathBuf::from(".zeroclaw/quota.db"),
        }
    }
}
