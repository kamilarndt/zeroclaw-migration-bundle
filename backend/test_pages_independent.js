// Test each page independently - refresh for each test
const { chromium } = require('playwright');

const AUTH_TOKEN = 'zc_8c38f7de16faa63fb0b9f9618a37867c1691bc99ebee7b72dd430b1c8391e21b';
const DASHBOARD_URL = 'https://dash.karndt.pl';

async function testPage(browser, section) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTING: ${section}`);
  console.log('='.repeat(60));

  // Login fresh
  await page.goto(DASHBOARD_URL);
  await page.evaluate((tok) => {
    localStorage.setItem('zeroclaw_token', tok);
  }, AUTH_TOKEN);
  await page.reload();
  await page.waitForTimeout(3000);

  // Click the section button
  const button = page.locator('button').filter({ hasText: section }).first();

  if (await button.count() === 0) {
    console.log(`  ❌ BUTTON NOT FOUND on dashboard`);
    await context.close();
    return { section, status: 'FAIL', reason: 'Button not found on dashboard' };
  }

  await button.click();
  await page.waitForTimeout(4000);

  // Get current state
  const url = page.url();
  const title = await page.title();
  const bodyText = await page.locator('body').textContent();
  const bodyHTML = await page.locator('body').innerHTML();

  console.log(`  URL: ${url}`);
  console.log(`  Title: ${title}`);

  // Check URL
  const urlChanged = url.includes(`/${section.toLowerCase()}`);
  console.log(`  URL changed: ${urlChanged ? '✅' : '❌'}`);

  // Check for sidebar
  const hasSidebar = bodyHTML.includes('Dashboard') && bodyHTML.includes('Tasks') &&
                     bodyHTML.includes('Hands') && bodyHTML.includes('Memory');
  console.log(`  Sidebar present: ${hasSidebar ? '✅' : '❌'}`);

  // Check content
  let hasContent = false;
  let contentDetails = '';

  if (section === 'Dashboard') {
    hasContent = bodyText.includes('Total Requests') || bodyText.includes('Active Hands');
    contentDetails = hasContent ? 'Metrics visible' : 'No metrics';
  } else if (section === 'Tasks') {
    hasContent = bodyText.includes('status') || bodyText.includes('Create');
    contentDetails = hasContent ? 'Task list visible' : 'No task list';
  } else if (section === 'Hands') {
    hasContent = bodyText.includes('Hands') || bodyText.includes('Active');
    contentDetails = hasContent ? 'Hands content visible' : 'No hands content';
  } else if (section === 'Memory') {
    hasContent = bodyText.includes('Memory') || bodyText.includes('node') || bodyText.includes('graph');
    contentDetails = hasContent ? 'Memory content visible' : 'No memory content';
  } else if (section === 'SOPs') {
    hasContent = bodyText.includes('SOP') || bodyText.includes('Procedure');
    contentDetails = hasContent ? 'SOP content visible' : 'No SOP content';
  } else if (section === 'Config') {
    hasContent = bodyText.includes('Provider') || bodyText.includes('API') || bodyText.includes('Settings');
    contentDetails = hasContent ? 'Config content visible' : 'No config content';
  } else if (section === 'Chat') {
    hasContent = bodyText.includes('Chat') || bodyText.includes('Message') || bodyText.includes('Send');
    contentDetails = hasContent ? 'Chat content visible' : 'No chat content';
  }

  console.log(`  Content: ${hasContent ? '✅' : '❌'} - ${contentDetails}`);
  console.log(`  HTML length: ${bodyHTML.length} chars`);

  // Check for errors
  const hasError = bodyText.includes('Error') || bodyText.includes('404') || bodyText.includes('Not Found');
  console.log(`  Errors: ${hasError ? '❌ YES' : '✅ NO'}`);

  // Screenshot
  const screenshotPath = `/tmp/indep-${section.toLowerCase()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  Screenshot: ${screenshotPath}`);

  await context.close();

  // Determine status
  if (!urlChanged) {
    return { section, status: 'FAIL', reason: 'URL did not change', details: contentDetails };
  }
  if (!hasContent) {
    return { section, status: 'PARTIAL', reason: 'URL changed but no content', details: contentDetails };
  }
  if (!hasSidebar) {
    return { section, status: 'WARNING', reason: 'Content OK but sidebar missing', details: contentDetails };
  }
  return { section, status: 'OK', details: contentDetails };
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });

  console.log('=== TESTING EACH PAGE INDEPENDENTLY ===\n');

  const sections = ['Dashboard', 'Tasks', 'Hands', 'Memory', 'SOPs', 'Config', 'Chat'];
  const results = [];

  for (const section of sections) {
    const result = await testPage(browser, section);
    results.push(result);
  }

  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const ok = results.filter(r => r.status === 'OK');
  const partial = results.filter(r => r.status === 'PARTIAL');
  const warning = results.filter(r => r.status === 'WARNING');
  const fail = results.filter(r => r.status === 'FAIL');

  console.log(`\n✅ Fully working (${ok.length}):`);
  ok.forEach(r => console.log(`   ${r.section} - ${r.details}`));

  if (partial.length > 0) {
    console.log(`\n⚠️  Partial (${partial.length}):`);
    partial.forEach(r => console.log(`   ${r.section} - ${r.reason}`));
  }

  if (warning.length > 0) {
    console.log(`\n⚠️  Warning (${warning.length}):`);
    warning.forEach(r => console.log(`   ${r.section} - ${r.reason}`));
  }

  if (fail.length > 0) {
    console.log(`\n❌ Failed (${fail.length}):`);
    fail.forEach(r => console.log(`   ${r.section} - ${r.reason}`));
  }

  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
})();
