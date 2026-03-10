/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests/playwright',
  timeout: 60000,
  retries: 0,
  workers: 1, // Run tests sequentially to keep browser open
  use: {
    headless: false, // Keep browser visible
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    slowMo: 50, // Slow down for better visibility
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // Keep browser context alive between tests
        contextOptions: {
          viewport: { width: 1280, height: 720 },
        },
      },
    },
  ],
};
