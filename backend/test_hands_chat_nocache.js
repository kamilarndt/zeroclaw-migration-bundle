// Test with cache bypassed
const { chromium } = require('playwright');

const AUTH_TOKEN = 'zc_8c38f7de16faa63fb0b9f9618a37867c1691bc99ebee7b72dd430b1c8391e21b';

(async () => {
  // Launch with clear cache
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security']
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    // Bypass cache
    ignoreHTTPSErrors: true
  });

  // Clear cache
  await context.clearCookies();
  await context.clearPermissions();

  const page = await context.newPage();

  // Listen for errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('JS Error:', msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.toString());
    console.log('Page Error:', err.toString());
  });

  // Login
  console.log('Logging in...');
  await page.goto('https://dash.karndt.pl', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate((tok) => {
    localStorage.setItem('zeroclaw_token', tok);
    // Clear all caches
    if (window.caches) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
  }, AUTH_TOKEN);
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Check loaded JS file
  const jsFiles = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    return scripts.map(s => s.src);
  });
  console.log('Loaded JS files:', jsFiles.filter(s => s.includes('index')));

  // Test Hands
  console.log('\n=== Testing Hands ===');
  try {
    // Find and click Hands using multiple selectors
    const handsSelectors = [
      'menuitem:has-text("Hands")',
      'a:has-text("Hands")',
      'button:has-text("Hands")',
      '[role="menuitem"]:has-text("Hands")',
      '[data-page="hands"]',
    ];

    let clicked = false;
    for (const selector of handsSelectors) {
      try {
        const elem = page.locator(selector).first();
        if (await elem.count() > 0) {
          console.log(`  Clicking with selector: ${selector}`);
          await elem.click();
          clicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!clicked) {
      console.log('  Could not find Hands button');
    } else {
      await page.waitForTimeout(4000);

      const url = page.url();
      const body = await page.locator('body').textContent();
      const html = await page.locator('body').innerHTML();

      console.log('  URL:', url);
      console.log('  Body length:', body.length);
      console.log('  HTML length:', html.length);
      console.log('  Has Hands content:', body.includes('Active Hands') || body.includes('Hands') || html.includes('Hands'));

      await page.screenshot({ path: '/tmp/hands-nocache.png', fullPage: true });
      console.log('  Screenshot: /tmp/hands-nocache.png');
    }

  } catch (e) {
    console.log('  Hands error:', e.message);
  }

  // Go back to dashboard
  await page.goto('https://dash.karndt.pl/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Test Chat
  console.log('\n=== Testing Chat ===');
  try {
    const chatSelectors = [
      'menuitem:has-text("Chat")',
      'a:has-text("Chat")',
      'button:has-text("Chat")',
      '[role="menuitem"]:has-text("Chat")',
      '[data-page="chat"]',
    ];

    let clicked = false;
    for (const selector of chatSelectors) {
      try {
        const elem = page.locator(selector).first();
        if (await elem.count() > 0) {
          console.log(`  Clicking with selector: ${selector}`);
          await elem.click();
          clicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!clicked) {
      console.log('  Could not find Chat button');
    } else {
      await page.waitForTimeout(4000);

      const url = page.url();
      const body = await page.locator('body').textContent();
      const html = await page.locator('body').innerHTML();

      console.log('  URL:', url);
      console.log('  Body length:', body.length);
      console.log('  HTML length:', html.length);
      console.log('  Has Chat content:', body.includes('Chat') || body.includes('Hello') || body.includes('Message'));

      await page.screenshot({ path: '/tmp/chat-nocache.png', fullPage: true });
      console.log('  Screenshot: /tmp/chat-nocache.png');
    }

  } catch (e) {
    console.log('  Chat error:', e.message);
  }

  console.log('\n=== Errors Summary ===');
  console.log(`Total errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Errors:', errors.slice(0, 5));
  }

  console.log('\nWaiting 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('\nDONE');
})();
