//! Quota state management and transitions

use std::fmt;

/// Represents the current quota consumption state
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum QuotaState {
    /// Below 80% quota - use optimal routing
    Normal,
    /// 80-95% quota - prefer free/cheap models
    Conserving,
    /// Above 95% quota - free models only
    Critical,
    /// No quota data available - use conservative estimates
    Unknown,
}

impl QuotaState {
    /// Determine quota state from usage percentage
    pub fn from_usage_percentage(usage_pct: f64, threshold: f64) -> Self {
        if usage_pct.is_nan() || usage_pct < 0.0 {
            return Self::Unknown;
        }

        let critical_threshold = threshold + 0.15; // threshold + 15%

        if usage_pct < threshold {
            Self::Normal
        } else if usage_pct < critical_threshold {
            Self::Conserving
        } else {
            Self::Critical
        }
    }

    /// Check if this state allows using paid models
    pub fn allows_paid_models(&self) -> bool {
        matches!(self, Self::Normal | Self::Unknown)
    }

    /// Check if this state requires free models only
    pub fn requires_free_only(&self) -> bool {
        matches!(self, Self::Critical)
    }
}

impl fmt::Display for QuotaState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Normal => write!(f, "Normal"),
            Self::Conserving => write!(f, "Conserving"),
            Self::Critical => write!(f, "Critical"),
            Self::Unknown => write!(f, "Unknown"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_state_below_threshold() {
        let state = QuotaState::from_usage_percentage(0.5, 0.8);
        assert_eq!(state, QuotaState::Normal);
        assert!(state.allows_paid_models());
        assert!(!state.requires_free_only());
    }

    #[test]
    fn test_conserving_state_at_threshold() {
        let state = QuotaState::from_usage_percentage(0.85, 0.8);
        assert_eq!(state, QuotaState::Conserving);
        assert!(!state.allows_paid_models());
        assert!(!state.requires_free_only());
    }

    #[test]
    fn test_critical_state_above_threshold() {
        let state = QuotaState::from_usage_percentage(0.96, 0.8);
        assert_eq!(state, QuotaState::Critical);
        assert!(!state.allows_paid_models());
        assert!(state.requires_free_only());
    }

    #[test]
    fn test_unknown_state_for_invalid_input() {
        assert_eq!(QuotaState::from_usage_percentage(f64::NAN, 0.8), QuotaState::Unknown);
        assert_eq!(QuotaState::from_usage_percentage(-1.0, 0.8), QuotaState::Unknown);
    }
}
