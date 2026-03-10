// Quick test of Hands and Chat pages
const { chromium } = require('playwright');

const AUTH_TOKEN = 'zc_8c38f7de16faa63fb0b9f9618a37867c1691bc99ebee7b72dd430b1c8391e21b';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });

  // Login
  console.log('Logging in...');
  await page.goto('https://dash.karndt.pl');
  await page.evaluate((tok) => {
    localStorage.setItem('zeroclaw_token', tok);
  }, AUTH_TOKEN);
  await page.reload();
  await page.waitForTimeout(5000);

  // Test Hands
  console.log('\n=== Testing Hands ===');
  try {
    const handsLink = page.locator('menuitem').filter({ hasText: 'Hands' });
    await handsLink.click();
    await page.waitForTimeout(4000);

    const url = page.url();
    const body = await page.locator('body').textContent();
    const html = await page.locator('body').innerHTML();

    console.log('URL:', url);
    console.log('Body length:', body.length);
    console.log('HTML length:', html.length);
    console.log('Has "Hands":', body.includes('Hands'));
    console.log('Has "Active":', body.includes('Active'));
    console.log('Preview:', body.substring(0, 300));

    await page.screenshot({ path: '/tmp/hands-test.png', fullPage: true });

  } catch (e) {
    console.log('Hands error:', e.message);
  }

  // Go to dashboard first
  await page.goto('https://dash.karndt.pl/dashboard');
  await page.waitForTimeout(2000);

  // Test Chat
  console.log('\n=== Testing Chat ===');
  try {
    const chatLink = page.locator('menuitem').filter({ hasText: 'Chat' });
    await chatLink.click();
    await page.waitForTimeout(4000);

    const url = page.url();
    const body = await page.locator('body').textContent();
    const html = await page.locator('body').innerHTML();

    console.log('URL:', url);
    console.log('Body length:', body.length);
    console.log('HTML length:', html.length);
    console.log('Has "Chat":', body.includes('Chat'));
    console.log('Has "Hello":', body.includes('Hello'));
    console.log('Preview:', body.substring(0, 300));

    await page.screenshot({ path: '/tmp/chat-test.png', fullPage: true });

  } catch (e) {
    console.log('Chat error:', e.message);
  }

  console.log('\nWaiting 10 seconds...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('DONE');
})();
