// Direct test of dashboard pages - shows what's actually happening
const { chromium } = require('playwright');

const AUTH_TOKEN = 'zc_8c38f7de16faa63fb0b9f9618a37867c1691bc99ebee7b72dd430b1c8391e21b';
const DASHBOARD_URL = 'https://dash.karndt.pl';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('=== STARTING TEST ===\n');

  // Login
  console.log('1. Logging in...');
  await page.goto(DASHBOARD_URL);
  await page.evaluate((tok) => {
    localStorage.setItem('zeroclaw_token', tok);
  }, AUTH_TOKEN);
  await page.reload();
  await page.waitForTimeout(3000);

  // Get all links and buttons on the page
  console.log('\n2. Finding navigation elements...');
  const allLinks = await page.locator('a').all();
  const allButtons = await page.locator('button').all();

  console.log(`   Found ${allLinks.length} links`);
  console.log(`   Found ${allButtons.length} buttons`);

  // List all link texts
  console.log('\n3. All link texts:');
  for (let i = 0; i < Math.min(allLinks.length, 20); i++) {
    const text = await allLinks[i].textContent();
    const href = await allLinks[i].getAttribute('href');
    if (text && text.trim()) {
      console.log(`   - "${text.trim()}" -> ${href || 'no href'}`);
    }
  }

  // List all button texts
  console.log('\n4. All button texts:');
  for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
    const text = await allButtons[i].textContent();
    if (text && text.trim()) {
      console.log(`   - "${text.trim()}"`);
    }
  }

  // Check current URL and page content
  console.log('\n5. Current page info:');
  console.log(`   URL: ${page.url()}`);
  console.log(`   Title: ${await page.title()}`);

  // Check for navigation menu/sidebar
  console.log('\n6. Looking for navigation structure...');
  const nav = await page.locator('nav').all();
  const sidebar = await page.locator('[class*="sidebar"], [class*="menu"], aside').all();

  console.log(`   Found ${nav.length} nav elements`);
  console.log(`   Found ${sidebar.length} sidebar elements`);

  if (sidebar.length > 0) {
    const sidebarContent = await sidebar[0].textContent();
    console.log('   Sidebar content:');
    console.log(`   ${sidebarContent}`);
  }

  // Try to find all clickable elements with specific text
  console.log('\n7. Looking for specific navigation items...');
  const sections = ['Dashboard', 'Tasks', 'Hands', 'Memory', 'SOPs', 'Config', 'Chat'];

  for (const section of sections) {
    // Try multiple selectors
    const selectors = [
      `a:has-text("${section}")`,
      `button:has-text("${section}")`,
      `[role="link"]:has-text("${section}")`,
      `[role="menuitem"]:has-text("${section}")`,
      `[data-testid="${section.toLowerCase()}"]`,
    ];

    let found = false;
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          console.log(`   ✓ ${section}: Found with selector "${selector}"`);
          found = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (!found) {
      console.log(`   ✗ ${section}: NOT FOUND`);
    }
  }

  // Take screenshot
  await page.screenshot({ path: '/tmp/dashboard-current.png', fullPage: true });
  console.log('\n8. Screenshot saved to /tmp/dashboard-current.png');

  // Get page HTML structure
  console.log('\n9. Page structure:');
  const bodyHTML = await page.locator('body').innerHTML();
  console.log('   Body HTML length:', bodyHTML.length);

  // Look for router/nav patterns
  if (bodyHTML.includes('react-router')) {
    console.log('   ✓ Uses React Router');
  }
  if (bodyHTML.includes('Router') || bodyHTML.includes('Route')) {
    console.log('   ✓ Has Router components');
  }

  // Wait for user to see what's happening
  console.log('\n=== Waiting 10 seconds for manual inspection ===');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
})();
