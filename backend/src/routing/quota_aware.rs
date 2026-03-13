//! # Quota-Aware Router
//!
//! Extends the rate-aware routing with quota-based provider selection.
//! This module provides intelligent routing that considers both rate limits
//! and quota consumption to optimize provider selection.

use quota_tracker::{QuotaTracker, QuotaState, Provider};
use std::sync::Arc;
use super::router::{RateAwareRouter, RouteDecision, ProviderEntry};

/// Quota-aware route decision
#[derive(Debug, Clone)]
pub struct QuotaRouteDecision {
    /// Task hint used for routing
    pub task_hint: String,
    /// Current quota state
    pub quota_state: QuotaState,
    /// Whether only free models should be used
    pub use_free_models_only: bool,
    /// Preferred providers in priority order
    pub preferred_providers: Vec<Provider>,
    /// Final routing decision
    pub route_decision: RouteDecision,
}

/// Quota-aware router that selects providers based on quota state
pub struct QuotaAwareRouter {
    /// Quota tracker for monitoring consumption
    quota_tracker: Option<Arc<QuotaTracker>>,
    /// Rate-aware router for actual routing
    rate_router: RateAwareRouter,
}

impl QuotaAwareRouter {
    /// Create a new quota-aware router
    pub fn new(providers: Vec<ProviderEntry>) -> Self {
        Self {
            quota_tracker: None,
            rate_router: RateAwareRouter::new(providers),
        }
    }

    /// Set the quota tracker
    pub fn with_quota_tracker(mut self, tracker: Arc<QuotaTracker>) -> Self {
        self.quota_tracker = Some(tracker);
        self
    }

    /// Get the quota tracker
    pub fn quota_tracker(&self) -> Option<&Arc<QuotaTracker>> {
        self.quota_tracker.as_ref()
    }

    /// Get the rate-aware router
    pub fn rate_router(&self) -> &RateAwareRouter {
        &self.rate_router
    }

    /// Get mutable reference to the rate-aware router
    pub fn rate_router_mut(&mut self) -> &mut RateAwareRouter {
        &mut self.rate_router
    }

    /// Route with quota awareness
    ///
    /// This method considers quota state when making routing decisions:
    /// - Normal state: Use all available providers optimally
    /// - Conserving state: Prefer free/cheap providers
    /// - Critical state: Use free providers only
    /// - Unknown state: Use conservative defaults
    pub async fn route_with_quota(&self, task_hint: &str, model: &str) -> QuotaRouteDecision {
        let quota_state = if let Some(tracker) = &self.quota_tracker {
            tracker.get_state().await
        } else {
            QuotaState::Unknown
        };

        let use_free_models_only = quota_state.requires_free_only();
        let preferred_providers = self.get_providers_for_state(quota_state);

        // Get the routing decision from the rate-aware router
        let route_decision = self.rate_router.route(model);

        QuotaRouteDecision {
            task_hint: task_hint.to_string(),
            quota_state,
            use_free_models_only,
            preferred_providers,
            route_decision,
        }
    }

    /// Get providers for a given quota state
    fn get_providers_for_state(&self, state: QuotaState) -> Vec<Provider> {
        match state {
            QuotaState::Normal => vec![
                Provider::Zai,
                Provider::Nvidia,
                Provider::Mistral,
                Provider::OpenRouter,
                Provider::Ollama,
            ],
            QuotaState::Conserving => vec![
                Provider::Nvidia,
                Provider::Ollama,
            ],
            QuotaState::Critical => vec![Provider::Ollama],
            QuotaState::Unknown => vec![Provider::Zai, Provider::Ollama],
        }
    }

    /// Add a provider to the router
    pub fn add_provider(&mut self, provider: ProviderEntry) {
        self.rate_router.add_provider(provider);
    }

    /// Remove a provider from the router
    pub fn remove_provider(&mut self, provider_id: &str) -> bool {
        self.rate_router.remove_provider(provider_id)
    }

    /// Record a request for rate limit tracking
    pub fn record_request(&mut self, provider_id: &str, tokens: u32) -> Result<(), String> {
        self.rate_router.record_request(provider_id, tokens)
    }

    /// Get current usage statistics for all providers
    pub fn usage_stats(&self) -> std::collections::HashMap<String, (f64, f64, f64)> {
        self.rate_router.usage_stats()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::routing::router::RateLimitConfig;

    fn create_test_provider(id: &str, priority: u32) -> ProviderEntry {
        ProviderEntry::new(
            id.to_string(),
            format!("Provider {}", id),
            priority,
            format!("https://api{}.example.com", id),
            vec!["claude-3-5-sonnet".to_string()],
            RateLimitConfig::new(Some(100), Some(100000), Some(10000)),
        )
    }

    #[test]
    fn test_quota_router_initialization() {
        let providers = vec![
            create_test_provider("provider1", 1),
            create_test_provider("provider2", 2),
        ];

        let router = QuotaAwareRouter::new(providers);
        assert!(router.quota_tracker().is_none());
        assert_eq!(router.rate_router().providers().len(), 2);
    }

    #[test]
    fn test_providers_for_normal_state() {
        let providers = vec![create_test_provider("provider1", 1)];
        let router = QuotaAwareRouter::new(providers);

        let preferred = router.get_providers_for_state(QuotaState::Normal);
        assert_eq!(preferred.len(), 5);
        assert_eq!(preferred[0], Provider::Zai);
    }

    #[test]
    fn test_providers_for_conserving_state() {
        let providers = vec![create_test_provider("provider1", 1)];
        let router = QuotaAwareRouter::new(providers);

        let preferred = router.get_providers_for_state(QuotaState::Conserving);
        assert_eq!(preferred.len(), 2);
        assert_eq!(preferred[0], Provider::Nvidia);
        assert_eq!(preferred[1], Provider::Ollama);
    }

    #[test]
    fn test_providers_for_critical_state() {
        let providers = vec![create_test_provider("provider1", 1)];
        let router = QuotaAwareRouter::new(providers);

        let preferred = router.get_providers_for_state(QuotaState::Critical);
        assert_eq!(preferred.len(), 1);
        assert_eq!(preferred[0], Provider::Ollama);
    }

    #[test]
    fn test_providers_for_unknown_state() {
        let providers = vec![create_test_provider("provider1", 1)];
        let router = QuotaAwareRouter::new(providers);

        let preferred = router.get_providers_for_state(QuotaState::Unknown);
        assert_eq!(preferred.len(), 2);
        assert_eq!(preferred[0], Provider::Zai);
        assert_eq!(preferred[1], Provider::Ollama);
    }
}
