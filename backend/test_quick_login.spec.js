const { test, expect } = require('@playwright/test');

test('Quick login test', async ({ page }) => {
  console.log('Navigating to Open WebUI...');
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Check for email input
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  console.log('Email input found:', !!emailInput);

  if (emailInput) {
    await emailInput.fill('admin@zeroclaw.local');
    await page.waitForTimeout(500);

    const signInBtn = await page.$('button:has-text("Sign in")');
    console.log('Sign in button found:', !!signInBtn);

    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  // Check for chat input
  const chatInput = await page.$('[contenteditable="true"]');
  console.log('Chat input found:', !!chatInput);

  // Take screenshot
  await page.screenshot({ path: 'test-results/quick-login-debug.png', fullPage: true });
  console.log('Screenshot saved');
});
