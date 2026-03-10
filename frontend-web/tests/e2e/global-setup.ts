import { test as base } from '@playwright/test';

// Extend base test to provide auth token before each test
export const test = base.extend({
  beforeEach: async ({ page }, use) => {
    // Set mock auth token in localStorage
    await page.goto('http://localhost:3001');
    await page.evaluate(() => {
      localStorage.setItem('zeroclaw_token', 'mock-test-token-123');
    });
    await use(page);
  },
});
