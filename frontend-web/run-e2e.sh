#!/bin/bash
# ZeroClaw Dashboard E2E Test Runner

set -e

echo "🚀 ZeroClaw Dashboard - E2E Test Runner"
echo "========================================"
echo ""

# Check if daemon is running
if ! pgrep -f "zeroclaw daemon" > /dev/null; then
    echo "❌ ZeroClaw daemon is not running!"
    echo "   Start daemon with: zeroclaw daemon"
    exit 1
fi

echo "✅ ZeroClaw daemon is running"
echo ""

# Check if web directory exists
if [ ! -d "web" ]; then
    echo "❌ web/ directory not found!"
    echo "   Run this script from the workspace root"
    exit 1
fi

cd web

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found!"
    echo "   Running: npm install"
    npm install
fi

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright" ]; then
    echo "❌ Playwright not installed!"
    echo "   Running: npx playwright install"
    npx playwright install
fi

echo ""
echo "🧪 Running E2E tests..."
echo ""

# Run tests
npm run test:e2e

echo ""
echo "========================================"
echo "✅ Tests completed!"
echo ""
echo "📊 View report with: npx playwright show-report"
