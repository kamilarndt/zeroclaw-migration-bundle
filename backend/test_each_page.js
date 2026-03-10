// Test each page individually - what actually works
const { chromium } = require('playwright');

const AUTH_TOKEN = 'zc_8c38f7de16faa63fb0b9f9618a37867c1691bc99ebee7b72dd430b1c8391e21b';
const DASHBOARD_URL = 'https://dash.karndt.pl';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('=== TESTING EACH PAGE ===\n');

  // Login
  console.log('Logging in...');
  await page.goto(DASHBOARD_URL);
  await page.evaluate((tok) => {
    localStorage.setItem('zeroclaw_token', tok);
  }, AUTH_TOKEN);
  await page.reload();
  await page.waitForTimeout(3000);

  const sections = ['Dashboard', 'Tasks', 'Hands', 'Memory', 'SOPs', 'Config', 'Chat'];
  const results = {};

  for (const section of sections) {
    console.log(`\n--- Testing ${section} ---`);

    // Click the button
    const button = page.locator(`button:has-text("${section}")`).first();

    if (await button.count() > 0) {
      await button.click();
      await page.waitForTimeout(3000);

      // Get current state
      const url = page.url();
      const title = await page.title();
      const bodyText = await page.locator('body').textContent();

      // Check if content changed
      const hasSectionContent = bodyText.toLowerCase().includes(section.toLowerCase());

      console.log(`  URL: ${url}`);
      console.log(`  Title: ${title}`);
      console.log(`  Content includes "${section}": ${hasSectionContent}`);

      // Try to find section-specific content
      let specificContent = 'No specific content found';

      if (section === 'Tasks') {
        const hasTaskList = bodyText.includes('status') || bodyText.includes('created');
        const hasCreateButton = await page.locator('button').filter({ hasText: /create|add|new/i }).count() > 0;
        specificContent = `Task list: ${hasTaskList}, Create button: ${hasCreateButton}`;
      } else if (section === 'Memory') {
        const hasGraph = bodyText.includes('node') || bodyText.includes('graph');
        const hasSearch = await page.locator('input[placeholder*="search"], input[placeholder*="Search"]').count() > 0;
        specificContent = `Graph elements: ${hasGraph}, Search: ${hasSearch}`;
      } else if (section === 'Config') {
        const hasSettings = bodyText.includes('provider') || bodyText.includes('api');
        const hasForm = await page.locator('input, select').count() > 0;
        specificContent = `Settings: ${hasSettings}, Form fields: ${hasForm}`;
      } else if (section === 'Chat') {
        const hasMessages = bodyText.includes('message') || bodyText.includes('conversation');
        const hasInput = await page.locator('textarea, input[type="text"]').count() > 0;
        const hasSendButton = await page.locator('button').filter({ hasText: /send|wyślij/i }).count() > 0;
        specificContent = `Messages: ${hasMessages}, Input: ${hasInput}, Send: ${hasSendButton}`;
      }

      console.log(`  Specific: ${specificContent}`);

      // Take screenshot
      await page.screenshot({ path: `/tmp/test-${section.toLowerCase()}.png`, fullPage: true });
      console.log(`  Screenshot: /tmp/test-${section.toLowerCase()}.png`);

      results[section] = {
        url,
        title,
        hasContent: hasSectionContent,
        specificContent
      };

      // Go back to dashboard
      await page.locator('button:has-text("Dashboard")').first().click();
      await page.waitForTimeout(2000);

    } else {
      console.log(`  ❌ Button NOT FOUND`);
      results[section] = { error: 'Button not found' };
    }
  }

  // Summary
  console.log('\n\n=== SUMMARY ===');
  for (const [section, result] of Object.entries(results)) {
    if (result.error) {
      console.log(`❌ ${section}: ${result.error}`);
    } else if (result.hasContent || result.url.includes(section.toLowerCase())) {
      console.log(`✅ ${section}: WORKS`);
    } else {
      console.log(`⚠️  ${section}: Unclear - URL: ${result.url}`);
    }
  }

  console.log('\n=== Waiting 5 seconds before closing ===');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('\n=== DONE ===');
})();
