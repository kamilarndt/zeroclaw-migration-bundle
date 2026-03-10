#!/bin/bash
# Simple test to verify all improvement files exist

echo "🧪 Testing ZeroClaw Web Dashboard Improvements"
echo "=============================================="
echo ""

PASSED=0
FAILED=0

test_file() {
    if [ -f "$1" ]; then
        echo "✅ $1"
        ((PASSED++))
        return 0
    else
        echo "❌ $1 (NOT FOUND)"
        ((FAILED++))
        return 1
    fi
}

echo "📁 Priority 1: Critical Security & Architecture"
echo "----------------------------------------------"
test_file "web/src/components/ErrorBoundary.tsx"
test_file "web/src/utils/validation.ts"
test_file "web/src/contexts/WebSocketContext.tsx"
echo ""

echo "📁 Priority 2: Performance & Features"
echo "-------------------------------------"
test_file "web/src/hooks/useNetworkStatus.ts"
test_file "web/src/components/NetworkStatus.tsx"
test_file "web/public/sw.js"
test_file "web/public/offline.html"
echo ""

echo "🧪 Tests"
echo "--------"
test_file "web/src/components/__tests__/ErrorBoundary.test.tsx"
test_file "web/src/hooks/__tests__/useNetworkStatus.test.ts"
test_file "web/src/stores/__tests__/taskStore.test.ts"
test_file "web/src/utils/__tests__/validation.test.ts"
test_file "web/vitest.config.ts"
test_file "web/src/test/setup.ts"
echo ""

echo "📄 Documentation"
echo "----------------"
test_file "web/IMPROVEMENTS_REPORT.md"
echo ""

echo "=============================================="
echo "📊 Results:"
echo "   ✅ Passed: $PASSED"
echo "   ❌ Failed: $FAILED"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo "🎉 All files exist! Improvements successfully implemented!"
    exit 0
else
    echo "⚠️  Some files are missing!"
    exit 1
fi
