//! Ingress-First Journaling TDD Tests
//!
//! KROK 1: Refactor agent loop - save messages to database BEFORE LLM processing

use crate::agent::agent::Agent;
use crate::agent::dispatcher::NativeToolDispatcher;
use crate::agent::prompt::SystemPromptBuilder;
use crate::channels::traits::ChannelMessage;
use crate::config::{AgentConfig, MemoryConfig};
use crate::memory::{self, Memory};
use crate::observability::NoopObserver;
use crate::providers::{ChatMessage, ChatRequest, ChatResponse, Provider};
use anyhow::Result;
use async_trait::async_trait;
use parking_lot::Mutex;
use std::sync::Arc;

struct MockProvider {
    responses: Mutex<Vec<ChatResponse>>,
}

#[async_trait]
impl Provider for MockProvider {
    async fn chat_with_system(
        &self,
        _system_prompt: Option<&str>,
        _message: &str,
        _model: &str,
        _temperature: f64,
    ) -> Result<String> {
        Ok("mock response".into())
    }

    async fn chat(
        &self,
        _request: ChatRequest<'_>,
        _model: &str,
        _temperature: f64,
    ) -> Result<ChatResponse> {
        Ok(self.responses.lock().first().cloned().unwrap_or_else(|| {
            ChatResponse {
                id: "mock".into(),
                role: "assistant".into(),
                content: ChatMessage::assistant("mock response"),
                model: "mock".into(),
                provider: "mock".into(),
                usage: None,
                reasoning_content: None,
            }
        }))
    }

    fn name(&self) -> &str {
        "mock"
    }
}

#[tokio::test]
async fn discord_message_saved_to_database_before_llm_processing() {
    use crate::memory;

    // Setup: Create SQLite memory to verify database writes
    let tmp = tempfile::TempDir::new().unwrap();
    let cfg = MemoryConfig {
        backend: "sqlite".into(),
        ..MemoryConfig::default()
    };
    let mem = Arc::from(memory::create_memory(&cfg, tmp.path(), None).unwrap());

    // Create agent with SQLite memory
    let provider = Box::new(MockProvider {
        responses: Mutex::new(vec![ChatResponse {
            id: "test".into(),
            role: "assistant".into(),
            content: ChatMessage::assistant("LLM response"),
            model: "test".into(),
            provider: "test".into(),
            usage: None,
            reasoning_content: None,
        }]),
    });

    let mut agent = Agent::builder()
        .provider(provider)
        .tools(vec![])
        .memory(mem.clone())
        .observer(Arc::from(NoopObserver))
        .tool_dispatcher(Box::new(NativeToolDispatcher))
        .workspace_dir(std::env::temp_dir())
        .auto_save(false)
        .build()
        .unwrap();

    // Create Discord message
    let discord_msg = ChannelMessage {
        id: "discord_test_001".to_string(),
        sender: "546426705560993802".to_string(),
        reply_target: "".to_string(),
        content: "Test Discord message".to_string(),
        channel: "discord".to_string(),
        timestamp: 1742385600,
        thread_ts: None,
    };

    // ACT: Send message to agent
    let _response = agent.turn(&discord_msg.content).await.unwrap();

    // VERIFY: Message should be saved to database
    let entries_after = mem.recall(&discord_msg.sender, 100, None).await.unwrap();

    let discord_count_after = entries_after
        .iter()
        .filter(|e| e.key.contains("discord") || e.key.contains(&discord_msg.sender))
        .count();

    // GREEN PHASE: This should pass after implementing save_ingress
    assert_eq!(
        discord_count_after, 1,
        "Discord message NOT saved to database! Expected 1 entry, found {}",
        discord_count_after
    );
}
