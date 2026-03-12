//! Application state for ZeroClaw TUI Dashboard
//!
//! This module defines the central state structures for the terminal UI,
//! including sessions, messages, input modes, and agent monitoring.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Main application state
#[derive(Debug, Clone)]
pub struct AppState {
    /// Active session index
    pub active_session: usize,

    /// List of sessions
    pub sessions: Vec<Session>,

    /// Input mode (normal/insert/command)
    pub input_mode: InputMode,

    /// Current input buffer
    pub input_buffer: String,

    /// Active subagents from SubAgentManager
    pub active_agents: Vec<AgentStatus>,

    /// Router status (quota, provider)
    pub router_status: RouterStatus,

    /// Vertical scroll offset for chat
    pub chat_scroll: usize,

    /// Application quit flag
    pub should_quit: bool,
}

impl Default for AppState {
    fn default() -> Self {
        let mut sessions = Vec::new();
        // Create initial session
        sessions.push(Session {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Session 1".to_string(),
            messages: Vec::new(),
            created_at: Utc::now(),
        });

        Self {
            active_session: 0,
            sessions,
            input_mode: InputMode::Normal,
            input_buffer: String::new(),
            active_agents: Vec::new(),
            router_status: RouterStatus::default(),
            chat_scroll: 0,
            should_quit: false,
        }
    }
}

/// Chat session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Unique session ID
    pub id: String,

    /// Session name (editable)
    pub name: String,

    /// Messages in this session
    pub messages: Vec<Message>,

    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Message role
    pub role: MessageRole,

    /// Message content
    pub content: String,

    /// Model used for generation (if applicable)
    pub model_used: Option<String>,

    /// Message timestamp
    pub timestamp: DateTime<Utc>,
}

/// Message role (user/assistant/system)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// Input mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputMode {
    /// Normal mode - navigation (Tab, Ctrl+T, etc.)
    Normal,
    /// Insert mode - typing messages
    Insert,
    /// Command mode - `:` like vim
    Command,
}

/// Active agent status
#[derive(Debug, Clone)]
pub struct AgentStatus {
    /// Agent ID
    pub id: String,

    /// Agent name
    pub name: String,

    /// Model being used
    pub model: String,

    /// Progress 0-100
    pub progress: u8,

    /// Current state
    pub status: AgentState,
}

/// Agent execution state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentState {
    Idle,
    Running,
    Done,
    Failed,
}

/// Router status information
#[derive(Debug, Clone)]
pub struct RouterStatus {
    /// Currently active provider
    pub active_provider: String,

    /// Quota used percentage (0-100)
    pub quota_used_percent: f32,

    /// Whether fallback is active
    pub fallback_active: bool,
}

impl Default for RouterStatus {
    fn default() -> Self {
        Self {
            active_provider: "None".to_string(),
            quota_used_percent: 0.0,
            fallback_active: false,
        }
    }
}

// Session management implementations
impl AppState {
    /// Create a new session and switch to it
    pub fn new_session(&mut self) {
        let session = Session {
            id: uuid::Uuid::new_v4().to_string(),
            name: format!("Session {}", self.sessions.len() + 1),
            messages: Vec::new(),
            created_at: Utc::now(),
        };
        self.sessions.push(session);
        self.active_session = self.sessions.len() - 1;
        self.chat_scroll = 0;
    }

    /// Close the current session
    pub fn close_session(&mut self) {
        if self.sessions.len() > 1 {
            self.sessions.remove(self.active_session);
            if self.active_session >= self.sessions.len() {
                self.active_session = self.sessions.len() - 1;
            }
            self.chat_scroll = 0;
        } else {
            // If last session, just clear messages
            if let Some(session) = self.sessions.get_mut(self.active_session) {
                session.messages.clear();
            }
            self.chat_scroll = 0;
        }
    }

    /// Switch to next session (Tab)
    pub fn next_session(&mut self) {
        if !self.sessions.is_empty() {
            self.active_session = (self.active_session + 1) % self.sessions.len();
            self.chat_scroll = 0;
        }
    }

    /// Switch to previous session (Shift+Tab)
    pub fn prev_session(&mut self) {
        if !self.sessions.is_empty() {
            if self.active_session == 0 {
                self.active_session = self.sessions.len() - 1;
            } else {
                self.active_session -= 1;
            }
            self.chat_scroll = 0;
        }
    }

    /// Rename the current session
    pub fn rename_current_session(&mut self, new_name: String) {
        if let Some(session) = self.sessions.get_mut(self.active_session) {
            session.name = new_name;
        }
    }

    /// Get the current session
    pub fn current_session(&self) -> Option<&Session> {
        self.sessions.get(self.active_session)
    }

    /// Get mutable reference to current session
    pub fn current_session_mut(&mut self) -> Option<&mut Session> {
        self.sessions.get_mut(self.active_session)
    }

    /// Add a user message to the current session
    pub fn add_user_message(&mut self, content: String) {
        if let Some(session) = self.current_session_mut() {
            session.messages.push(Message {
                role: MessageRole::User,
                content,
                model_used: None,
                timestamp: Utc::now(),
            });
        }
    }

    /// Add an assistant message to the current session
    pub fn add_assistant_message(&mut self, content: String, model: Option<String>) {
        if let Some(session) = self.current_session_mut() {
            session.messages.push(Message {
                role: MessageRole::Assistant,
                content,
                model_used: model,
                timestamp: Utc::now(),
            });
        }
    }

    /// Scroll chat up
    pub fn scroll_up(&mut self) {
        if self.chat_scroll < self.current_session().map(|s| s.messages.len()).unwrap_or(0) {
            self.chat_scroll = self.chat_scroll.saturating_add(1);
        }
    }

    /// Scroll chat down
    pub fn scroll_down(&mut self) {
        self.chat_scroll = self.chat_scroll.saturating_sub(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_default() {
        let app = AppState::default();
        assert_eq!(app.active_session, 0);
        assert_eq!(app.sessions.len(), 1);
        assert_eq!(app.input_mode, InputMode::Normal);
    }

    #[test]
    fn test_new_session() {
        let mut app = AppState::default();
        app.new_session();
        assert_eq!(app.sessions.len(), 2);
        assert_eq!(app.active_session, 1);
        assert_eq!(app.sessions[1].name, "Session 2");
    }

    #[test]
    fn test_close_session_last_clears() {
        let mut app = AppState::default();
        app.add_user_message("test".to_string());
        app.close_session();
        // Last session is cleared, not removed
        assert_eq!(app.sessions.len(), 1);
        assert_eq!(app.current_session().unwrap().messages.len(), 0);
    }

    #[test]
    fn test_close_session_multiple() {
        let mut app = AppState::default();
        app.new_session();
        app.close_session();
        assert_eq!(app.sessions.len(), 1);
        assert_eq!(app.active_session, 0);
    }

    #[test]
    fn test_next_session_wraps() {
        let mut app = AppState::default();
        app.new_session();
        app.next_session();
        assert_eq!(app.active_session, 0);
    }

    #[test]
    fn test_prev_session_wraps() {
        let mut app = AppState::default();
        app.new_session();
        app.prev_session();
        assert_eq!(app.active_session, 0);
    }

    #[test]
    fn test_add_message() {
        let mut app = AppState::default();
        app.add_user_message("Hello".to_string());
        app.add_assistant_message("Hi".to_string(), Some("gpt-4".to_string()));

        let session = app.current_session().unwrap();
        assert_eq!(session.messages.len(), 2);
        assert_eq!(session.messages[0].role, MessageRole::User);
        assert_eq!(session.messages[1].role, MessageRole::Assistant);
    }
}
