pub mod schema;
pub mod traits;
pub mod routing;

// Domain-specific schema modules
pub mod schemas {
    pub mod memory_schema;
    pub mod security_schema;
    pub mod llm_schema;

    // Re-export memory types
    pub use memory_schema::{
        StorageConfig, StorageProviderSection, StorageProviderConfig,
        MemoryConfig, QdrantConfig,
    };

    // Re-export security types
    pub use security_schema::{
        SecurityConfig, OtpConfig, OtpMethod, EstopConfig,
        SandboxConfig, SandboxBackend, ResourceLimitsConfig, AuditConfig,
    };

    // Re-export LLM types
    pub use llm_schema::{
        ModelRouteConfig, EmbeddingRouteConfig,
        QueryClassificationConfig, ClassificationRule, DelegateAgentConfig,
    };
}

// Re-export types from schema.rs (main config types)
#[allow(unused_imports)]
pub use schema::{
    apply_runtime_proxy_to_builder, build_runtime_proxy_client,
    build_runtime_proxy_client_with_timeouts, runtime_proxy_config, set_runtime_proxy_config,
    // default_nostr_relays, // Removed - Nostr channel deleted
    // Types defined in schema.rs
    AgentConfig, AutonomyConfig, BrowserComputerUseConfig, BrowserConfig,
    BuiltinHooksConfig, ChannelsConfig, ComposioConfig, Config, CostConfig,
    CronConfig, DockerRuntimeConfig,
    DiscordConfig, // Discord channel
    GatewayConfig, HardwareConfig, HardwareTransport, // Hardware config types
    HeartbeatConfig, HooksConfig, HttpRequestConfig,
    // IMessageConfig, // Removed - iMessage channel deleted
    IdentityConfig,
    // IrcConfig, // Removed - IRC channel deleted
    // LarkConfig, LarkReceiveMode, // Removed - Lark channel deleted
    // LinqConfig, // Removed - Linq channel deleted
    // MatrixConfig, // Removed - Matrix channel deleted
    MultimodalConfig,
    // NextcloudTalkConfig, // Removed - Nextcloud Talk channel deleted
    // NostrConfig, // Removed - Nostr channel deleted
    ObservabilityConfig,
    // PeripheralBoardConfig, PeripheralsConfig, // Removed - peripherals module deleted
    ProxyConfig, ProxyScope,
    // QQConfig, // Removed - QQ channel deleted
    ReliabilityConfig,
    RuntimeConfig, SchedulerConfig, SecretsConfig,
    // SignalConfig, // Removed - Signal channel deleted
    SkillsConfig, SkillsPromptInjectionMode,
    // SlackConfig, // Removed - Slack channel deleted
    StreamMode, TelegramConfig, // Telegram channel
    TranscriptionConfig, TunnelConfig, TailscaleTunnelConfig,
    WebFetchConfig, WebSearchConfig,
    // WebhookConfig, WhatsAppConfig, // Removed - Webhook and WhatsApp channels deleted
};

// Re-export types from schemas submodules
#[allow(unused_imports)]
pub use schemas::{
    // From llm_schema
    ClassificationRule, DelegateAgentConfig, EmbeddingRouteConfig, ModelRouteConfig, QueryClassificationConfig,
    // From memory_schema
    MemoryConfig, QdrantConfig, StorageConfig, StorageProviderConfig, StorageProviderSection,
    // From security_schema
    AuditConfig, EstopConfig, OtpConfig, OtpMethod, ResourceLimitsConfig, SandboxBackend, SandboxConfig, SecurityConfig,
};

pub fn name_and_presence<T: traits::ChannelConfig>(channel: &Option<T>) -> (&'static str, bool) {
    (T::name(), channel.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reexported_config_default_is_constructible() {
        let config = Config::default();

        assert!(config.default_provider.is_some());
        assert!(config.default_model.is_some());
        assert!(config.default_temperature > 0.0);
    }

    // Channel config test removed - channels deleted
}
