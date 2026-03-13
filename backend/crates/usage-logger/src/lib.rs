//! Request metrics logging for benchmarking and optimization

pub mod logger;
pub mod metrics;
pub mod benchmark;
pub mod schema;

pub use logger::UsageLogger;
pub use metrics::RequestMetrics;
pub use benchmark::{RoutingSuggestion, get_best_model_for_task, analyze_routing};
