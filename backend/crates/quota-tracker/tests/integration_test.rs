use quota_tracker::{QuotaTracker, QuotaConfig, QuotaState, Provider};

#[tokio::test]
async fn test_quota_tracking_workflow() {
    let config = QuotaConfig {
        daily_quota_estimate: 1000,
        threshold_percent: 0.8,
        cache_path: "/tmp/test_quota.db".into(),
    };

    let tracker = QuotaTracker::new(config).unwrap();
    assert_eq!(tracker.get_state(), QuotaState::Normal);

    tracker.record_usage(Provider::Zai, 100, 50).unwrap();
    let (tokens, _, _) = tracker.get_usage_stats();
    assert_eq!(tokens, 150);
}
