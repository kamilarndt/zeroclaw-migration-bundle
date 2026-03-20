const { test, expect } = require('@playwright/test');

test('Debug Open WebUI page structure', async ({ page }) => {
  console.log('🔍 Navigating to Open WebUI...');
  await page.goto('http://localhost:8080');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: 'screenshots/debug_page.png', fullPage: true });
  console.log('📸 Screenshot saved: screenshots/debug_page.png');

  // Get page title
  const title = await page.title();
  console.log(`📄 Page title: ${title}`);

  // Get current URL
  const url = page.url();
  console.log(`🌐 Current URL: ${url}`);

  // Try to get page content
  const bodyText = await page.evaluate(() => {
    return document.body.innerText.substring(0, 500);
  });
  console.log(`📝 Page content (first 500 chars):\n${bodyText}`);

  // Look for any input fields
  const inputs = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.map(input => ({
      type: input.type,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      className: input.className
    }));
  });
  console.log(`📋 Found ${inputs.length} input fields:`, JSON.stringify(inputs, null, 2));

  // Look for buttons
  const buttons = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.map(button => ({
      text: button.textContent?.trim(),
      type: button.type,
      className: button.className
    }));
  });
  console.log(`🔘 Found ${buttons.length} buttons:`, JSON.stringify(buttons, null, 2));

  // Check if we're already logged in
  const isLoggedIn = await page.evaluate(() => {
    // Check for common indicators of being logged in
    const hasChatButton = !!document.querySelector('button[aria-label="New Chat"]');
    const hasSettingsButton = !!document.querySelector('button:has-text("Settings")');
    const hasAdminButton = !!document.querySelector('a[href="/admin"]');
    return hasChatButton || hasSettingsButton || hasAdminButton;
  });

  console.log(`✅ Logged in: ${isLoggedIn}`);

  if (isLoggedIn) {
    console.log('🎉 Already logged in - no authentication needed!');
  }
});
