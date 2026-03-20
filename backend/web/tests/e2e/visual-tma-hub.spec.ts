import { test, expect } from '@playwright/test';

// Visual test of TMA Hub - takes screenshots for manual verification
const TMA_HUB_URL = 'https://duck-sitting-door-sender.trycloudflare.com/tma/hub';

test.describe('TMA Hub - Visual Documentation', () => {
  test('should capture TMA Hub landing page', async ({ page }) => {
    // Mock Telegram WebApp for the TMA Hub
    await page.addInitScript(`
      window.Telegram = {
        WebApp: {
          ready: () => console.log('WebApp.ready called'),
          expand: () => console.log('WebApp.expand called'),
          close: () => console.log('WebApp.close called'),
          initData: 'user_id=123456&chat_id=987654321&username=testuser',
          initDataUnsafe: {
            user: {
              id: 123456,
              first_name: 'Test',
              username: 'testuser'
            },
            chat: {
              id: 987654321,
              type: 'private'
            }
          },
          BackButton: {
            show: () => {},
            hide: () => {}
          },
          MainButton: {
            text: 'Test',
            onClick: () => {}
          }
        }
      };
    `);

    await page.goto(TMA_HUB_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Take full page screenshot
    await page.screenshot({
      path: 'test-results/tma-hub-full-page.png',
      fullPage: true
    });

    console.log('✅ Screenshot: test-results/tma-hub-full-page.png');
  });

  test('should show threads tab', async ({ page }) => {
    await page.addInitScript(`
      window.Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          close: () => {},
          initData: 'user_id=123456&chat_id=987654321',
          initDataUnsafe: {
            user: { id: 123456, first_name: 'Test', username: 'testuser' },
            chat: { id: 987654321, type: 'private' }
          }
        }
      };
    `);

    await page.goto(TMA_HUB_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Click on threads tab (should be default)
    await page.screenshot({
      path: 'test-results/tma-hub-threads-tab.png'
    });
    console.log('✅ Screenshot: test-results/tma-hub-threads-tab.png');
  });

  test('should show skills tab', async ({ page }) => {
    await page.addInitScript(`
      window.Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          close: () => {},
          initData: 'user_id=123456&chat_id=987654321',
          initDataUnsafe: {
            user: { id: 123456, first_name: 'Test', username: 'testuser' },
            chat: { id: 987654321, type: 'private' }
          }
        }
      };
    `);

    await page.goto(TMA_HUB_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Click on skills tab
    const skillsTab = page.getByText('Skille');
    if (await skillsTab.isVisible({ timeout: 5000 })) {
      await skillsTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-results/tma-hub-skills-tab.png'
      });
      console.log('✅ Screenshot: test-results/tma-hub-skills-tab.png');
    } else {
      console.log('❌ Skills tab not found');
    }
  });

  test('capture full user flow', async ({ page }) => {
    await page.addInitScript(`
      window.Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          close: () => {},
          initData: 'user_id=123456&chat_id=987654321',
          initDataUnsafe: {
            user: { id: 123456, first_name: 'Test', username: 'testuser' },
            chat: { id: 987654321, type: 'private' }
          }
        }
      };
    `);

    // Screenshot 1: Landing page
    await page.goto(TMA_HUB_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/flow-01-landing.png' });

    // Screenshot 2: Click "Nowa konwersacja"
    const createButton = page.getByText('Nowa konwersacja');
    if (await createButton.isVisible({ timeout: 5000 })) {
      await createButton.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/flow-02-after-create.png' });
    }

    // Screenshot 3: Switch to skills tab
    const skillsTab = page.getByText('Skille');
    if (await skillsTab.isVisible({ timeout: 5000 })) {
      await skillsTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/flow-03-skills-tab.png' });
    }

    console.log('✅ Flow screenshots saved');
  });
});
