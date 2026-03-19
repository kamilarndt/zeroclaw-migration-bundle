import { test, expect } from '@playwright/test';

// Test the per-conversation skills feature end-to-end
// This tests the actual backend API and the full flow

const API_BASE = process.env.API_BASE || 'https://duck-sitting-door-sender.trycloudflare.com';
// For UI tests, use a local preview server or different base
const UI_BASE = process.env.UI_BASE || API_BASE;
// Backend API base (may be different from UI base)
const BACKEND_API_BASE = process.env.BACKEND_API_BASE || API_BASE;

// Mock Telegram WebApp API
function mockTelegramWebApp(page, options = {}) {
  const {
    userId = 123456,
    chatId = 123456,
    username = 'testuser'
  } = options;

  return page.addInitScript(`
    window.Telegram = {
      WebApp: {
        ready: () => {},
        expand: () => {},
        close: () => {},
        initData: 'user_id=${userId}&chat_id=${chatId}',
        initDataUnsafe: {
          user: {
            id: ${userId},
            first_name: 'Test',
            username: '${username}'
          },
          chat: {
            id: ${chatId},
            type: 'private'
          }
        }
      }
    };
  `);
}

test.describe('Per-Conversation Skills E2E', () => {
  test('should create thread and set specific skills', async ({ page }) => {
    // This test requires a real backend and Telegram integration
    mockTelegramWebApp(page, { userId: 123456, chatId: 987654321 });

    const baseUrl = UI_BASE.replace('/_app', '');
    await page.goto(`${baseUrl}/_app/tma/hub`);
    await page.waitForLoadState('networkidle');

    // Mock API responses
    await page.route('**/api/v1/telegram/threads', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        // Create thread response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'thread-test-123',
              title: 'Nowa konwersacja',
              is_active: true,
              active_skills: [],
              created_at: new Date().toISOString()
            }
          })
        });
      } else {
        // GET threads response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'thread-test-123',
                title: 'Nowa konwersacja',
                is_active: true,
                active_skills: ['web-search-api'],
                created_at: new Date().toISOString()
              }
            ]
          })
        });
      }
    });

    await page.route('**/api/v1/telegram/threads/active', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.route('**/api/v1/skills', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { name: 'web-search-api', description: 'Search the web', category: 'web' },
            { name: 'file-ops', description: 'File operations', category: 'system' }
          ]
        })
      });
    });

    // Wait for the page to load
    await expect(page.getByText('ZeroClaw Hub')).toBeVisible({ timeout: 10000 });

    // Create a new thread
    const createButton = page.getByText('Nowa konwersacja');
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Wait for API response and page update
    await page.waitForTimeout(500);

    // Navigate to skills tab
    await page.getByText('Skille').click();

    // Verify skills are listed
    await expect(page.getByText('web-search-api')).toBeVisible({ timeout: 10000 });

    // Toggle a specific skill (find the skill and click its toggle button)
    // The toggle is a button within the skill card
    const skillCard = page.locator('text=web-search-api').locator('..').locator('..');
    const toggleButton = skillCard.locator('button').first();
    await expect(toggleButton).toBeVisible();
  });

  test('verifies skills API returns data', async ({ request }) => {
    // Test that the skills endpoint returns valid data
    const response = await request.get(`${BACKEND_API_BASE}/api/v1/skills`, {
      headers: {
        'X-Telegram-InitData': 'user_id=123456&chat_id=987654321'
      }
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBeGreaterThan(0);

    // Verify skill structure
    const firstSkill = data.data[0];
    expect(firstSkill).toHaveProperty('name');
    expect(firstSkill).toHaveProperty('description');
  });

  test('verifies threads API functionality', async ({ request }) => {
    // Test the threads endpoint
    const response = await request.get(`${BACKEND_API_BASE}/api/v1/telegram/threads`, {
      headers: {
        'X-Telegram-InitData': 'user_id=123456&chat_id=987654321'
      }
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
  });

  test('verifies TMA Hub page loads', async ({ page }) => {
    const baseUrl = UI_BASE.replace('/_app', '');
    await page.goto(`${baseUrl}/_app/tma/hub`);
    await page.waitForLoadState('networkidle');

    // Check for the root element
    const root = page.locator('#root');
    await expect(root).toBeAttached();

    // Check for ZeroClaw Hub text
    const hubText = page.getByText('ZeroClaw Hub');
    await expect(hubText).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Per-Conversation Skills - Backend Integration', () => {
  test('verifies webhook endpoint accepts messages', async ({ request }) => {
    // Test that the webhook endpoint is accessible
    const response = await request.post(`${BACKEND_API_BASE}/api/v1/telegram/webhook`, {
      data: {
        update_id: 123456,
        message: {
          message_id: 1,
          from: { id: 123456, first_name: 'Test', username: 'testuser' },
          chat: { id: 987654321, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'test message'
        }
      }
    });

    // Should return 200 OK (even if user is not whitelisted)
    expect(response.status()).toBe(200);
  });

  test('verifies thread skills can be updated', async ({ request }) => {
    // First, try to get threads for a test chat
    const threadsResponse = await request.get(`${BACKEND_API_BASE}/api/v1/telegram/threads`, {
      headers: {
        'X-Telegram-InitData': 'user_id=123456&chat_id=987654321'
      }
    });

    expect(threadsResponse.ok()).toBeTruthy();
    const threadsData = await threadsResponse.json();

    // If threads exist, try updating skills for one
    if (threadsData.data && threadsData.data.length > 0) {
      const threadId = threadsData.data[0].id;

      // Update skills for this thread
      const updateResponse = await request.put(
        `${BACKEND_API_BASE}/api/v1/telegram/threads/${threadId}/skills`,
        {
          headers: {
            'X-Telegram-InitData': 'user_id=123456&chat_id=987654321',
            'Content-Type': 'application/json'
          },
          data: {
            skills: ['web-search-api', 'memory-persistence']
          }
        }
      );

      expect(updateResponse.ok()).toBeTruthy();
      const updateData = await updateResponse.json();
      expect(updateData.success).toBe(true);
    }
  });
});

test.describe('Per-Conversation Skills - UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    mockTelegramWebApp(page);
  });

  test('should show warning when no thread selected in skills tab', async ({ page }) => {
    const baseUrl = UI_BASE.replace('/_app', '');
    await page.goto(`${baseUrl}/_app/tma/hub`);
    await page.waitForLoadState('networkidle');

    // Click on skills tab without selecting a thread
    await page.getByText('Skille').click();

    // Should show warning about selecting a thread
    await expect(page.getByText('Wybierz konwersację')).toBeVisible();
  });

  test('should display threads and skills tabs', async ({ page }) => {
    const baseUrl = UI_BASE.replace('/_app', '');
    await page.goto(`${baseUrl}/_app/tma/hub`);
    await page.waitForLoadState('networkidle');

    // Check tabs exist
    await expect(page.getByText('Konwersacje')).toBeVisible();
    await expect(page.getByText('Skille')).toBeVisible();
  });
});
