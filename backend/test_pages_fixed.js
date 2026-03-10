// Test each page - fixed version
const { chromium } = require('playwright');

const AUTH_TOKEN = 'zc_8c38f7de16faa63fb0b9f9618a37867c1691bc99ebee7b72dd430b1c8391e21b';
const DASHBOARD_URL = 'https://dash.karndt.pl';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 800 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('=== TESTING EACH DASHBOARD PAGE ===\n');

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
    console.log(`\n${'='.repeat(50)}`);
    console.log(`TESTING: ${section}`);
    console.log('='.repeat(50));

    // First, go to dashboard to ensure fresh state
    try {
      const dashboardBtn = page.locator('button').filter({ hasText: 'Dashboard' }).first();
      if (await dashboardBtn.count() > 0) {
        await dashboardBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('  Note: Could not navigate to dashboard first');
    }

    // Click the section button
    try {
      const button = page.locator('button').filter({ hasText: section }).first();

      if (await button.count() > 0) {
        await button.click();
        await page.waitForTimeout(4000); // Longer wait for page to load

        // Get current state
        const url = page.url();
        const title = await page.title();
        const bodyText = await page.locator('body').textContent();
        const bodyHTML = await page.locator('body').innerHTML();

        console.log(`  URL: ${url}`);
        console.log(`  Title: ${title}`);

        // Check URL changed
        const urlChanged = url.includes(`/${section.toLowerCase()}`);
        console.log(`  URL changed to /${section.toLowerCase()}: ${urlChanged ? '✅ YES' : '❌ NO'}`);

        // Check for specific content
        let contentStatus = '❌ NO';
        let details = '';

        if (section === 'Dashboard') {
          const hasMetrics = bodyText.includes('Total Requests') || bodyText.includes('Active Hands');
          contentStatus = hasMetrics ? '✅ YES' : '❌ NO';
          details = hasMetrics ? 'Metrics visible' : 'No metrics';
        } else if (section === 'Tasks') {
          const hasTaskUI = bodyText.includes('status') || bodyText.includes('Create');
          contentStatus = hasTaskUI ? '✅ YES' : '❌ NO';
          details = hasTaskUI ? 'Task UI visible' : 'No task UI';
        } else if (section === 'Hands') {
          const hasHandsUI = bodyText.includes('Active') || bodyText.includes('Agent');
          contentStatus = hasHandsUI ? '✅ YES' : '⚠️ UNCERTAIN';
          details = hasHandsUI ? 'Hands UI visible' : 'Checking HTML...';
          if (!hasHandsUI) {
            details += ` HTML length: ${bodyHTML.length}`;
          }
        } else if (section === 'Memory') {
          const hasMemoryUI = bodyText.includes('node') || bodyText.includes('graph') || bodyText.includes('search');
          contentStatus = hasMemoryUI ? '✅ YES' : '❌ NO';
          details = hasMemoryUI ? 'Memory UI visible' : 'No memory UI';
        } else if (section === 'SOPs') {
          const hasSopUI = bodyText.includes('SOP') || bodyText.includes('procedure');
          contentStatus = hasSopUI ? '✅ YES' : '❌ NO';
          details = hasSopUI ? 'SOP UI visible' : 'No SOP UI';
        } else if (section === 'Config') {
          const hasConfigUI = bodyText.includes('Provider') || bodyText.includes('API') || bodyText.includes('Settings');
          contentStatus = hasConfigUI ? '✅ YES' : '❌ NO';
          details = hasConfigUI ? 'Config UI visible' : 'No config UI';
        } else if (section === 'Chat') {
          const hasChatUI = bodyText.includes('Message') || bodyText.includes('Send') || bodyText.includes('input');
          contentStatus = hasChatUI ? '✅ YES' : '❌ NO';
          details = hasChatUI ? 'Chat UI visible' : 'No chat UI';
        }

        console.log(`  Content: ${contentStatus}`);
        console.log(`  Details: ${details}`);

        // Take screenshot
        const screenshotPath = `/tmp/test-${section.toLowerCase()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  Screenshot: ${screenshotPath}`);

        results[section] = {
          url,
          urlChanged,
          content: contentStatus,
          details
        };

      } else {
        console.log(`  ❌ Button NOT FOUND`);
        results[section] = { error: 'Button not found' };
      }
    } catch (e) {
      console.log(`  ❌ ERROR: ${e.message}`);
      results[section] = { error: e.message };
    }
  }

  // Print summary
  console.log(`\n\n${'='.repeat(50)}`);
  console.log('SUMMARY');
  console.log('='.repeat(50));

  for (const [section, result] of Object.entries(results)) {
    if (result.error) {
      console.log(`❌ ${section}: ERROR - ${result.error}`);
    } else if (result.urlChanged && result.content.includes('YES')) {
      console.log(`✅ ${section}: WORKS - ${result.details}`);
    } else if (result.urlChanged && result.content.includes('UNCERTAIN')) {
      console.log(`⚠️  ${section}: UNCERTAIN - ${result.details}`);
    } else {
      console.log(`❌ ${section}: DOES NOT WORK`);
      console.log(`     URL changed: ${result.urlChanged}`);
      console.log(`     Content: ${result.content}`);
      console.log(`     Details: ${result.details}`);
    }
  }

  // Wait for manual inspection
  console.log('\n=== Waiting 10 seconds for manual inspection ===');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
})();
