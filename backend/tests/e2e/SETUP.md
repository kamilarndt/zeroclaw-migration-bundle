# ZeroClaw OS E2E Test Infrastructure Setup

Comprehensive guide for setting up and running end-to-end tests with Playwright for ZeroClaw OS, covering multi-channel testing (PWA Dashboard + Telegram bot).

## Table of Contents

1. [Playwright Setup](#1-playwright-setup)
2. [Test Fixtures](#2-test-fixtures)
3. [Test Structure](#3-test-structure)
4. [Parallel Execution Strategy](#4-parallel-execution-strategy)
5. [Running Tests](#5-running-tests)
6. [CI/CD Integration](#6-cicd-integration)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Playwright Setup

### 1.1 Installation

Install Playwright in the web directory:

```bash
cd /tmp/zeroclaw-src/web

# Install Playwright and TypeScript dependencies
npm install --save-dev @playwright/test

# Install browser binaries
npx playwright install chromium

# Install system dependencies (Linux/WSL2)
npx playwright install-deps
```

### 1.2 Configuration Files

Create `/tmp/zeroclaw-src/web/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'telegram-test',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/telegram-storage.json',
        baseURL: 'https://web.telegram.org/a/',
      },
    },
  ],

  // Global setup for database seeding
  globalSetup: '../tests/e2e/global-setup.ts',
  globalTeardown: '../tests/e2e/global-teardown.ts',

  outputDir: 'test-results',
});
```

### 1.3 TypeScript Configuration

Update `/tmp/zeroclaw-src/web/tsconfig.json` to include Playwright types:

```json
{
  "compilerOptions": {
    "types": ["@playwright/test", "node"]
  }
}
```

### 1.4 Environment Variables

Create `/tmp/zeroclaw-src/.env.test`:

```bash
# Test Database Paths
TEST_SQLITE_DB=/tmp/zeroclaw_test.db
TEST_QDRANT_HOST=localhost:6334

# Test Credentials
TEST_PWA_USERNAME=test_user
TEST_PWA_PASSWORD=test_password_123
TEST_TELEGRAM_BOT_TOKEN=<your_test_bot_token>
TEST_TELEGRAM_USER_ID=<your_test_user_id>

# API Endpoints
API_BASE_URL=http://localhost:8080
WS_URL=ws://localhost:8080/ws

# Feature Flags
ENABLE_QDRANT=true
ENABLE_TELEGRAM=true
```

### 1.5 Test Scripts

Add to `/tmp/zeroclaw-src/web/package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:telegram": "playwright test --project=telegram-test",
    "test:e2e:report": "playwright show-report"
  }
}
```

---

## 2. Test Fixtures

### 2.1 Database Seed Script

Create `/tmp/zeroclaw-src/tests/e2e/fixtures/seed-database.ts`:

```typescript
import Database from 'better-sqlite3';
import { QdrantClient } from '@qdrant/js-client-rest';

interface TestSeedData {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    created_at: string;
  }>;
  memories: Array<{
    id: string;
    content: string;
    embedding: number[];
    metadata: Record<string, unknown>;
  }>;
}

export async function seedTestDatabase(): Promise<TestSeedData> {
  // SQLite Setup
  const db = new Database(process.env.TEST_SQLITE_DB || '/tmp/zeroclaw_test.db');

  // Clear existing data
  db.exec(`
    DELETE FROM tasks;
    DELETE FROM memories;
    DELETE FROM sessions;
  `);

  // Seed test tasks
  const tasks = [
    {
      id: 'task-1',
      title: 'Skompiluj jądro',
      description: 'Kompilacja jądra Linux z opcjami optymalizacyjnymi',
      status: 'pending',
      created_at: new Date().toISOString()
    },
    {
      id: 'task-2',
      title: 'Aktualizacja certyfikatów SSL',
      description: 'Odnowienie certyfikatów SSL dla serwera produkcyjnego',
      status: 'in_progress',
      created_at: new Date().toISOString()
    }
  ];

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  tasks.forEach(task => insertTask.run(task.id, task.title, task.description, task.status, task.created_at));

  // Qdrant Setup
  const qdrant = new QdrantClient({
    url: process.env.TEST_QDRANT_HOST || 'http://localhost:6334',
  });

  // Reset collection
  try {
    await qdrant.deleteCollection('memories_test');
  } catch (e) {
    // Collection might not exist
  }

  await qdrant.createCollection('memories_test', {
    vectors: { size: 1536, distance: 'Cosine' }
  });

  // Seed test memories
  const memories = [
    {
      id: 'mem-1',
      content: 'Nazywam się Jan Kowalski',
      embedding: new Array(1536).fill(0.1), // Mock embedding
      metadata: { type: 'identity', source: 'telegram' }
    },
    {
      id: 'mem-2',
      content: 'Preferuje pracę w godzinach nocnych',
      embedding: new Array(1536).fill(0.2), // Mock embedding
      metadata: { type: 'preference', source: 'pwa' }
    }
  ];

  await qdrant.upsert('memories_test', {
    points: memories.map(mem => ({
      id: mem.id,
      vector: mem.embedding,
      payload: { content: mem.content, ...mem.metadata }
    }))
  });

  db.close();

  return { tasks, memories };
}

export async function clearTestDatabase(): Promise<void> {
  const db = new Database(process.env.TEST_SQLITE_DB || '/tmp/zeroclaw_test.db');
  db.exec(`
    DELETE FROM tasks;
    DELETE FROM memories;
    DELETE FROM sessions;
  `);
  db.close();

  const qdrant = new QdrantClient({
    url: process.env.TEST_QDRANT_HOST || 'http://localhost:6334',
  });

  try {
    await qdrant.deleteCollection('memories_test');
  } catch (e) {
    // Ignore if collection doesn't exist
  }
}
```

### 2.2 Storage State Setup for PWA Auth

Create `/tmp/zeroclaw-src/tests/e2e/fixtures/setup-pwa-auth.ts`:

```typescript
import { chromium, FullConfig } from '@playwright/test';

async function setupPWAAuth(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login page
  await page.goto('http://localhost:5173/login');

  // Fill login form
  await page.fill('input[name="username"]', process.env.TEST_PWA_USERNAME || 'test_user');
  await page.fill('input[name="password"]', process.env.TEST_PWA_PASSWORD || 'test_password_123');
  await page.click('button[type="submit"]');

  // Wait for successful login and JWT storage
  await page.waitForURL('http://localhost:5173/dashboard');
  await page.waitForSelector('[data-testid="dashboard-container"]');

  // Save storage state
  await context.storageState({ path: './tests/e2e/fixtures/pwa-storage.json' });

  await browser.close();
}

export default setupPWAAuth;
```

Run once to create auth state:

```bash
npx playwright test --config=playwright.config.ts -c "import('./tests/e2e/fixtures/setup-pwa-auth.ts')"
```

### 2.3 Telegram Session Persistence

Create `/tmp/zeroclaw-src/tests/e2e/fixtures/setup-telegram.ts`:

```typescript
import { chromium, FullConfig } from '@playwright/test';

async function setupTelegramSession(config: FullConfig) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to Telegram Web
  await page.goto('https://web.telegram.org/a/');

  // Wait for manual login (user needs to scan QR code)
  console.log('Please scan QR code to login to Telegram...');
  console.log('Press Enter in terminal when logged in...');

  // Wait for successful login (URL changes to /a/chats)
  await page.waitForURL('**/a/chats', { timeout: 0 });

  // Find and open the test bot chat
  const botUsername = process.env.TEST_TELEGRAM_BOT_USERNAME || '@zeroclaw_test_bot';
  await page.click(`[data-peer-id="${botUsername}"]`);

  // Save storage state
  await context.storageState({ path: './tests/e2e/fixtures/telegram-storage.json' });

  await browser.close();
  console.log('Telegram session saved!');
}

export default setupTelegramSession;
```

---

## 3. Test Structure

### 3.1 Directory Layout

```
/tmp/zeroclaw-src/tests/e2e/
├── fixtures/
│   ├── pwa-storage.json              # PWA auth state
│   ├── telegram-storage.json         # Telegram session
│   ├── seed-database.ts              # Database seeding
│   ├── test-data.json                # Mock data
│   └── helpers.ts                    # Utility functions
├── helpers/
│   ├── kanban-helpers.ts             # Kanban-specific helpers
│   ├── chat-helpers.ts               # Chat interaction helpers
│   ├── telegram-helpers.ts           # Telegram-specific helpers
│   └── api-helpers.ts                # API request helpers
├── specs/
│   ├── pwa/
│   │   ├── kanban.spec.ts            # Work Engine tests
│   │   ├── swarm-control.spec.ts     # Hand management tests
│   │   ├── memory-explorer.spec.ts   # Qdrant/SVG graph tests
│   │   └── agent-chat.spec.ts        # WebSocket stream tests
│   ├── cross-platform/
│   │   ├── telegram-pwa.spec.ts      # Telegram ⇆ PWA sync
│   │   └── session-sharing.spec.ts   # Identity sync tests
│   └── security/
│       ├── path-traversal.spec.ts    # Path traversal protection
│       └── offline-tolerance.spec.ts # Network resilience tests
├── global-setup.ts                   # Runs before all tests
├── global-teardown.ts                # Runs after all tests
└── SETUP.md                          # This document
```

### 3.2 Helper Functions

Create `/tmp/zeroclaw-src/tests/e2e/helpers/api-helpers.ts`:

```typescript
import { APIRequestContext, APIResponse } from '@playwright/test';

export class APIHelper {
  constructor(private request: APIRequestContext) {}

  async createTask(title: string, description: string): Promise<APIResponse> {
    return await this.request.post('/v1/tasks', {
      data: { title, description, status: 'pending' }
    });
  }

  async updateTaskStatus(taskId: string, status: string): Promise<APIResponse> {
    return await this.request.put(`/v1/tasks/${taskId}`, {
      data: { status }
    });
  }

  async getActiveHands(): Promise<APIResponse> {
    return await this.request.get('/v1/agent/hands');
  }

  async interruptHand(handId: string): Promise<APIResponse> {
    return await this.request.post(`/v1/agent/${handId}/interrupt`);
  }

  async deleteMemory(memoryId: string): Promise<APIResponse> {
    return await this.request.delete(`/v1/memories/${memoryId}`);
  }

  async searchMemories(query: string): Promise<APIResponse> {
    return await this.request.get('/v1/memories/search', {
      params: { q: query }
    });
  }
}
```

Create `/tmp/zeroclaw-src/tests/e2e/helpers/kanban-helpers.ts`:

```typescript
import { Page, Locator } from '@playwright/test';

export class KanbanHelper {
  constructor(private page: Page) {}

  getTaskCard(title: string): Locator {
    return this.page.locator(`[data-testid="task-card"][data-title="${title}"]`);
  }

  getColumn(columnName: string): Locator {
    return this.page.locator(`[data-testid="kanban-column"][data-column="${columnName}"]`);
  }

  async addTask(title: string): Promise<void> {
    await this.page.fill('[data-testid="task-input"]', title);
    await this.page.press('[data-testid="task-input"]', 'Enter');
  }

  async dragAndDropTask(taskTitle: string, targetColumn: string): Promise<void> {
    const task = this.getTaskCard(taskTitle);
    const column = this.getColumn(targetColumn);

    await task.dragTo(column);
  }

  async waitForTaskInColumn(title: string, column: string): Promise<void> {
    await this.page.waitForSelector(
      `[data-testid="kanban-column"][data-column="${column}"] [data-testid="task-card"][data-title="${title}"]`
    );
  }

  async verifyTaskCount(column: string, expectedCount: number): Promise<void> {
    const count = await this.getColumn(column)
      .locator('[data-testid="task-card"]')
      .count();

    if (count !== expectedCount) {
      throw new Error(`Expected ${expectedCount} tasks in ${column}, found ${count}`);
    }
  }
}
```

### 3.3 Base Test Classes

Create `/tmp/zeroclaw-src/tests/e2e/helpers/base-test.ts`:

```typescript
import { test as base, Page, APIRequestContext } from '@playwright/test';
import { APIHelper } from './api-helpers';
import { KanbanHelper } from './kanban-helpers';

export type TestOptions = {
  apiHelper: APIHelper;
  kanbanHelper: KanbanHelper;
};

export const test = base.extend<TestOptions>({
  apiHelper: async ({ request }, use) => {
    await use(new APIHelper(request));
  },

  kanbanHelper: async ({ page }, use) => {
    await use(new KanbanHelper(page));
  }
});

export { expect } from '@playwright/test';
```

---

## 4. Parallel Execution Strategy

### 4.1 Test Splitting Across Agents

Split tests by category for parallel execution:

```bash
# Agent 1: PWA Tests
npx playwright test --project=chromium tests/e2e/specs/pwa/

# Agent 2: Cross-Platform Tests
npx playwright test --project=chromium tests/e2e/specs/cross-platform/

# Agent 3: Security Tests
npx playwright test --project=chromium tests/e2e/specs/security/
```

### 4.2 Shared State Management

Create `/tmp/zeroclaw-src/tests/e2e/fixtures/state-manager.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';

interface SharedState {
  testRunId: string;
  activeTasks: string[];
  activeHands: string[];
  telegramMessages: Array<{ id: string; timestamp: number }>;
}

export class StateManager {
  private statePath: string;

  constructor(testRunId: string) {
    this.statePath = path.join('/tmp', `zeroclaw-test-state-${testRunId}.json`);
  }

  async init(): Promise<SharedState> {
    const state: SharedState = {
      testRunId: this.getStateId(),
      activeTasks: [],
      activeHands: [],
      telegramMessages: []
    };

    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
    return state;
  }

  async getState(): Promise<SharedState> {
    const content = await fs.readFile(this.statePath, 'utf-8');
    return JSON.parse(content);
  }

  async updateState(updates: Partial<SharedState>): Promise<void> {
    const current = await this.getState();
    const updated = { ...current, ...updates };
    await fs.writeFile(this.statePath, JSON.stringify(updated, null, 2));
  }

  async cleanup(): Promise<void> {
    try {
      await fs.unlink(this.statePath);
    } catch (e) {
      // File might not exist
    }
  }

  private getStateId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 4.3 Result Aggregation

Create `/tmp/zeroclaw-src/tests/e2e/scripts/aggregate-results.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';

interface TestResult {
  test: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface AggregatedResults {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
}

export async function aggregateResults(reportDir: string): Promise<AggregatedResults> {
  const results: TestResult[] = [];
  let passed = 0, failed = 0, skipped = 0;

  // Read all result files
  const files = await fs.readdir(reportDir);
  const resultFiles = files.filter(f => f.endsWith('.json'));

  for (const file of resultFiles) {
    const filePath = path.join(reportDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Extract results from Playwright format
    for (const suite of data.suites || []) {
      for (const spec of suite.specs || [])) {
        const status = spec.tests[0]?.results[0]?.status || 'skipped';
        results.push({
          test: spec.title,
          status: status === 'passed' ? 'passed' : status === 'failed' ? 'failed' : 'skipped',
          duration: spec.tests[0]?.results[0]?.duration || 0,
          error: spec.tests[0]?.results[0]?.error?.message
        });

        if (status === 'passed') passed++;
        else if (status === 'failed') failed++;
        else skipped++;
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed,
    failed,
    skipped,
    results
  };
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const results = await aggregateResults('./playwright-report');
  console.log(JSON.stringify(results, null, 2));
}
```

---

## 5. Running Tests

### 5.1 Local Development

```bash
# Start the dev server
cd /tmp/zeroclaw-src/web
npm run dev

# In another terminal, run tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Debug specific test
npm run test:e2e:debug -- kanban.spec.ts
```

### 5.2 Full Test Suite

```bash
# Run all tests
npm run test:e2e

# Run specific test category
npx playwright test tests/e2e/specs/pwa/
npx playwright test tests/e2e/specs/cross-platform/
npx playwright test tests/e2e/specs/security/
```

### 5.3 Cross-Platform Tests

```bash
# Run Telegram ⇆ PWA sync tests
npm run test:e2e:telegram
```

---

## 6. CI/CD Integration

### 6.1 GitHub Actions

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      qdrant:
        image: qdrant/qdrant:latest
        ports:
          - 6334:6334

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        working-directory: ./web
        run: npm ci

      - name: Install Playwright
        working-directory: ./web
        run: npx playwright install --with-deps chromium

      - name: Build Rust backend
        run: cargo build --release

      - name: Start services
        run: |
          ./target/release/zeroclaw daemon &
          sleep 5

      - name: Run E2E tests
        working-directory: ./web
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: web/playwright-report/
          retention-days: 7

      - name: Upload test videos
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-videos
          path: web/test-results/
          retention-days: 7
```

### 6.2 Docker Compose for Testing

Create `docker-compose.test.yml`:

```yaml
version: '3.8'

services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6334:6334"

  zeroclaw:
    build: .
    ports:
      - "8080:8080"
    environment:
      - QDRANT_HOST=qdrant
      - SQLITE_DB=/data/zeroclaw_test.db
    volumes:
      - test-data:/data
    depends_on:
      - qdrant

  test-runner:
    build: ./web
    volumes:
      - ./web:/app
      - /app/node_modules
    working_dir: /app
    environment:
      - TEST_SQLITE_DB=/tmp/zeroclaw_test.db
      - TEST_QDRANT_HOST=qdrant:6334
    command: npm run test:e2e
    depends_on:
      - zeroclaw
      - qdrant

volumes:
  test-data:
```

---

## 7. Troubleshooting

### 7.1 Common Issues

**Issue: Tests timeout connecting to WebSocket**

```bash
# Verify backend is running
curl http://localhost:8080/health

# Check WebSocket endpoint
wscat -c ws://localhost:8080/ws
```

**Issue: Telegram auth state expired**

```bash
# Re-run setup script
node tests/e2e/fixtures/setup-telegram.ts
```

**Issue: Database not seeded properly**

```bash
# Check database exists
ls -la /tmp/zeroclaw_test.db

# Verify Qdrant collection
curl http://localhost:6334/collections/memories_test
```

**Issue: Tests run in wrong order**

```bash
# Run tests serially for debugging
npx playwright test --workers=1
```

### 7.2 Debug Mode

```bash
# Run with headed browser
npm run test:e2e:headed

# Run specific test with debugging
npx playwright test --debug kanban.spec.ts

# Enable verbose logging
DEBUG=pw:* npm run test:e2e
```

### 7.3 Performance Optimization

```typescript
// Use `test.slow()` for tests that need more time
test.slow('Cross-platform sync', async ({ page }) => {
  // Test code that may take longer
});

// Increase timeout for specific operations
await page.waitForSelector('[data-testid="task-card"]', { timeout: 30000 });
```

---

## Summary

This infrastructure setup provides:

1. **Isolated test environment** with seeded databases and fresh state for each test run
2. **Multi-context testing** to validate PWA + Telegram synchronization
3. **Reusable helpers** for common operations (API, Kanban, chat interactions)
4. **Parallel execution** support for faster test runs across agents
5. **CI/CD ready** configuration with Docker Compose and GitHub Actions
6. **Comprehensive coverage** of all critical E2E scenarios from the test plan

The setup ensures stable, repeatable tests while supporting the complex cross-platform nature of ZeroClaw OS.
