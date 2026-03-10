import { test as base } from '@playwright/test';

// Extend base test to provide auth token before each test
export const test = base.extend({
  storageState: ({}, use) => {
    // Set up localStorage with mock token before tests
    const authToken = JSON.stringify({
      token: 'mock-test-token-' + Date.now(),
      expires: Date.now() + 3600000
    });
    
    use(async ({ context }) => {
      await context.addInitScript(() => {
        window.localStorage.setItem('zeroclaw_token', 'mock-test-token-123');
        window.localStorage.setItem('zeroclaw_authenticated', 'true');
      });
      await use(context);
    });
  },
});
