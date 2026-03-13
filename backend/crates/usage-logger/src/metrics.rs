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
    pub fn new(provider: String, model: String, task_hint: String) -> Self {
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
