# Quota Tracking & Usage Management

ZeroClaw automatically tracks API token usage, request counts, and costs across all providers to prevent overages and optimize spending.

## Overview

The quota tracking system:
- **Monitors** token usage in real-time
- **Calculates** daily and cumulative statistics
- **Manages** rate limits per provider
- **Automatically switches** to free models when quota is exhausted
- **Persists** all data to SQLite for analysis

## Quick Start

### Check Current Status

```bash
zeroclaw quota status
```

Output:
```
Quota Usage Report
==================
Daily Tokens:     45,230 / 1,000,000 (4.5%)
Daily Requests:   123 / 10,000
Quota State:      Normal (4.5%)
Reset Time:       2026-03-14 00:00:00 UTC

Provider Status:
  Z.AI:        ✅ 23,451 tokens (23 req/min)
  OpenRouter:  ✅ 12,340 tokens (18 req/min)
  NVIDIA:      ✅ 5,432 tokens (32 req/min)
  Mistral:     ✅ 4,007 tokens (25 req/min)
```

### Reset Daily Counters

```bash
zeroclaw quota reset
```

## Configuration

### Enable Quota Tracking

Edit `~/.zeroclaw/config.toml`:

```toml
[quota_tracker]
enabled = true
daily_quota_estimate = 1000000  # Your daily token budget
threshold_percent = 80.0          # Switch to free models at 80%
cache_path = "~/.zeroclaw/quota.db"
```

### Provider Limits

Configure rate limits and quotas per provider:

```toml
[quota_tracker.provider_limits]
zai = {
  requests_per_minute = 60,
  daily_tokens = 1000000,
  daily_requests = 10000
}

openrouter = {
  requests_per_minute = 20,
  requests_per_day = 50,
  daily_tokens = 500000
}

nvidia = {
  requests_per_minute = 40
}

mistral = {
  requests_per_minute = 30,
  requests_per_day = 2000,
  daily_tokens = 500000
}

ollama = {
  requests_per_minute = 1000  # Local, no limit
}
```

## Quota States

### Normal (0-80%)
- Full access to all paid models
- No restrictions
- Optimal performance

**Example:**
```
Usage: 450,000 / 1,000,000 tokens (45%)
State: Normal
Allowed Models: GLM-4.7, GLM-5, Claude, Codestral
```

### Conserving (80-95%)
- Prefers cost-efficient models
- Avoids expensive models
- Warns about approaching limits

**Example:**
```
Usage: 875,000 / 1,000,000 tokens (87.5%)
State: Conserving
Allowed Models: GLM-4.5, GLM-4.5V, Codestral
Restricted: GLM-5, Claude Opus
```

### Critical (95%+)
- Only free models
- Ollama (local)
- GLM-4.5-Air (free tier)

**Example:**
```
Usage: 970,000 / 1,000,000 tokens (97%)
State: Critical
Allowed Models: GLM-4.5-Air, Ollama (local)
```

### Unknown
- No quota data available
- Uses default behavior (Normal state)
- Occurs on first run or after reset

## CLI Commands

### Status

```bash
zeroclaw quota status
```

Show current quota usage, state, and provider status.

### Reset

```bash
zeroclaw quota reset
```

Reset all daily counters to zero. Useful for:
- Starting a new billing period
- Testing quota tracking
- Clearing erroneous data

### Detailed Statistics

```bash
zeroclaw metrics --period 7
```

View usage metrics over the last N days.

## Database Schema

### quota_usage Table

```sql
CREATE TABLE quota_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,        -- YYYY-MM-DD
    provider TEXT NOT NULL,            -- Provider name
    tokens_used INTEGER NOT NULL,      -- Total tokens used
    requests_count INTEGER NOT NULL,   -- Number of requests
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### request_log Table

```sql
CREATE TABLE request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    tokens INTEGER,
    success INTEGER,
    error_message TEXT
);
```

## API Usage

### Recording Usage

```rust
use quota_tracker::{QuotaTracker, Provider};

let tracker = QuotaTracker::new(config)?;

// After each API request
tracker.record_usage(
    Provider::Zai,
    prompt_tokens,     // e.g., 150
    completion_tokens  // e.g., 300
)?;
```

### Checking State

```rust
let state = tracker.get_state();

match state {
    QuotaState::Normal => {
        // Use best models
        use_model("glm-4.7");
    }
    QuotaState::Conserving => {
        // Use efficient models
        use_model("glm-4.5");
    }
    QuotaState::Critical => {
        // Use free models
        use_model("glm-4.5-air");
    }
    QuotaState::Unknown => {
        // Assume normal
        use_model("glm-4.7");
    }
}
```

### Rate Limiting

```rust
if tracker.can_make_request(Provider::Zai) {
    // Make request
    tracker.record_request(Provider::Zai);
} else {
    // Check wait time
    if let Some(wait_time) = tracker.get_wait_time(Provider::Zai) {
        println!("Must wait {:?}", wait_time);
    }
}
```

## Integration with Smart Routing

The quota tracker integrates with smart routing to automatically switch models:

```
Request Received
    ↓
Check Quota State
    ↓
┌─────────────┬──────────────┬──────────────┐
│   Normal    │  Conserving  │   Critical   │
│  (0-80%)    │   (80-95%)   │   (95%+)     │
└─────────────┴──────────────┴──────────────┘
    ↓              ↓               ↓
GLM-4.7         GLM-4.5         GLM-4.5-Air
GLM-5           GLM-4.5V        Ollama
Claude         Codestral
```

## Monitoring

### Real-Time Monitoring

```bash
# Watch quota usage
watch -n 5 'zeroclaw quota status'

# Monitor logs
tail -f ~/.zeroclaw/logs/channel.log | grep quota
```

### Historical Analysis

```bash
# Query database directly
sqlite3 ~/.zeroclaw/quota.db

SELECT date, provider, tokens_used, requests_count
FROM quota_usage
ORDER BY date DESC, provider
LIMIT 20;

# Calculate daily totals
SELECT date, SUM(tokens_used) as total_tokens, SUM(requests_count) as total_requests
FROM quota_usage
GROUP BY date
ORDER BY date DESC;
```

### Export Data

```bash
# Export to CSV
sqlite3 ~/.zeroclaw/quota.db \
  -header -csv \
  "SELECT * FROM quota_usage" \
  > quota_usage.csv
```

## Troubleshooting

### Quota Not Tracking

**Problem:** Usage always shows 0

**Solutions:**
```bash
# Check database exists
ls -la ~/.zeroclaw/quota.db

# Verify tracking is enabled
grep "enabled" ~/.zeroclaw/config.toml

# Check logs for errors
tail -f ~/.zeroclaw/logs/channel.log | grep -i quota

# Reset and restart
zeroclaw quota reset
pkill -f zeroclaw
zeroclaw channel start &
```

### Incorrect Totals

**Problem:** Token counts seem wrong

**Solutions:**
```bash
# Verify tokens are being recorded
sqlite3 ~/.zeroclaw/quota.db "SELECT * FROM request_log ORDER BY timestamp DESC LIMIT 10"

# Check for duplicate records
sqlite3 ~/.zeroclaw/quota.db "SELECT date, provider, COUNT(*) FROM quota_usage GROUP BY date, provider HAVING COUNT(*) > 1"

# Reset if needed
zeroclaw quota reset
```

### Rate Limiting Issues

**Problem:** Requests failing with rate limit errors

**Solutions:**
```bash
# Check current limits
zeroclaw providers

# Adjust limits in config
# Edit [quota_tracker.provider_limits] in config.toml

# Check wait time
sqlite3 ~/.zeroclaw/quota.db "SELECT timestamp, provider FROM request_log ORDER BY timestamp DESC LIMIT 20"
```

## Best Practices

### Set Appropriate Limits

```toml
# Match your API plan limits
[quota_tracker.provider_limits]
zai = {
  requests_per_minute = 60,      # Your plan limit
  daily_tokens = 1000000,         # Your daily quota
  daily_requests = 10000          # Your request limit
}
```

### Monitor Regularly

```bash
# Add to crontab for daily reports
0 9 * * * zeroclaw quota status > ~/quota_report.txt
```

### Use Alerts

```bash
# Check if quota is high
USAGE=$(zeroclaw quota status | grep "Usage:" | awk '{print $2}' | tr -d '%')
if [ $USAGE -gt 80 ]; then
    echo "Warning: Quota at ${USAGE}%" | mail -s "ZeroClaw Quota Alert" admin@example.com
fi
```

### Plan for Growth

```toml
# Set limits lower than actual to provide buffer
[quota_tracker]
daily_quota_estimate = 900000  # Set to 90% of actual 1M limit
threshold_percent = 75.0        # Switch to conservation at 75% instead of 80%
```

## Advanced Configuration

### Custom Database Path

```toml
[quota_tracker]
cache_path = "/var/lib/zeroclaw/quota.db"
```

### Automatic Cleanup

```bash
# Clean old log entries (older than 30 days)
sqlite3 ~/.zeroclaw/quota.db "DELETE FROM request_log WHERE timestamp < datetime('now', '-30 days')"

# Vacuum database
sqlite3 ~/.zeroclaw/quota.db "VACUUM"
```

### Multiple Environments

```bash
# Development
export ZEROCLAW_ENV=dev
export ZEROCLAW_QUOTA_DB=~/.zeroclaw/dev_quota.db

# Production
export ZEROCLAW_ENV=prod
export ZEROCLAW_QUOTA_DB=/var/lib/zeroclaw/quota.db
```

## Performance Considerations

### Database Size

Typical database size after 30 days:
- ~100-500 KB for moderate usage
- ~1-2 MB for heavy usage
- Grows with `request_log` entries

### Optimization

```toml
[quota_tracker]
# Enable cleanup
auto_cleanup = true
retention_days = 30
```

### Batch Operations

When recording many requests:

```rust
// Use transaction for better performance
conn.execute_batch("
  BEGIN;
  INSERT INTO request_log ...;
  INSERT INTO request_log ...;
  INSERT INTO request_log ...;
  COMMIT;
")?;
```

## Integration Examples

### Python Script

```python
import subprocess
import json

def check_quota():
    result = subprocess.run(['zeroclaw', 'quota', 'status'],
                          capture_output=True, text=True)
    print(result.stdout)
    # Parse output if needed
    return parse_quota_status(result.stdout)

if __name__ == '__main__':
    status = check_quota()
    if status['usage_percent'] > 80:
        print("Warning: Approaching quota limit!")
```

### Prometheus Metrics

ZeroClaw exports quota metrics to Prometheus:

```
# HELP zeroclaw_quota_usage_tokens Total tokens used
# TYPE zeroclaw_quota_usage_tokens gauge
zeroclaw_quota_usage_tokens{provider="zai"} 45230

# HELP zeroclaw_quota_usage_requests Total requests made
# TYPE zeroclaw_quota_usage_requests gauge
zeroclaw_quota_usage_requests{provider="zai"} 123

# HELP zeroclaw_quota_state Current quota state
# TYPE zeroclaw_quota_state gauge
zeroclaw_quota_state{state="Normal"} 1
```

## FAQ

**Q: How accurate is the tracking?**
A: Very accurate. Every token from every request is recorded.

**Q: Does tracking affect performance?**
A: Minimal impact. SQLite operations are fast and asynchronous.

**Q: Can I export data for billing?**
A: Yes. Query the database or use CSV export.

**Q: What happens if quota.db is corrupted?**
A: ZeroClaw will recreate it. Use `zeroclaw quota reset` to start fresh.

**Q: Can I track multiple billing periods?**
A: Yes. Data is stored by date, so you can query any period.

**Q: How do I set alerts?**
A: Use cron jobs or external monitoring tools to check `zeroclaw quota status`.

**Q: Can I customize the thresholds?**
A: Yes. Edit `threshold_percent` in `config.toml`.

**Q: Does tracking work across restarts?**
A: Yes. All data is persisted to SQLite.

**Q: Can I disable tracking for specific providers?**
A: Not directly. Set very high limits for providers you don't want to track.

## Related Documentation

- [Smart Routing Guide](./smart-routing-guide.md)
- [CLAUDE.md](../CLAUDE.md)
- [Benchmarking Guide](./benchmarking.md) - [TODO]

## Support

### Issues
Check logs: `~/.zeroclaw/logs/channel.log`
Database location: `~/.zeroclaw/quota.db`

### Debug Mode
```bash
export RUST_LOG=quota_tracker=trace
zeroclaw channel start
```

---

**Last Updated:** 2026-03-13
**Version:** 0.1.7
