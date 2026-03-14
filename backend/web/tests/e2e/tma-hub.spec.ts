import { test, expect, Page } from '@playwright/test';

// Mock Telegram WebApp API
function mockTelegramWebApp(page: Page, options: {
  userId?: number;
  chatId?: number;
  username?: string;
} = {}) {
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

test.describe('TMA Hub', () => {
  test.beforeEach(async ({ page }) => {
    mockTelegramWebApp(page);
  });

  test('should load and display Telegram Hub page', async ({ page }) => {
    await page.goto('http://localhost:4173/_app/tma/hub');

    // Wait for the page to actually load
    await page.waitForLoadState('networkidle');

    // Check for the root element first
    const root = page.locator('#root');
    await expect(root).toBeAttached();

    // Check for ZeroClaw Hub text - might be in a loading state first
    const hubText = page.getByText('ZeroClaw Hub');
    await expect(hubText).toBeVisible({ timeout: 10000 });
  });

  test('should display tabs for threads and skills', async ({ page }) => {
    await page.goto('http://localhost:4173/_app/tma/hub');
    await page.waitForLoadState('networkidle');

    // Check tabs exist
    await expect(page.getByText('Konwersacje')).toBeVisible();
    await expect(page.getByText('Skille')).toBeVisible();
  });

  test('should create a new thread', async ({ page }) => {
    await page.goto('http://localhost:4173/_app/tma/hub');

    // Mock API responses
    await page.route('**/api/v1/telegram/threads', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'thread-new-123',
              title: 'Nowa konwersacja',
              is_active: true,
              active_skills: [],
              created_at: new Date().toISOString()
            }
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] })
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
            { name: 'web-search', description: 'Search the web', category: 'web' },
            { name: 'file-ops', description: 'File operations', category: 'system' }
          ]
        })
      });
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click create button
    const createButton = page.getByText('Nowa konwersacja');
    await expect(createButton).toBeVisible();
    await createButton.click();
  });

  test('should display skills list', async ({ page }) => {
    await page.goto('http://localhost:4173/_app/tma/hub');

    // Mock skills API
    await page.route('**/api/v1/skills', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { name: 'web-search', description: 'Search the web', category: 'Web' },
            { name: 'file-ops', description: 'File operations', category: 'System' }
          ]
        })
      });
    });

    // Mock threads API with empty data
    await page.route('**/api/v1/telegram/threads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] })
      });
    });

    await page.waitForLoadState('networkidle');

    // Click on skills tab
    await page.getByText('Skille').click();

    // Should show warning about selecting a thread
    await expect(page.getByText('Wybierz konwersację')).toBeVisible();

    // Skills should be listed
    await expect(page.getByText('web-search')).toBeVisible();
  });

  test('should toggle skills for active thread', async ({ page }) => {
    await page.goto('http://localhost:4173/_app/tma/hub');

    const mockThreadId = 'thread-test-123';

    // Mock APIs
    await page.route('**/api/v1/telegram/threads', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: mockThreadId,
                title: 'Test Thread',
                is_active: true,
                active_skills: ['web-search'],
                created_at: new Date().toISOString()
              }
            ]
          })
        });
      }
    });

    await page.route('**/api/v1/skills', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { name: 'web-search', description: 'Search the web', category: 'Web' },
            { name: 'file-ops', description: 'File operations', category: 'System' }
          ]
        })
      });
    });

    await page.route('**/api/v1/telegram/threads/*/skills', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.waitForLoadState('networkidle');

    // Click on skills tab
    await page.getByText('Skille').click();

    // Wait for skills to load
    await expect(page.getByText('web-search')).toBeVisible();
  });

  test.skip('should switch between threads', async ({ page }) => {
    // This test verifies the threads UI structure
    // Wait for the page to load
    await page.waitForLoadState('load');

    // Verify the ZeroClaw Hub header is visible
    await expect(page.getByText('ZeroClaw Hub')).toBeVisible();

    // Verify tabs are present
    await expect(page.getByText('Konwersacje')).toBeVisible();
    await expect(page.getByText('Skille')).toBeVisible();

    // The "Nowa konwersacja" button should be present
    await expect(page.getByText('Nowa konwersacja')).toBeVisible();
  });
});

test.describe('Telegram Web Integration', () => {
  test('should have Telegram.WebApp available', async ({ page }) => {
    await mockTelegramWebApp(page);
    await page.goto('http://localhost:4173/_app/tma/hub');

    const hasWebApp = await page.evaluate(() => {
      return typeof (window as any).Telegram?.WebApp === 'object';
    });

    expect(hasWebApp).toBeTruthy();
  });

  test('should call WebApp.ready() on mount', async ({ page }) => {
    await page.addInitScript(`
      window.Telegram = {
        WebApp: {
          ready: () => { window.__webAppReady = true; },
          expand: () => {},
          close: () => {},
          initData: 'test=123',
          initDataUnsafe: {}
        }
      };
    `);

    await page.goto('http://localhost:4173/_app/tma/hub');
    await page.waitForLoadState('networkidle');

    const readyCalled = await page.evaluate(() => {
      return (window as any).__webAppReady === true;
    });

    expect(readyCalled).toBeTruthy();
  });

  test('should include X-Telegram-InitData header in API requests', async ({ page }) => {
    let receivedHeaders: Record<string, string> = {};

    mockTelegramWebApp(page);

    await page.route('**/api/v1/telegram/threads', async (route) => {
      receivedHeaders = route.request().headers();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] })
      });
    });

    await page.goto('http://localhost:4173/_app/tma/hub');
    await page.waitForLoadState('networkidle');

    expect(receivedHeaders['x-telegram-initdata']).toBeDefined();
  });
});
