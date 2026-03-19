const { test, expect } = require('@playwright/test');

test('Quick login test', async ({ page }) => {
  console.log('Navigating to Open WebUI...');
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Step 1: Enter email
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  console.log('Email input found:', !!emailInput);

  if (emailInput) {
    await emailInput.fill('admin@zeroclaw.local');
    await page.waitForTimeout(500);

    const signInBtn = await page.$('button:has-text("Sign in")');
    console.log('Sign in button found:', !!signInBtn);

    if (signInBtn) {
      await signInBtn.click();
      console.log('Email submitted');
    }
  }

  // Step 2: Wait for password and enter
  await page.waitForTimeout(2000);
  const passwordInput = await page.$('input[type="password"]');
  console.log('Password input found:', !!passwordInput);

  if (passwordInput) {
    await passwordInput.fill('admin123');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('Password submitted');
  }

  // Wait for chat interface
  await page.waitForTimeout(3000);

  // Check for chat input
  const chatInput = await page.$('[contenteditable="true"]');
  console.log('Chat input found:', !!chatInput);

  // Take screenshot
  await page.screenshot({ path: 'test-results/quick-login-debug.png', fullPage: true });
  console.log('Screenshot saved');

  expect(chatInput).not.toBeNull();
});
