# Quick Start: Open WebUI Configuration

## Prerequisites Check

```bash
# 1. Verify Playwright is installed
npm list @playwright/test

# 2. Verify Chromium is installed
npx playwright install chromium

# 3. Check if Open WebUI is running
curl -I http://localhost:8080

# 4. Check if ZeroClaw is running
curl http://127.0.0.1:42618/v1/models
```

## Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
cd /home/ubuntu/zeroclaw-migration-bundle/backend
npm install
npx playwright install chromium
```

### Step 2: Start Services

```bash
# Start ZeroClaw (if not running)
cargo run --bin zeroclaw

# Start Open WebUI (if not running)
docker run -d -p 8080:8080 --name open-webui ghcr.io/open-webui/open-webui:main
```

### Step 3: Configure

```bash
# Method 1: Using npm script (recommended)
npm run config:openwebui

# Method 2: Direct script execution
node scripts/configure_open_webui.js

# Method 3: With custom settings
npm run config:openwebui -- --password your-password --api-key sk-your-token
```

### Step 4: Verify

```bash
# Check ZeroClaw logs for incoming requests
docker logs zeroclaw -f

# Or open browser and test
xdg-open http://localhost:8080
```

## Common Scenarios

### Local Development

Both Open WebUI and ZeroClaw running locally:

```bash
node scripts/configure_open_webui.js \
  --password admin123 \
  --api-key sk-dev-token
```

### Docker Setup

Open WebUI in Docker, ZeroClaw on host:

```bash
npm run config:openwebui:docker
```

### Debug Mode

See what's happening:

```bash
npm run config:openwebui:visible
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Could not find username input" | Run with `--no-headless` to debug |
| "Connection not working" | Check ZeroClaw logs, verify URL |
| "host.docker.internal not working" | Use actual host IP instead |

## Files Created

- `tests/playwright/open_webui_config.spec.ts` - TypeScript test
- `tests/playwright/open_webui_config.spec.js` - JavaScript test
- `scripts/configure_open_webui.js` - Standalone script
- `tests/playwright/OPEN_WEBUI_CONFIG_README.md` - Full documentation
- `.env.openwebui.example` - Environment variables template

## Need Help?

See full documentation: `tests/playwright/OPEN_WEBUI_CONFIG_README.md`
