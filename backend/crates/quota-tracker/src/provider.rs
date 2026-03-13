//! API provider definitions and rate limits

use std::collections::HashMap;
use std::time::{Duration, Instant};
use std::sync::{Arc, RwLock};

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
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Zai => "zai",
            Self::OpenRouter => "openrouter",
            Self::Nvidia => "nvidia",
            Self::Mistral => "mistral",
            Self::Ollama => "ollama",
        }
    }

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

    pub fn is_free(&self) -> bool {
        matches!(self, Self::Ollama)
    }
}

/// Rate limit configuration for a provider
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RateLimit {
    pub requests_per_minute: u32,
    pub requests_per_day: Option<u32>,
    pub daily_tokens: Option<u64>,
}

impl RateLimit {
    pub fn new(requests_per_minute: u32) -> Self {
        Self {
            requests_per_minute,
            requests_per_day: None,
            daily_tokens: None,
        }
    }

    pub fn with_daily_requests(mut self, limit: u32) -> Self {
        self.requests_per_day = Some(limit);
        self
    }

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
    pub fn new(provider: Provider, limit: RateLimit) -> Self {
        Self {
            provider,
            limit,
            requests: Vec::new(),
            daily_count: 0,
            day_start: Instant::now(),
        }
    }

    pub fn can_make_request(&self) -> bool {
        let now = Instant::now();
        let one_minute_ago = now - Duration::from_secs(60);
        let recent_requests = self.requests.iter().filter(|&&t| t > one_minute_ago).count();

        if recent_requests >= self.limit.requests_per_minute as usize {
            return false;
        }

        if let Some(daily_limit) = self.limit.requests_per_day {
            if self.daily_count >= daily_limit {
                return false;
            }
        }

        true
    }

    pub fn record_request(&mut self) {
        self.requests.push(Instant::now());
        self.daily_count += 1;

        if self.day_start.elapsed() >= Duration::from_secs(86400) {
            self.daily_count = 0;
            self.day_start = Instant::now();
        }

        let one_minute_ago = Instant::now() - Duration::from_secs(60);
        self.requests.retain(|&t| t > one_minute_ago);
    }

    pub fn wait_time(&self) -> Option<Duration> {
        if self.can_make_request() {
            return None;
        }

        let now = Instant::now();
        if self.requests.len() >= self.limit.requests_per_minute as usize {
            let oldest_in_window = self.requests[self.requests.len() - self.limit.requests_per_minute as usize];
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

        assert!(!tracker.can_make_request());
    }

    #[test]
    fn test_provider_is_free() {
        assert!(Provider::Ollama.is_free());
        assert!(!Provider::Zai.is_free());
    }
}
