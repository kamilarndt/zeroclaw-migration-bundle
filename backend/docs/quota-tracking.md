# Quota Tracking

ZeroClaw automatically tracks API usage.

## CLI Commands
```bash
zeroclaw quota status   # Show usage
zeroclaw quota reset    # Reset counters
```

## Configuration
```toml
[quota_tracker]
enabled = true
daily_quota_estimate = 1000000
threshold_percent = 80.0
```
