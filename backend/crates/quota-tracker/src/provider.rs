//! Provider and rate limit tracking
//!
//! # TODO
//! This module will be implemented in Task 1.3

/// Represents an AI service provider
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Provider {
    /// Provider name (e.g., "openai", "anthropic")
    pub name: String,
}

/// Rate limit information for a provider
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RateLimit {
    /// Requests per day limit
    pub requests_per_day: u64,
    /// Tokens per day limit
    pub tokens_per_day: u64,
}
