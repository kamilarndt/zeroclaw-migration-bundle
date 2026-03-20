import { test, expect } from '@playwright/test';

// Connect to Telegram Web and send real message to bot

test('connect to telegram web and send message', async ({ page, context }) => {
  // Set up realistic browser context
  await context.addInitScript(() => {
    // Override navigator.webdriver to appear as real browser
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  console.log('🌐 Navigating to Telegram Web...');

  // Navigate to Telegram Web
  await page.goto('https://web.telegram.org/');
  await page.waitForTimeout(3000);

  // Take screenshot of landing page
  await page.screenshot({ path: 'test-results/telegram-01-landing.png', fullPage: true });
  console.log('📸 Screenshot: telegram-01-landing.png');

  // Check current page state
  const url = page.url();
  console.log('Current URL:', url);

  // Look for login button or check if already logged in
  const loginSelectors = [
    'button:has-text("Log in")',
    'button:has-text("Sign in")',
    'button:has-text("Zaloguj się")',
    'a[href*="login"]',
    '.btn-primary'
  ];

  let needsLogin = false;
  for (const selector of loginSelectors) {
    try {
      const loginBtn = page.locator(selector).first();
      if (await loginBtn.isVisible({ timeout: 2000 })) {
        console.log('❌ Login required - waiting for manual login...');
        needsLogin = true;
        break;
      }
    } catch (e) {}
  }

  if (needsLogin) {
    console.log('⏳ Please login to Telegram Web in the browser window...');
    console.log('⏳ Waiting 60 seconds for login to complete...');

    // Wait for user to login (up to 60 seconds)
    await page.waitForTimeout(60000);

    // Take screenshot after login attempt
    await page.screenshot({ path: 'test-results/telegram-02-after-login.png', fullPage: true });
  }

  // Try to find and click search box
  console.log('🔍 Looking for search box...');

  const searchSelectors = [
    'input[placeholder*="Search"]',
    'input[placeholder*="Szukaj"]',
    '.search-input',
    'input[name="search"]',
    '#search'
  ];

  let searchBox = null;
  for (const selector of searchSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 })) {
        searchBox = el;
        console.log(`✅ Found search with: ${selector}`);
        break;
      }
    } catch (e) {}
  }

  if (!searchBox) {
    // Try clicking on the search icon/button first
    console.log('🔍 Trying to click search icon...');
    try {
      const searchIcon = page.locator('button[aria-label*="Search"], .icon-search, .search-button').first();
      if (await searchIcon.isVisible({ timeout: 2000 })) {
        await searchIcon.click();
        await page.waitForTimeout(1000);
        // Try finding search box again
        for (const selector of searchSelectors) {
          try {
            const el = page.locator(selector).first();
            if (await el.isVisible({ timeout: 2000 })) {
              searchBox = el;
              console.log(`✅ Found search after click: ${selector}`);
              break;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  if (searchBox) {
    console.log('📝 Searching for @karndt_bot...');
    await searchBox.click();
    await page.waitForTimeout(500);
    await searchBox.fill('@karndt_bot');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/telegram-03-search-results.png', fullPage: true });
    console.log('📸 Screenshot: telegram-03-search-results.png');

    // Look for bot in results and click
    console.log('🤖 Looking for bot in search results...');

    const botSelectors = [
      'text=karndt_bot',
      'text=Botomaz',
      '.chat-title:has-text("karndt_bot")',
      '.chat-title:has-text("Botomaz")'
    ];

    let botFound = false;
    for (const selector of botSelectors) {
      try {
        const botEl = page.locator(selector).first();
        if (await botEl.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found bot with: ${selector}`);
          await botEl.click();
          botFound = true;
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {}
    }

    if (botFound) {
      await page.screenshot({ path: 'test-results/telegram-04-bot-chat-open.png', fullPage: true });
      console.log('📸 Screenshot: telegram-04-bot-chat-open.png');

      // Find message input and send message
      console.log('💬 Sending message to bot...');

      const inputSelectors = [
        'input[placeholder*="Message"]',
        'div[contenteditable="true"]',
        'textarea',
        '.input-message',
        '#message-input'
      ];

      let messageInput = null;
      for (const selector of inputSelectors) {
        try {
          const inputs = page.locator(selector).all();
          for (const input of await inputs) {
            if (await input.isVisible()) {
              messageInput = input;
              console.log(`✅ Found input with: ${selector}`);
              break;
            }
          }
          if (messageInput) break;
        } catch (e) {}
      }

      if (messageInput) {
        const testMessage = 'test message from Playwright - what skills do you have?';
        await messageInput.click();
        await page.waitForTimeout(500);

        // Try different methods to fill the input
        try {
          await messageInput.fill(testMessage);
        } catch (e) {
          try {
            await messageInput.type(testMessage);
          } catch (e2) {
            // Try clicking and typing
            await messageInput.click({ force: true });
            await page.keyboard.type(testMessage);
          }
        }

        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/telegram-05-message-typed.png', fullPage: true });
        console.log('📸 Screenshot: telegram-05-message-typed.png');

        // Send the message
        console.log('📤 Sending message...');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);

        await page.screenshot({ path: 'test-results/telegram-06-message-sent.png', fullPage: true });
        console.log('📸 Screenshot: telegram-06-message-sent.png');
        console.log('✅ Message sent!');
      } else {
        console.log('❌ Message input not found');
      }
    } else {
      console.log('❌ Bot not found in search results');
    }
  } else {
    console.log('❌ Search box not found');
    await page.screenshot({ path: 'test-results/telegram-error-no-search.png', fullPage: true });
  }

  // Keep browser open for 10 seconds for manual inspection
  console.log('⏳ Keeping browser open for 10 seconds...');
  await page.waitForTimeout(10000);
});
