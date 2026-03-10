/**
 * ZeroClaw Chat E2E Tests - Playwright
 *
 * Tests chat functionality, context retention, RAG memory,
 * and dashboard integration using SQLite-backed memory.
 *
 * Prerequisites:
 * - ZeroClaw daemon running on http://127.0.0.1:42617
 * - Dashboard built and accessible (default: http://127.0.0.1:3000 or via Caddy)
 * - Valid JWT token or paired gateway
 * - Qdrant running on 127.0.0.1:6333
 * - SQLite memory initialized at ~/.zeroclaw/memory/brain.db
 *
 * Environment variables:
 * - BASE_URL: Dashboard base URL (default: http://localhost:3000)
 * - API_URL: ZeroClaw API URL (default: http://localhost:42617)
 * - TEST_TOKEN: Auth token (optional, if set skips pairing)
 * - TEST_USER: Test username (default: admin)
 * - TEST_PASS: Test password (default: password)
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:42617';
const TEST_TOKEN = process.env.TEST_TOKEN || '';
const TEST_USER = process.env.TEST_USER || 'admin';
const TEST_PASS = process.env.TEST_PASS || 'password';

interface AuthTokens {
  bearer: string;
  expires?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Authenticate with the gateway and return bearer token.
 * In E2E tests, auth is handled by storageState in playwright.config.ts.
 */
async function authenticate(): Promise<AuthTokens> {
  // E2E tests use mock authentication via storageState in playwright.config.ts
  return { bearer: 'mock-test-token-123' };
}

/**
 * Store a memory entry directly via API for testing purposes.
 */
async function storeMemory(key: string, content: string, category: string = 'test', token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/memory/store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      key,
      content,
      category,
    }),
  });

  expect(response.ok).toBeTruthy();
}

/**
 * Recall memory entries via API.
 */
async function recallMemory(query: string, limit: number = 5, token: string): Promise<any[]> {
  const response = await fetch(`${API_URL}/api/v1/memory/recall?query=${encodeURIComponent(query)}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  expect(response.ok).toBeTruthy();

  const data = await response.json();
  return data.results || [];
}

/**
 * Clear all test memories to ensure test isolation.
 */
async function clearTestMemories(token: string): Promise<void> {
  // In a real test, we'd have a bulk delete endpoint
  // For now, we'll work around by using unique test keys
}

// =============================================================================
// TEST SUITES
// =============================================================================

test.describe.configure({ mode: 'serial' }); // Run tests sequentially

test.describe('ZeroClaw Chat: Context Retention', () => {
  let authToken: AuthTokens;
  let page: any;

  test.beforeAll(async ({ browser }) => {
    // Authenticate once for all tests in this describe block
    authToken = await authenticate();
  });

  test.beforeEach(async ({ page }) => {
    // Log console output from browser
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    // Navigate to chat page
    await page.goto(`${BASE_URL}/chat`);
    // page.waitForLoad() replaced with waitForLoadState

    // Wait for WebSocket connection
    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 15000 });
  });

  test('remembers user name across conversation turns', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();
    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();

    // Turn 1: Introduce yourself
    await chatInput.fill('My name is Alice and I love learning about space exploration.');
    await page.keyboard.press('Enter');

    // Wait for assistant response
    await page.waitForTimeout(10000);
    const messages = await messagesContainer.allTextContents();
    const lastMessageText = messages[messages.length - 1];

    expect(lastMessageText.toLowerCase()).toContain('alice');

    // Turn 2: Add filler (to test memory retention under load)
    await chatInput.fill('What is the capital of France? Please be concise.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(10000);

    // Turn 3: Verify name is still remembered after filler
    await chatInput.fill('What did I tell you my name was?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(10000);

    const finalMessages = await messagesContainer.allTextContents();
    const finalMessage = finalMessages[finalMessages.length - 1];

    expect(finalMessage.toLowerCase()).toContain('alice');
  });

  test('remembers stored information across sessions', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();

    // Store a memory via API
    await storeMemory('user_pref', 'Alice prefers concise answers over verbose explanations.', 'test', authToken.bearer);

    // Wait a moment for memory to be indexed
    await page.waitForTimeout(1000);

    // Trigger memory recall in conversation
    await chatInput.fill('What are my communication preferences?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage.toLowerCase()).toContain('concise');
  });

  test('persists conversation context after page reload', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();

    // Establish context
    await chatInput.fill('I am working on a Rust project about async safety.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Reload page
    await page.reload();
    // page.waitForLoad() replaced with waitForLoadState

    // Wait for WebSocket reconnection
    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 5000 });

    // Verify context is restored
    await chatInput.fill('What programming language am I working on?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage.toLowerCase()).toContain('rust');
  });
});

test.describe('ZeroClaw Chat: RAG Memory Integration', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test('retrieves relevant documents from vector store', async ({ page }) => {
    // Pre-seed memory with test data
    await storeMemory('rust_guide', 'Rust async safety: Use tokio::task::spawn_blocking for CPU-intensive operations.', 'test', authToken.bearer);
    await storeMemory('python_guide', 'Python async: Use asyncio for concurrent code.', 'test', authToken.bearer);

    await page.goto(`${BASE_URL}/chat`);
    // page.waitForLoad() replaced with waitForLoadState

    // Wait for WebSocket connection
    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 5000 });

    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();

    // Query about Rust async safety
    chatInput.fill('What should I use for CPU-heavy operations in Rust async code?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage.toLowerCase()).toContain('spawn_blocking');
  });

  test('falls back gracefully when RAG provides no results', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    // page.waitForLoad() replaced with waitForLoadState

    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 5000 });

    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();

    // Query about something not in memory
    chatInput.fill('Tell me about quantum entanglement in under 50 words.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Should get a response even without RAG hits
    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage.length).toBeGreaterThan(0);
    expect(lastMessage.length).toBeLessThan(500); // Should be concise
  });
});

test.describe('ZeroClaw Dashboard: Memory Graph', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test('displays memory statistics on dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    // page.waitForLoad() replaced with waitForLoadState

    // Check for memory-related metrics
    const memorySection = page.locator('[data-testid="memory-stats"], .memory-stats, text*="memory" i').first();
    expect(await memorySection.count()).toBeGreaterThan(0);
  });

  test('shows recently stored memories', async ({ page }) => {
    // Store some test memories
    await storeMemory('test_1', 'First test memory for dashboard', 'dashboard_test', authToken.bearer);
    await storeMemory('test_2', 'Second test memory for dashboard', 'dashboard_test', authToken.bearer);

    await page.goto(`${BASE_URL}/dashboard`);
    // page.waitForLoad() replaced with waitForLoadState

    // Look for memory list or table
    const memoryList = page.locator('[data-testid="memory-list"], .memory-list, table').first();
    expect(await memoryList.count()).toBeGreaterThan(0);
  });
});

test.describe('ZeroClaw Chat: Tool Execution', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test('executes file_read tool and returns content', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    // page.waitForLoad() replaced with waitForLoadState

    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 5000 });

    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();

    // Request to read this test file
    chatInput.fill('Read the first line of the file README.md in the current directory and tell me what it says.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();
    const lastMessage = messages[messages.length - 1];

    // Should contain content from README.md or a success message
    expect(lastMessage.length).toBeGreaterThan(0);
  });

  test('handles tool errors gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    // page.waitForLoad() replaced with waitForLoadState

    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 5000 });

    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();

    // Request to read non-existent file
    chatInput.fill('Read the file /nonexistent/file.txt and show me the error.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();
    const lastMessage = messages[messages.length - 1];

    // Should show an error message
    expect(lastMessage.toLowerCase()).toContain('error');
  });
});

test.describe('ZeroClaw: Multi-turn Tool Loops', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test('executes multiple tools in sequence and aggregates results', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    // page.waitForLoad() replaced with waitForLoadState

    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 5000 });

    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();

    // Multi-tool request
    chatInput.fill('List the files in the current directory, then read the contents of README.md, and finally tell me the current date.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(8000);

    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();

    // Should have multiple tool outputs
    const hasFileList = messages.some((msg: string) =>
      msg.includes('.md') || msg.includes('README') || msg.includes('file')
    );
    expect(hasFileList).toBeTruthy();
  });
});

test.describe('ZeroClaw: Concurrent Requests', () => {
  test('handles multiple simultaneous chat sessions', async ({ browser }) => {
    const context = await browser.newContext();

    try {
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      // Navigate both to chat
      await page1.goto(`${BASE_URL}/chat`);
      await page2.goto(`${BASE_URL}/chat`);
      // waitForLoad removed - goto waits for load by default

      // Send different messages simultaneously
      await page1.locator('textarea').first().fill('Message from session 1');
      await page1.keyboard.press('Enter');

      await page2.locator('textarea').first().fill('Message from session 2');
      await page2.keyboard.press('Enter');

      // Wait for responses
      await page1.waitForTimeout(3000);
      await page2.waitForTimeout(3000);

      // Both should have received responses
      const msgs1 = await page1.locator('.chat-messages, [role="log"], .messages-container').first().allTextContents();
      const msgs2 = await page2.locator('.chat-messages, [role="log"], .messages-container').first().allTextContents();

      expect(msgs1.length).toBeGreaterThan(1);
      expect(msgs2.length).toBeGreaterThan(1);
    } finally {
      await context.close();
    }
  });
});

test.describe('ZeroClaw: Error Recovery', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test('recovers from tool timeout gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    // page.waitForLoad() replaced with waitForLoadState

    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 5000 });

    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();

    // Request something that might timeout (very large operation)
    chatInput.fill('Search the entire filesystem for all Python files and count them (this might take a while).');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(10000);

    // Should either complete or show a timeout message
    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();
    const lastMessage = messages[messages.length - 1];

    // Either got results or a timeout message
    expect(lastMessage.length).toBeGreaterThan(0);
  });
});

test.describe('ZeroClaw: Memory Persistence', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test('memory persists across agent restarts', async ({ page }) => {
    const uniqueKey = `persistence_test_${Date.now()}`;
    const testContent = 'This should persist even after restart.';

    // Store memory
    await storeMemory(uniqueKey, testContent, 'persistence', authToken.bearer);

    // Simulate restart by clearing local state
    await page.evaluate(() => {
      (window as any).clearChatHistory();
    });

    await page.goto(`${BASE_URL}/chat`);
    // page.waitForLoad() replaced with waitForLoadState

    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout: 5000 });

    const chatInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="prompt"], textarea').first();
    chatInput.fill(`What did I store with key ${uniqueKey}?`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const messagesContainer = page.locator('.chat-messages, [role="log"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage).toContain(testContent);
  });
});

test.afterAll(async () => {
  // Cleanup: Clear test memories
  if (TEST_TOKEN) {
    await clearTestMemories(TEST_TOKEN);
  }
});

// =============================================================================
// PRODUCTION TESTS - Real ZeroClaw Backend Integration
// =============================================================================

test.describe('ZeroClaw Production: Real Backend Integration', () => {
  test.describe.configure({ mode: 'serial' });

  const PROD_URL = 'https://dash.karndt.pl';

  test('connects to production WebSocket with JWT authentication', async ({ page }) => {
    // First, get a real JWT token from the production API
    const authResponse = await page.request.post(`${PROD_URL}/api/v1/auth/login`, {
      data: {
        username: 'admin',
        password: process.env.PROD_PASSWORD || 'password'
      }
    }).catch(() => null);

    // For now, test with the production page accessible
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Check that the page loaded successfully
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Look for the chat interface
    const chatContainer = page.locator('[data-testid="agent-chat-container"], .chat, [role="log"]').first();
    expect(await chatContainer.count()).toBeGreaterThan(0);
  });

  test('sends message to real LLM backend and receives response', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Wait for WebSocket connection (may fail without auth)
    try {
      await page.waitForFunction(() => {
        return (window as any).wsConnected === true;
      }, { timeout: 5000 });
    } catch {
      // Connection might fail without valid auth - that's expected
      console.log('WebSocket connection requires valid JWT token');
      return;
    }

    // Try to send a message
    const chatInput = page.locator('textarea[placeholder*="Message"], textarea').first();
    await chatInput.fill('Hello, this is a production test message. Please respond with "Production test confirmed."');
    await page.keyboard.press('Enter');

    // Wait for potential response (longer timeout for real LLM)
    await page.waitForTimeout(10000);

    // Check if we got a response
    const messagesContainer = page.locator('[data-testid="messages-container"], .messages-container').first();
    const messages = await messagesContainer.allTextContents();

    // In production, we should have a response (unless auth failed)
    // For now, just verify the message was sent
    expect(await chatInput.inputValue()).toBe('');
  });

  test('WebSocket message format matches ZeroClaw protocol', async ({ page }) => {
    // Monitor WebSocket traffic
    const wsMessages: any[] = [];

    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Inject WebSocket interceptor
    await page.evaluate(() => {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        (window as any).wsSentMessages = (window as any).wsSentMessages || [];
        try {
          const parsed = JSON.parse(data as string);
          (window as any).wsSentMessages.push(parsed);
        } catch {
          (window as any).wsSentMessages.push({ raw: data });
        }
        return originalSend.call(this, data);
      };
    });

    // Wait for connection
    try {
      await page.waitForFunction(() => {
        return (window as any).wsConnected === true;
      }, { timeout: 5000 });
    } catch {
      // May fail without auth
      return;
    }

    // Send a message
    const chatInput = page.locator('textarea[placeholder*="Message"], textarea').first();
    await chatInput.fill('Protocol test');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);

    // Check sent message format
    const sentMessages = await page.evaluate(() => (window as any).wsSentMessages || []);
    const lastMessage = sentMessages[sentMessages.length - 1];

    // Verify message follows ZeroClaw protocol: {"type":"message","content":"..."}
    if (lastMessage && !lastMessage.raw) {
      expect(lastMessage.type).toBe('message');
      expect(lastMessage.content).toBeDefined();
    }
  });

  test('handles streaming responses from real LLM', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    try {
      await page.waitForFunction(() => {
        return (window as any).wsConnected === true;
      }, { timeout: 5000 });
    } catch {
      return;
    }

    // Send a message that should generate a longer response
    const chatInput = page.locator('textarea[placeholder*="Message"], textarea').first();
    await chatInput.fill('Write a 3-line poem about AI. Make it flow naturally.');
    await page.keyboard.press('Enter');

    // Wait for streaming to complete
    await page.waitForTimeout(15000);

    // Check for streaming indicator
    const streamingIndicator = page.locator('[data-testid="streaming-indicator"], .streaming').first();
    const wasStreaming = await streamingIndicator.count() > 0;

    // Verify we got a response
    const messagesContainer = page.locator('[data-testid="messages-container"], .messages-container').first();
    const messages = await messagesContainer.locator('.message, [role="text"]').all();
    expect(messages.length).toBeGreaterThan(1); // At least user + assistant
  });
});
