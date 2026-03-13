//! Quota state management
//!
//! # TODO
//! This module will be implemented in Task 1.2

/// Quota state represents the current status of quota usage
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum QuotaState {
    /// Normal operation - quota usage is below threshold
    Normal,
    /// Conserving mode - quota usage is approaching threshold
    Conserving,
    /// Critical mode - quota usage has exceeded threshold
    Critical,
}

impl Default for QuotaState {
    fn default() -> Self {
        Self::Normal
    }
}
