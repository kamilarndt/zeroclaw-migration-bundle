# Open WebUI Configuration E2E Tests

This directory contains End-to-End (E2E) tests for configuring Open WebUI with OpenAI API connections using Playwright.

## Overview

The automation scripts configure Open WebUI to connect to a ZeroClaw instance by:
1. Logging into Open WebUI
2. Navigating to Admin Panel -> Settings -> Connections
3. Adding a new OpenAI API connection with the specified base URL and API key
4. Saving and verifying the configuration

## Files

- `open_webui_config.spec.ts` - TypeScript Playwright test (recommended)
- `open_webui_config.spec.js` - JavaScript Playwright test
- `../../scripts/configure_open_webui.js` - Standalone configuration script

## Prerequisites

### 1. Install Dependencies

```bash
cd /home/ubuntu/zeroclaw-migration-bundle/backend
npm install --save-dev @playwright/test
npx playwright install chromium
```

### 2. Start Open WebUI

Make sure Open WebUI is running:

```bash
# Using Docker
docker run -d -p 8080:8080 --name open-webui ghcr.io/open-webui/open-webui:main

# Or using the existing setup
cd /home/ubuntu/zeroclaw-migration-bundle/backend
# Check if Open WebUI is already running
docker ps | grep open-webui
```

### 3. Start ZeroClaw

Ensure ZeroClaw is running and listening on port 42618:

```bash
cargo run --bin zeroclaw
```

## Usage

### Method 1: Standalone Script (Recommended)

The standalone script is the easiest way to configure Open WebUI:

```bash
# Using defaults (headless mode)
node scripts/configure_open_webui.js

# With custom URL and credentials
node scripts/configure_open_webui.js \
  --url http://localhost:8080 \
  --username admin \
  --password your-password

# Configure with Docker host URL
node scripts/configure_open_webui.js \
  --api-url http://host.docker.internal:42618/v1 \
  --api-key sk-your-pairing-token

# Run with visible browser for debugging
node scripts/configure_open_webui.js --no-headless
```

#### Command-Line Options

```
--url, --base-url <url>       Open WebUI base URL (default: http://localhost:8080)
--username, -u <username>     Admin username (default: admin)
--password, -p <password>     Admin password (default: password)
--api-url <url>               OpenAI API base URL (default: http://127.0.0.1:42618/v1)
--api-key, -k <key>           API key / pairing token
--headless                    Run in headless mode (default)
--no-headless, --visible      Run with visible browser
--help, -h                    Show help message
```

#### Environment Variables

```bash
export OPEN_WEBUI_URL="http://localhost:8080"
export OPEN_WEBUI_USERNAME="admin"
export OPEN_WEBUI_PASSWORD="your-password"
export OPENAI_API_URL="http://127.0.0.1:42618/v1"
export OPENAI_API_KEY="sk-your-pairing-token"
export HEADLESS="false"  # Set to "false" for visible browser

node scripts/configure_open_webui.js
```

### Method 2: Playwright Tests

Run the Playwright test suite:

```bash
# Run all tests in headless mode
npx playwright test open_webui_config.spec.js

# Run with visible browser
npx playwright test open_webui_config.spec.js --headed

# Run with debug mode
npx playwright test open_webui_config.spec.js --debug

# Run specific test
npx playwright test open_webui_config.spec.js -g "should configure OpenAI API connection"
```

### Method 3: TypeScript Test

If you prefer TypeScript:

```bash
# Install TypeScript dependencies
npm install --save-dev typescript

# Run TypeScript test
npx playwright test open_webui_config.spec.ts
```

## Configuration Examples

### Local Development

```bash
node scripts/configure_open_webui.js \
  --url http://localhost:8080 \
  --username admin \
  --password admin123 \
  --api-url http://127.0.0.1:42618/v1 \
  --api-key sk-dev-token-12345
```

### Docker Setup

When Open WebUI is running in Docker and ZeroClaw on the host:

```bash
node scripts/configure_open_webui.js \
  --api-url http://host.docker.internal:42618/v1
```

### Both in Docker

If both are running in Docker (using Docker network):

```bash
node scripts/configure_open_webui.js \
  --api-url http://zeroclaw:42618/v1
```

### Remote Server

```bash
node scripts/configure_open_webui.js \
  --url https://open-webui.example.com \
  --username admin \
  --password secure-password \
  --api-url https://zeroclaw.example.com/v1 \
  --api-key sk-remote-token-67890
```

## Troubleshooting

### Issue: "Could not find username input field"

**Solution**: The Open WebUI UI may have changed or the page hasn't loaded. Try:
- Running with `--no-headless` to see what's happening
- Increasing wait time in the script
- Checking if Open WebUI is running at the correct URL
- Verifying the login page structure hasn't changed

### Issue: "Could not find Save button"

**Solution**: The form structure may be different. Try:
- Taking screenshots to see the current state
- Running with `--no-headless` to debug
- Checking the Open WebUI documentation for UI changes
- Manually adding the connection and noting the selectors used

### Issue: Connection not working after configuration

**Solution**: Verify:
1. The Base URL is correct and accessible from Open WebUI
2. The API key is valid (check ZeroClaw logs)
3. No firewall/network issues between Open WebUI and ZeroClaw
4. ZeroClaw is running and listening on the correct port

### Issue: Docker host.docker.internal not working

**Solution**: On Linux, you may need to:
```bash
# Add host alias to Docker daemon
# Or use the actual host IP address
node scripts/configure_open_webui.js \
  --api-url http://192.168.1.100:42618/v1  # Use your host IP
```

### Debug Mode

To see what's happening in real-time:

```bash
# Run with visible browser and slow motion
node scripts/configure_open_webui.js --no-headless

# Or use Playwright's debug mode
npx playwright test open_webui_config.spec.js --debug
```

## Screenshots

Screenshots are automatically saved to `tests/playwright/screenshots/` with timestamps:
- `01_page_loaded_*.png` - Initial page load
- `02_after_login_*.png` - After successful login
- `03_admin_panel_*.png` - Admin panel page
- `04_connections_page_*.png` - Connections settings
- `05_add_connection_form_*.png` - Add connection form
- `06_form_filled_*.png` - Form with values filled
- `07_after_save_*.png` - After saving
- `08_final_state_*.png` - Final page state
- `error_*.png` - Error screenshot (if failed)

## Verification Steps

After running the configuration script:

1. **Manual Verification**:
   ```bash
   # Open in browser
   xdg-open http://localhost:8080/admin  # Linux
   open http://localhost:8080/admin      # macOS
   start http://localhost:8080/admin     # Windows
   ```
   Navigate to Settings -> Connections and verify the new connection appears

2. **Test Chat**:
   - Send a message through Open WebUI
   - Check if it reaches ZeroClaw (monitor ZeroClaw logs)

3. **Check ZeroClaw Logs**:
   ```bash
   docker logs zeroclaw -f
   # Or if running directly
   cargo run --bin zeroclaw
   ```

4. **Verify API Response**:
   ```bash
   curl http://127.0.0.1:42618/v1/models
   # Should list available models
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Configure Open WebUI

on:
  workflow_dispatch:

jobs:
  configure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd backend
          npm install
          npx playwright install chromium

      - name: Start Open WebUI
        run: |
          docker run -d -p 8080:8080 ghcr.io/open-webui/open-webui:main

      - name: Start ZeroClaw
        run: |
          cargo run --bin zeroclaw &
          sleep 10

      - name: Configure Open WebUI
        run: |
          node scripts/configure_open_webui.js \
            --url http://localhost:8080 \
            --username ${{ secrets.OPEN_WEBUI_USERNAME }} \
            --password ${{ secrets.OPEN_WEBUI_PASSWORD }} \
            --api-url http://127.0.0.1:42618/v1 \
            --api-key ${{ secrets.OPENAI_API_KEY }}
        env:
          OPEN_WEBUI_USERNAME: admin
          OPEN_WEBUI_PASSWORD: ${{ secrets.OPEN_WEBUI_PASSWORD }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Advanced Usage

### Custom Selectors

If Open WebUI's UI changes, you can update the selectors in the script. The script tries multiple selectors for each element, so it's usually resilient to minor changes.

### Multiple Connections

To add multiple connections, modify the script to loop through a list of configurations:

```javascript
const connections = [
  { name: 'ZeroClaw Primary', url: 'http://127.0.0.1:42618/v1' },
  { name: 'ZeroClaw Backup', url: 'http://127.0.0.1:42619/v1' },
];

for (const conn of connections) {
  await addOpenAIConnection(page, {
    ...config,
    apiUrl: conn.url,
  });
}
```

### Automated Testing

Add to your test suite:

```javascript
// In your existing tests
test.beforeAll(async () => {
  // Configure Open WebUI before running tests
  const { configureOpenWebUI } = require('./tests/playwright/open_webui_config.spec.js');
  await configureOpenWebUI();
});
```

## Support

For issues or questions:
1. Check the screenshots in `tests/playwright/screenshots/`
2. Run with `--no-headless` to see what's happening
3. Check ZeroClaw logs: `docker logs zeroclaw`
4. Verify Open WebUI is accessible
5. Review Open WebUI documentation for any UI changes

## Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [Open WebUI Documentation](https://docs.openwebui.com/)
- [ZeroClaw Documentation](./README.md)
