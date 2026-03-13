//! Main quota tracking logic

use super::{QuotaConfig, QuotaState, Provider, RateLimit, RateTracker, schema};
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicU64, Ordering};
use chrono::Utc;

/// Main quota tracker
pub struct QuotaTracker {
    config: QuotaConfig,
    conn: Arc<Connection>,
    rate_trackers: Arc<RwLock<HashMap<Provider, RateTracker>>>,
    daily_tokens: Arc<AtomicU64>,
    daily_requests: Arc<AtomicU64>,
}

impl QuotaTracker {
    /// Create a new quota tracker
    pub fn new(config: QuotaConfig) -> Result<Self, Box<dyn std::error::Error>> {
        // Ensure parent directory exists
        if let Some(parent) = config.cache_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Create database connection
        let conn = Connection::open(&config.cache_path)?;

        // Initialize schema
        schema::init_schema(&conn)?;

        // Load current usage
        let today = Utc::now().format("%Y-%m-%d").to_string();
        let mut daily_tokens = 0u64;
        let mut daily_requests = 0u64;

        for provider in &[Provider::Zai, Provider::OpenRouter, Provider::Nvidia, Provider::Mistral] {
            if let Ok((tokens, requests)) = schema::get_or_create_daily_quota(
                &conn,
                &today,
                provider.as_str(),
            ) {
                daily_tokens += tokens as u64;
                daily_requests += requests as u64;
            }
        }

        // Initialize rate trackers
        let mut rate_trackers = HashMap::new();
        rate_trackers.insert(Provider::Zai, RateTracker::new(Provider::Zai, RateLimit::new(60).with_daily_tokens(1_000_000)));
        rate_trackers.insert(Provider::OpenRouter, RateTracker::new(Provider::OpenRouter, RateLimit::new(20).with_daily_requests(50)));
        rate_trackers.insert(Provider::Nvidia, RateTracker::new(Provider::Nvidia, RateLimit::new(40)));
        rate_trackers.insert(Provider::Mistral, RateTracker::new(Provider::Mistral, RateLimit::new(30).with_daily_requests(2000)));
        rate_trackers.insert(Provider::Ollama, RateTracker::new(Provider::Ollama, RateLimit::new(1000)));

        Ok(Self {
            config,
            conn: Arc::new(conn),
            rate_trackers: Arc::new(RwLock::new(rate_trackers)),
            daily_tokens: Arc::new(AtomicU64::new(daily_tokens)),
            daily_requests: Arc::new(AtomicU64::new(daily_requests)),
        })
    }

    /// Get current quota state
    pub fn get_state(&self) -> QuotaState {
        let usage_pct = self.get_usage_percentage();
        QuotaState::from_usage_percentage(usage_pct, self.config.threshold_percent)
    }

    /// Get usage percentage (0.0 to 1.0+)
    pub fn get_usage_percentage(&self) -> f64 {
        let tokens = self.daily_tokens.load(Ordering::Relaxed);
        let quota = self.config.daily_quota_estimate;
        if quota == 0 {
            return 0.0;
        }
        tokens as f64 / quota as f64
    }

    /// Get current usage stats
    pub fn get_usage_stats(&self) -> (u64, u64, f64) {
        let tokens = self.daily_tokens.load(Ordering::Relaxed);
        let requests = self.daily_requests.load(Ordering::Relaxed);
        let percentage = self.get_usage_percentage();
        (tokens, requests, percentage)
    }

    /// Record token usage from an API response
    pub fn record_usage(&self, provider: Provider, prompt_tokens: u32, completion_tokens: u32) -> Result<(), Box<dyn std::error::Error>> {
        let total_tokens = prompt_tokens + completion_tokens;
        let today = Utc::now().format("%Y-%m-%d").to_string();

        schema::update_quota_usage(&self.conn, &today, provider.as_str(), total_tokens as i64)?;
        schema::log_request(&self.conn, provider.as_str(), None, total_tokens as i64)?;

        self.daily_tokens.fetch_add(total_tokens as u64, Ordering::Relaxed);
        self.daily_requests.fetch_add(1, Ordering::Relaxed);

        Ok(())
    }

    /// Check if a provider can make a request
    pub fn can_make_request(&self, provider: Provider) -> bool {
        let trackers = self.rate_trackers.read().unwrap();
        trackers.get(&provider).map_or(true, |t| t.can_make_request())
    }

    /// Record a request attempt
    pub fn record_request(&self, provider: Provider) {
        let mut trackers = self.rate_trackers.write().unwrap();
        if let Some(tracker) = trackers.get_mut(&provider) {
            tracker.record_request();
        }
    }

    /// Reset daily counters
    pub fn reset_daily(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.daily_tokens.store(0, Ordering::Relaxed);
        self.daily_requests.store(0, Ordering::Relaxed);
        Ok(())
    }

    /// Get wait time for a provider if rate limited
    pub fn get_wait_time(&self, provider: Provider) -> Option<std::time::Duration> {
        let trackers = self.rate_trackers.read().unwrap();
        trackers.get(&provider)?.wait_time()
    }
}
