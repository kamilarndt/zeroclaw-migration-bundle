#!/bin/bash

# Open WebUI Configuration - Usage Examples
# This script demonstrates various ways to use the Open WebUI automation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR"

echo "=================================================="
echo "Open WebUI Configuration - Usage Examples"
echo "=================================================="
echo ""

# Check if Playwright is installed
echo "1. Checking Playwright installation..."
if npm list @playwright/test &>/dev/null; then
    echo "   ✅ Playwright is installed"
else
    echo "   ❌ Playwright not found. Installing..."
    npm install --save-dev @playwright/test
    npx playwright install chromium
fi
echo ""

# Check if services are running
echo "2. Checking services..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200\|302\|301"; then
    echo "   ✅ Open WebUI is running on http://localhost:8080"
else
    echo "   ⚠️  Open WebUI may not be running on http://localhost:8080"
    echo "      Start it with: docker run -d -p 8080:8080 ghcr.io/open-webui/open-webui:main"
fi

if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:42618/v1/models | grep -q "200"; then
    echo "   ✅ ZeroClaw is running on http://127.0.0.1:42618/v1"
else
    echo "   ⚠️  ZeroClaw may not be running on http://127.0.0.1:42618/v1"
    echo "      Start it with: cargo run --bin zeroclaw"
fi
echo ""

# Show examples
echo "3. Usage Examples:"
echo ""
echo "   A) Quick Start (with defaults):"
echo "      npm run config:openwebui"
echo ""
echo "   B) With custom password:"
echo "      npm run config:openwebui -- --password your-password"
echo ""
echo "   C) With Docker networking:"
echo "      npm run config:openwebui:docker"
echo ""
echo "   D) Full custom configuration:"
echo "      node scripts/configure_open_webui.js \\"
echo "        --url http://localhost:8080 \\"
echo "        --username admin \\"
echo "        --password your-password \\"
echo "        --api-url http://127.0.0.1:42618/v1 \\"
echo "        --api-key sk-your-token"
echo ""
echo "   E) Debug mode (see browser):"
echo "      npm run config:openwebui:visible"
echo ""
echo "   F) Run E2E tests:"
echo "      npm run test:e2e"
echo ""
echo "   G) Run tests with visible browser:"
echo "      npm run test:e2e:headed"
echo ""

# Interactive mode
if [[ "${1}" == "--interactive" ]] || [[ "${1}" == "-i" ]]; then
    echo "4. Interactive Configuration"
    echo "=================================================="
    echo ""

    # Prompt for configuration
    read -p "Open WebUI URL [http://localhost:8080]: " webui_url
    webui_url=${webui_url:-http://localhost:8080}

    read -p "Username [admin]: " username
    username=${username:-admin}

    read -sp "Password [password]: " password
    password=${password:-password}
    echo ""

    read -p "API URL [http://127.0.0.1:42618/v1]: " api_url
    api_url=${api_url:-http://127.0.0.1:42618/v1}

    read -p "API Key [sk-test-key]: " api_key
    api_key=${api_key:-sk-test-key}

    read -p "Run in visible browser? [y/N]: " visible
    if [[ "$visible" =~ ^[Yy]$ ]]; then
        visible_flag="--no-headless"
    else
        visible_flag=""
    fi

    echo ""
    echo "Running configuration with:"
    echo "  URL: $webui_url"
    echo "  Username: $username"
    echo "  API URL: $api_url"
    echo "  API Key: ${api_key:0:10}..."
    echo ""

    node scripts/configure_open_webui.js \
        --url "$webui_url" \
        --username "$username" \
        --password "$password" \
        --api-url "$api_url" \
        --api-key "$api_key" \
        $visible_flag

else
    echo "4. Quick Test:"
    echo "=================================================="
    echo ""
    echo "To run a quick test with default values, execute:"
    echo ""
    echo "   npm run config:openwebui"
    echo ""
    echo "For interactive mode, run:"
    echo "   $0 --interactive"
    echo ""
fi

echo "=================================================="
echo "Documentation:"
echo "  - Quick Start: tests/playwright/QUICK_START.md"
echo "  - Full Docs:   tests/playwright/OPEN_WEBUI_CONFIG_README.md"
echo "=================================================="
