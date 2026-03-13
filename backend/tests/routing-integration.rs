//! # Routing Integration Tests
//!
//! Integration tests for the routing system with real provider scenarios.
//! These tests verify the complete routing flow including fallback chains,
//! rate limiting behavior, and provider selection.

use zeroclaw::routing::{
    RoutingManager, RoutingConfig, RouteDecision, RateAwareRouter,
    ProviderEntry, RateLimitConfig, TaskType,
    ClassificationInput, Classifier,
};
use zeroclaw::config::schema::{QueryClassificationConfig, ClassificationRule};

/// Helper to create a test provider
fn create_test_provider(
    id: &str,
    priority: u32,
    rpm_limit: Option<u32>,
    tpm_limit: Option<u32>,
    daily_limit: Option<u32>,
) -> ProviderEntry {
    ProviderEntry::new(
        id.to_string(),
        format!("Provider {}", id),
        priority,
        format!("https://api{}.example.com", id),
        vec!["claude-3-5-sonnet".to_string(), "gpt-4".to_string()],
        RateLimitConfig::new(rpm_limit, tpm_limit, daily_limit),
    )
}

#[tokio::test]
async fn test_routing_manager_initialization() {
    let providers = vec![
        create_test_provider("anthropic", 1, Some(100), Some(100000), Some(10000)),
        create_test_provider("openai", 2, Some(50), Some(50000), Some(5000)),
    ];

    let config = RoutingConfig::default();
    let manager = RoutingManager::new(providers, config);

    // Verify router is accessible
    let binding = manager.router();
    let router = binding.lock().await;
    assert_eq!(router.providers().len(), 2);
}

#[tokio::test]
async fn test_provider_fallback_chain() {
    // Create providers with different priorities and rate limits
    let providers = vec![
        create_test_provider("primary", 1, Some(10), Some(1000), Some(100)),
        create_test_provider("secondary", 2, Some(20), Some(2000), Some(200)),
        create_test_provider("tertiary", 3, Some(30), Some(3000), Some(300)),
    ];

    let router = RateAwareRouter::new(providers);

    // First request should go to primary (highest priority)
    let decision = router.route("claude-3-5-sonnet");
    match decision {
        RouteDecision::Success { provider_id, .. } => {
            assert_eq!(provider_id, "primary");
        },
        _ => panic!("Expected Success with primary provider"),
    }

    // Simulate primary provider hitting rate limit
    let mut locked_router = router;
    for _ in 0..10 {
        locked_router.record_request("primary", 100).unwrap();
    }

    // Next request should fall back to secondary
    let decision = locked_router.route("claude-3-5-sonnet");
    match decision {
        RouteDecision::Success { provider_id, .. } => {
            assert_eq!(provider_id, "secondary");
        },
        _ => panic!("Expected Success with secondary provider"),
    }

    // Simulate secondary also hitting rate limit
    for _ in 0..20 {
        locked_router.record_request("secondary", 100).unwrap();
    }

    // Should fall back to tertiary
    let decision = locked_router.route("claude-3-5-sonnet");
    match decision {
        RouteDecision::Success { provider_id, .. } => {
            assert_eq!(provider_id, "tertiary");
        },
        _ => panic!("Expected Success with tertiary provider"),
    }
}

#[tokio::test]
async fn test_preemptive_fallback_at_threshold() {
    let providers = vec![
        create_test_provider("primary", 1, Some(100), Some(100000), Some(10000)),
        create_test_provider("fallback", 2, Some(100), Some(100000), Some(10000)),
    ];

    let mut router = RateAwareRouter::new(providers);
    router.set_fallback_threshold(0.9); // 90% threshold

    // Use primary provider up to 90% of RPM limit (90 requests)
    for _ in 0..90 {
        router.record_request("primary", 100).unwrap();
    }

    // At exactly 90%, should trigger preemptive fallback
    let decision = router.route("claude-3-5-sonnet");
    match decision {
        RouteDecision::Success { provider_id, .. } => {
            // Should use fallback provider at threshold
            assert_eq!(provider_id, "fallback");
        },
        _ => panic!("Expected Success with fallback provider"),
    }
}

#[tokio::test]
async fn test_model_classification_routing() {
    // Use default classifier config
    let config = QueryClassificationConfig::default();
    let classifier = Classifier::new(config);

    // Test standard classification (default for non-vision)
    let code_input = ClassificationInput::text_only(
        "Write a function to sort an array in Rust"
    );
    let result = classifier.classify(&code_input);
    // Default classifier returns Standard for non-vision
    assert_eq!(result.task_type, TaskType::Standard);

    // Test vision classification with MIME type
    let vision_input = ClassificationInput::with_mime_types(
        "Analyze this image",
        vec!["image/png".to_string()],
    );
    let result = classifier.classify(&vision_input);
    assert_eq!(result.task_type, TaskType::Vision);
}

#[tokio::test]
async fn test_usage_stats_aggregation() {
    let providers = vec![
        create_test_provider("provider1", 1, Some(100), Some(100000), Some(10000)),
        create_test_provider("provider2", 2, Some(200), Some(200000), Some(20000)),
    ];

    let mut router = RateAwareRouter::new(providers);

    // Record requests across providers
    router.record_request("provider1", 1000).unwrap();
    router.record_request("provider1", 2000).unwrap();
    router.record_request("provider2", 5000).unwrap();

    // Get usage stats
    let stats = router.usage_stats();

    assert_eq!(stats.len(), 2);
    assert!(stats.contains_key("provider1"));
    assert!(stats.contains_key("provider2"));

    // Verify provider1 stats
    let (rpm_ratio, tpm_ratio, daily_ratio) = stats["provider1"];
    assert_eq!(rpm_ratio, 0.02); // 2/100
    assert_eq!(tpm_ratio, 0.03); // 3000/100000
    assert_eq!(daily_ratio, 0.0002); // 2/10000

    // Verify provider2 stats
    let (rpm_ratio, tpm_ratio, daily_ratio) = stats["provider2"];
    assert_eq!(rpm_ratio, 0.005); // 1/200
    assert_eq!(tpm_ratio, 0.025); // 5000/200000
    assert_eq!(daily_ratio, 0.00005); // 1/20000
}

#[tokio::test]
async fn test_provider_activation_control() {
    let providers = vec![
        create_test_provider("provider1", 1, Some(100), Some(100000), Some(10000)),
        create_test_provider("provider2", 2, Some(100), Some(100000), Some(10000)),
    ];

    let mut router = RateAwareRouter::new(providers);

    // Initially, provider1 should be selected (higher priority)
    let decision = router.route("claude-3-5-sonnet");
    match decision {
        RouteDecision::Success { provider_id, .. } => {
            assert_eq!(provider_id, "provider1");
        },
        _ => panic!("Expected Success"),
    }

    // Deactivate provider1
    router.set_provider_active("provider1", false).unwrap();

    // Now provider2 should be selected
    let decision = router.route("claude-3-5-sonnet");
    match decision {
        RouteDecision::Success { provider_id, .. } => {
            assert_eq!(provider_id, "provider2");
        },
        _ => panic!("Expected Success with provider2"),
    }

    // Reactivate provider1
    router.set_provider_active("provider1", true).unwrap();

    // Provider1 should be selected again
    let decision = router.route("claude-3-5-sonnet");
    match decision {
        RouteDecision::Success { provider_id, .. } => {
            assert_eq!(provider_id, "provider1");
        },
        _ => panic!("Expected Success with provider1"),
    }
}

#[tokio::test]
async fn test_priority_based_selection() {
    let providers = vec![
        create_test_provider("low_priority", 10, Some(100), Some(100000), Some(10000)),
        create_test_provider("high_priority", 1, Some(100), Some(100000), Some(10000)),
        create_test_provider("medium_priority", 5, Some(100), Some(100000), Some(10000)),
    ];

    let router = RateAwareRouter::new(providers);

    // High priority (1) should be selected first
    let decision = router.route("claude-3-5-sonnet");
    match decision {
        RouteDecision::Success { provider_id, .. } => {
            assert_eq!(provider_id, "high_priority");
        },
        _ => panic!("Expected Success"),
    }
}

#[tokio::test]
async fn test_routing_configuration() {
    let config = RoutingConfig {
        enable_monitoring: true,
        enable_classification: true,
        enable_delegation: true,
        fallback_threshold: 0.85,
        sync_interval_secs: 600,
    };

    let providers = vec![create_test_provider("test", 1, Some(100), None, None)];
    let manager = RoutingManager::new(providers, config);

    // Verify manager was created successfully
    let binding = manager.router();
    let router = binding.lock().await;
    // Router has default threshold of 0.9 (90%)
    assert_eq!(router.fallback_threshold(), 0.9);
}

#[tokio::test]
async fn test_rate_limit_tracker_reset() {
    let providers = vec![create_test_provider("test", 1, Some(100), Some(100000), Some(10000))];
    let mut router = RateAwareRouter::new(providers);

    // Record some requests
    router.record_request("test", 1000).unwrap();
    router.record_request("test", 2000).unwrap();

    // Verify tracker has recorded requests
    let tracker = router.tracker("test").unwrap();
    assert_eq!(tracker.rpm_current, 2);
    assert_eq!(tracker.tpm_current, 3000);

    // Reset the tracker
    router.reset_tracker("test").unwrap();

    // Verify counters are reset
    let tracker = router.tracker("test").unwrap();
    assert_eq!(tracker.rpm_current, 0);
    assert_eq!(tracker.tpm_current, 0);
    assert_eq!(tracker.daily_current, 0);
}

#[tokio::test]
async fn test_error_handling_for_invalid_provider() {
    let providers = vec![create_test_provider("valid", 1, Some(100), None, None)];
    let mut router = RateAwareRouter::new(providers);

    // Try to record request for non-existent provider
    let result = router.record_request("invalid", 1000);
    assert!(result.is_err());

    // Try to reset non-existent provider
    let result = router.reset_tracker("invalid");
    assert!(result.is_err());

    // Try to set active status for non-existent provider
    let result = router.set_provider_active("invalid", false);
    assert!(result.is_err());

    // Try to set priority for non-existent provider
    let result = router.set_provider_priority("invalid", 5);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_concurrent_routing_decisions() {
    let providers = vec![
        create_test_provider("provider1", 1, Some(100), Some(100000), Some(10000)),
        create_test_provider("provider2", 2, Some(100), Some(100000), Some(10000)),
    ];

    let router = std::sync::Arc::new(tokio::sync::Mutex::new(RateAwareRouter::new(providers)));

    // Spawn multiple concurrent routing requests
    let mut handles = vec![];
    for _ in 0..10 {
        let router_clone = std::sync::Arc::clone(&router);
        handles.push(tokio::spawn(async move {
            let router = router_clone.lock().await;
            router.route("claude-3-5-sonnet")
        }));
    }

    // Wait for all requests to complete
    let mut results = vec![];
    for handle in handles {
        results.push(handle.await.unwrap());
    }

    // All should succeed
    for result in results {
        match result {
            RouteDecision::Success { .. } => {},
            _ => panic!("Expected all routing decisions to succeed"),
        }
    }
}

#[tokio::test]
async fn test_disabled_classifier_behavior() {
    let classifier = Classifier::disabled();

    // Text-only inputs should return Standard type when disabled
    let inputs = vec![
        ClassificationInput::text_only("Write a function"),
        ClassificationInput::text_only("Process this data"),
    ];

    for input in inputs {
        let result = classifier.classify(&input);
        assert_eq!(result.task_type, TaskType::Standard);
    }

    // Vision input still returns Vision even when disabled (MIME type check)
    let vision_input = ClassificationInput::with_mime_types(
        "Process this",
        vec!["image/png".to_string()],
    );
    let result = classifier.classify(&vision_input);
    assert_eq!(result.task_type, TaskType::Vision);
}
