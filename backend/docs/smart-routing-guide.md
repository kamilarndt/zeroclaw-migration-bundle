# ZeroClaw Smart Routing Guide

ZeroClaw's intelligent routing system automatically selects the best AI model for each task based on:
- **Quota usage** - Switches to free models when paid quota is 80% full
- **Task type** - Routes coding, reasoning, and general tasks to optimized models
- **Performance benchmarks** - Learns which models perform best over time

## Quick Start

### 1. Configure API Keys

Create `~/.zeroclaw/.env`:

```bash
# Z.AI (GLM Models - Primary)
ZAI_API_KEY=your_zai_api_key_here

# OpenRouter (Claude models - Backup)
OPENROUTER_API_KEY=your_openrouter_key_here

# NVIDIA NIM (Optional)
NVIDIA_API_KEY=your_nvidia_key_here

# Mistral (Codestral - Optional)
MISTRAL_API_KEY=your_mistral_key_here
```

### 2. Update Configuration

Edit `~/.zeroclaw/config.toml`:

```toml
default_provider = "zai"
default_model = "glm-4.7"

[model_providers.zai]
name = "zai"
base_url = "https://api.z.ai/api/coding/paas/v4"

[model_providers.openrouter]
name = "openrouter"
base_url = "https://openrouter.ai/api/v1"

[model_providers.nvidia]
name = "nvidia"
base_url = "https://integrate.api.nvidia.com/v1"

[model_providers.mistral]
name = "mistral"
base_url = "https://api.mistral.ai/v1"

[model_providers.ollama]
name = "ollama"
base_url = "http://localhost:11434"
```

### 3. Enable Quota Tracking

```toml
[quota_tracker]
enabled = true
daily_quota_estimate = 1000000  # Your daily token limit
threshold_percent = 80.0          # Switch to free models at 80%

[quota_tracker.provider_limits]
zai = { requests_per_minute = 60, daily_tokens = 1000000 }
openrouter = { requests_per_minute = 20, requests_per_day = 50 }
nvidia = { requests_per_minute = 40 }
mistral = { requests_per_minute = 30, requests_per_day = 2000 }
ollama = { requests_per_minute = 1000 }
```

### 4. Restart Services

```bash
# Kill existing processes
pkill -f zeroclaw

# Start with environment variables
source ~/.zeroclaw/.env
zeroclaw channel start &
```

## Available Models

### Z.AI Models (Primary)

| Model | Context | Best For | Cost (per 1K tokens) |
|-------|---------|----------|---------------------|
| **GLM-4.7** | 128K | General purpose, coding | $0.003 |
| GLM-5 | 128K | Complex reasoning | $0.006 |
| GLM-4.6 | 1M | Large context tasks | $0.0015 |
| GLM-4.5V | Vision | Multimodal tasks | $0.0015 |
| GLM-4.5 | Standard | Quick responses | $0.0009 |
| GLM-4.5-Air | - | **Free** | $0.00 |

### OpenRouter Models (Backup)

| Model | Best For |
|-------|----------|
| Claude Sonnet 4.6 | General tasks |
| Claude Opus 4.7 | Complex reasoning |
| Claude Haiku 4.5 | Fast, inexpensive |

### Mistral Models

| Model | Best For |
|-------|----------|
| Codestral | Code generation |
| Mistral Large | General tasks |

### NVIDIA NIM Models

| Model | Best For |
|-------|----------|
| Various open models | Cost optimization |

## Quota States

### Normal (0-80%)
- Uses paid models (GLM-4.7, Claude, etc.)
- Full provider pool available
- Best performance models

### Conserving (80-95%)
- Prefers efficient models (GLM-4.5, GLM-4.5V)
- Reduces usage of expensive models
- Still uses paid tier

### Critical (95%+)
- Only free models (GLM-4.5-Air, Ollama)
- No paid API calls
- Limited capabilities

## CLI Commands

### Check Status

```bash
# Quota usage
zeroclaw quota status

# Provider list
zeroclaw providers

# Channel health
zeroclaw channel doctor
```

### Manage Quota

```bash
# Reset daily counters
zeroclaw quota reset

# View benchmark results
zeroclaw benchmark run --task coding

# Metrics report
zeroclaw metrics --period 7
```

## Task-Based Routing

Configure intelligent routing by task type:

```toml
model_routes = [
  # Coding tasks
  { task_hint = "coding", provider = "zai", model = "glm-4.7" },
  { task_hint = "programming", provider = "zai", model = "glm-4.7" },
  { task_hint = "debug", provider = "mistral", model = "codestral" },

  # Reasoning tasks
  { task_hint = "reasoning", provider = "zai", model = "glm-5" },
  { task_hint = "analysis", provider = "zai", model = "glm-4.7" },

  # General tasks
  { task_hint = "general", provider = "zai", model = "glm-4.7" },
  { task_hint = "chat", provider = "zai", model = "glm-4.5v" },
]

# Fallback to free models
model_routes_fallback = [
  { task_hint = "any", provider = "ollama", model = "llama3.2" },
]
```

## Benchmarking

ZeroClaw automatically tracks:
- Response time (40% weight)
- Cost efficiency (40% weight)
- Success rate (20% weight)

### View Benchmarks

```bash
# Best model for coding
zeroclaw benchmark run --task coding

# Compare models
zeroclaw benchmark compare --models "glm-4.7,codestral,claude-sonnet-4.6"

# Auto-adjust after 50 samples
[benchmarking]
enabled = true
auto_adjust_after = 50
log_failed_requests = true
```

## Troubleshooting

### Quota Not Tracking

```bash
# Check database
ls -la ~/.zeroclaw/quota.db

# Verify configuration
zeroclaw quota status
```

### Provider Not Working

```bash
# Test provider
zeroclaw providers --test

# Check logs
tail -f ~/.zeroclaw/logs/channel.log
```

### All Requests Use Free Models

Check quota status:
```bash
zeroclaw quota status
# If > 95%, reset quota: zeroclaw quota reset
```

## Environment Variables

```bash
# Required for Z.AI
export ZAI_API_KEY="your_key"

# Optional backups
export OPENROUTER_API_KEY="your_key"
export NVIDIA_API_KEY="your_key"
export MISTRAL_API_KEY="your_key"
```

## Cost Optimization Tips

1. **Use GLM-4.5-Air** for simple tasks (free)
2. **Enable benchmarking** to find best performing models
3. **Set appropriate quota thresholds** based on your budget
4. **Use Ollama** for local, free inference
5. **Monitor usage** with `zeroclaw metrics`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ZeroClaw Smart Routing                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │   Request    │─────>│  Classifier  │                    │
│  └──────────────┘      └──────────────┘                    │
│                                │                             │
│                                ▼                             │
│                        ┌──────────────┐                      │
│                        │ Quota State  │                      │
│                        │  Machine     │                      │
│                        └──────────────┘                      │
│                                │                             │
│                ┌───────────────┼───────────────┐             │
│                ▼               ▼               ▼             │
│          ┌─────────┐     ┌─────────┐     ┌─────────┐        │
│          │  Normal │     │Conserving│    │ Critical │        │
│          └────┬────┘     └────┬────┘     └────┬────┘        │
│               │               │               │              │
│               ▼               ▼               ▼              │
│          ┌─────────┐     ┌─────────┐     ┌─────────┐        │
│          │ GLM-4.7 │     │ GLM-4.5 │     │  Free   │        │
│          │ Claude  │     │ GLM-4.5V│     │ Ollama  │        │
│          │ Codestral│   │          │     │GLM-4.5Air│       │
│          └─────────┘     └─────────┘     └─────────┘        │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Benchmarking & Metrics                     │ │
│  │  - Response time tracking                               │ │
│  │  - Cost per token calculation                           │ │
│  │  - Success rate monitoring                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Advanced Configuration

### Per-Model Cost Tracking

```toml
[benchmarking.cost_per_token]
"glm-5" = { prompt = 0.002, completion = 0.006 }
"glm-4.7" = { prompt = 0.001, completion = 0.003 }
"glm-4.6" = { prompt = 0.0005, completion = 0.0015 }
"glm-4.5" = { prompt = 0.0003, completion = 0.0009 }
"glm-4.5v" = { prompt = 0.0005, completion = 0.0015 }
"glm-4.5-air" = { prompt = 0.0, completion = 0.0 }
"codestral" = { prompt = 0.001, completion = 0.003 }
```

### Custom Provider Limits

```toml
[quota_tracker.provider_limits]
zai = {
  requests_per_minute = 60,
  daily_tokens = 1000000,
  daily_requests = 10000
}
```

## Performance Tuning

### Increase Request Rate

```toml
[quota_tracker.provider_limits]
ollama = { requests_per_minute = 10000 }
```

### Reduce Quota Threshold

```toml
[quota_tracker]
threshold_percent = 70.0  # Switch at 70% instead of 80%
```

### Disable Auto-Switch

```toml
[quota_tracker]
enabled = false  # Always use default model
```

## Monitoring

### Log Files

- `~/.zeroclaw/logs/channel.log` - Channel activity
- `~/.zeroclaw/logs/daemon.log` - Daemon logs
- `~/.zeroclaw/quota.db` - SQLite quota database

### Real-Time Monitoring

```bash
# Watch quota usage
watch -n 5 'zeroclaw quota status'

# Monitor channel logs
tail -f ~/.zeroclaw/logs/channel.log

# Track provider usage
zeroclaw metrics --period 1
```

## Integration Examples

### Python

```python
import os
os.environ['ZAI_API_KEY'] = 'your_key'

# Use default model (GLM-4.7)
# ZeroClaw automatically switches based on quota
```

### Telegram

```bash
# Bind your account
# Send to @your_bot: /bind <code>

# Chat with ZeroClaw
# Automatic routing based on task type
```

### Web Dashboard

Chats persist across refreshes using localStorage with automatic backend synchronization.

## Best Practices

1. **Start with GLM-4.7** - Best balance of performance and cost
2. **Monitor quota daily** - Check `zeroclaw quota status`
3. **Use free models for testing** - GLM-4.5-Air, Ollama
4. **Enable benchmarking** - Optimize model selection over time
5. **Set appropriate limits** - Match your budget and usage patterns

## FAQ

**Q: How do I know which model was used?**
A: Check the logs: `grep "model" ~/.zeroclaw/logs/channel.log`

**Q: Can I force a specific model?**
A: Yes, specify it in your request or set as default in config

**Q: What happens when quota runs out?**
A: Automatic switch to free models (Ollama, GLM-4.5-Air)

**Q: How accurate are the benchmarks?**
A: Improves over time, minimum 50 samples for reliable data

**Q: Can I add custom providers?**
A: Yes, use the `custom:` prefix in model_providers

## Support

- **Docs:** `~/.zeroclaw/docs/`
- **Logs:** `~/.zeroclaw/logs/`
- **Config:** `~/.zeroclaw/config.toml`
- **Issues:** Check logs first, then review configuration

## Version History

- **v0.1.7** - Initial smart routing implementation
- GLM-4.7 as default model
- Multi-provider support (Z.AI, OpenRouter, NVIDIA, Mistral)
- Automatic quota-based fallback
- Benchmark-based optimization
