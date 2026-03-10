# ZeroClaw Dashboard - Playwright E2E Tests

## Prerequisites

- Node.js 18+
- ZeroClaw daemon running on port 42617
- Web dev server (Vite) will be started automatically by Playwright

## Installation

```bash
cd web
npm install
npx playwright install
```

## Running Tests

### Run all tests (recommended)
```bash
cd web
npm run test:e2e
```

### Run specific test file
```bash
cd web
npx playwright test e2e/dashboard.spec.ts
```

### Run in headed mode (watch browser)
```bash
cd web
npx playwright test --headed
```

### Run with UI
```bash
cd web
npx playwright test --ui
```

### Debug mode
```bash
cd web
npx playwright test --debug
```

## Test Reports

### HTML Report
```bash
npx playwright show-report
```

## Test Files

- `e2e/dashboard.spec.ts` - Dashboard UI tests
- `e2e/api.spec.ts` - API endpoint tests

## Configuration

`playwright.config.ts` includes:
- Automatic web server startup (Vite on port 3001)
- Proxy configuration for API calls
- Screenshot on failure
- Trace on first retry
- Multiple browser testing (Chromium, Firefox, WebKit)

## Troubleshooting

**Tests fail with "connection refused"**
- Make sure ZeroClaw daemon is running: `pgrep -f "zeroclaw daemon"`
- Check if daemon is listening on port 42617: `curl http://127.0.0.1:42617/health`

**Tests hang on startup**
- Increase webServer timeout in playwright.config.ts
- Check if another process is using port 3001

**Playwright browsers not found**
- Run: `npx playwright install`
- Or install specific browsers: `npx playwright install chromium`
