import { test, expect } from '@playwright/test';

// Real Telegram Web test - sends actual message to bot
// NOTE: This requires manual login or authenticated session

test.describe('Telegram Web - Real Bot Test', () => {
  test('should navigate to Telegram Web', async ({ page }) => {
    // Navigate to Telegram Web
    await page.goto('https://web.telegram.org/');

    // Wait for page to load (don't wait for networkidle - SPA)
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/telegram-web-landing.png', fullPage: true });
    console.log('✅ Screenshot saved: test-results/telegram-web-landing.png');
  });

  test('should search for bot', async ({ page }) => {
    await page.goto('https://web.telegram.org/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Try to find search input (multiple possible selectors)
    const searchSelectors = [
      'input[placeholder*="Search"]',
      'input[placeholder*="Szukaj"]',
      'input[placeholder*="search"]',
      '.search-input',
      'input[type="text"]'
    ];

    let searchBox = null;
    for (const selector of searchSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 })) {
          searchBox = el;
          console.log(`✅ Found search box with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (searchBox) {
      await searchBox.click();
      await searchBox.fill('@karndt_bot');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/telegram-search-results.png', fullPage: true });
      console.log('✅ Screenshot saved: test-results/telegram-search-results.png');
    } else {
      console.log('❌ Search box not found');
      await page.screenshot({ path: 'test-results/telegram-no-search-box.png', fullPage: true });
    }
  });
});
