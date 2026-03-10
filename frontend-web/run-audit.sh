#!/bin/bash

# Skrypt do uruchomienia pełnego audytu Playwright dla dash.karndt.pl

echo "🔍 Rozpoczynam pełen audyt dashboardu ZeroClaw..."
echo "📍 URL: https://dash.karndt.pl"
echo "⏰ Czas rozpoczęcia: $(date)"

# Sprawdź czy jesteśmy w odpowiednim folderze
if [ ! -f "playwright-audit.config.ts" ]; then
    echo "❌ Brak pliku konfiguracyjnego Playwright. Uruchom z folderu web/"
    exit 1
fi

# Sprawdź czy zainstalowano Playwright
if ! npm list @playwright/test > /dev/null 2>&1; then
    echo "📦 Instaluję Playwright..."
    npm install @playwright/test
fi

# Sprawdź czy zainstalowano przeglądarki
if [ ! -d "node_modules/playwright" ]; then
    echo "🌐 Instaluję przeglądarki Playwright..."
    npx playwright install chromium
fi

echo "🚀 Uruchamiam testy audytowe..."
echo "=================================="

# Uruchom testy z naszą konfiguracją
npx playwright test --config=playwright-audit.config.ts

echo "=================================="
echo "📊 Generuję raport HTML..."
npx playwright show-report

echo "✅ Audyt zakończony!"
echo "📁 Raport dostępny w: playwright-report/index.html"