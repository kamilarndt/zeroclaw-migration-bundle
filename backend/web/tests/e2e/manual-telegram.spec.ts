import { test } from '@playwright/test';

// Manual test - opens browser for manual Telegram testing
// This test keeps the browser open indefinitely for manual interaction

test('manual telegram testing - browser stays open', async ({ page }) => {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  MANUAL TELEGRAM TEST                                   ║');
  console.log('║  Browser will stay open for manual testing              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Navigate to Telegram Web
  await page.goto('https://web.telegram.org/');
  console.log('🌐 Opened: https://web.telegram.org/');

  await page.waitForTimeout(3000);

  // Take initial screenshot
  await page.screenshot({ path: 'test-results/manual-telegram-01.png', fullPage: true });
  console.log('📸 Screenshot: test-results/manual-telegram-01.png');

  console.log('');
  console.log('📋 INSTRUCTIONS:');
  console.log('   1. Login to Telegram Web if needed');
  console.log('   2. Search for @karndt_bot');
  console.log('   3. Send message: "what skills do you have?"');
  console.log('   4. Check if bot responds with thread-specific skills');
  console.log('');
  console.log('⏳ Browser will stay open for 5 minutes...');
  console.log('   Press Ctrl+C to stop earlier');
  console.log('');

  // Keep browser open for manual testing (5 minutes)
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(30000); // 30 seconds
    console.log(`⏳ ${i * 30}s elapsed... (${5 - i * 0.5} minutes remaining)`);

    // Take periodic screenshots
    await page.screenshot({ path: `test-results/manual-telegram-${i + 1}.png`, fullPage: true });
  }

  console.log('✅ Test completed - browser closing');
});
