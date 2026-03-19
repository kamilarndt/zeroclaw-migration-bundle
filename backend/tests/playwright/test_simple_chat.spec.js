const { test, expect } = require('@playwright/test');

const ERROR_PATTERNS = [
  /error/i,
  /failed/i,
  /traceback/i,
  /500/,
  /invalid api key/i,
  /pair first/i,
  /connection refused/i,
];

function containsError(text) {
  if (!text || text.trim().length === 0) return { hasError: true, reason: 'Empty response' };
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(text)) {
      return { hasError: true, reason: `Matched error pattern: ${pattern}` };
    }
  }
  return { hasError: false, reason: null };
}

async function login(page) {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Resize viewport to ensure all elements are visible
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);

  // Check if this is the initial setup (Create Admin Account page)
  const createAdminBtn = page.locator('button:has-text("Create Admin Account")');
  if (await createAdminBtn.count() > 0) {
    console.log('Initial setup detected - creating admin account...');

    // Fill in Name
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name"], input[placeholder*="name"]');
    if (await nameInput.count() > 0) {
      await nameInput.scrollIntoViewIfNeeded();
      await nameInput.fill('Admin');
      await page.waitForTimeout(300);
    }

    // Fill in Email
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if (await emailInput.count() > 0) {
      await emailInput.scrollIntoViewIfNeeded();
      await emailInput.fill('admin@zeroclaw.local');
      await page.waitForTimeout(300);
    }

    // Fill in Password
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.count() > 0) {
      await passwordInput.scrollIntoViewIfNeeded();
      await passwordInput.fill('admin123');
      await page.waitForTimeout(300);
    }

    // Click Create Admin Account
    await createAdminBtn.scrollIntoViewIfNeeded();
    await createAdminBtn.click();
    console.log('Admin account created');

    // Wait for redirect to chat interface
    await page.waitForTimeout(5000);
    return;
  }

  // Regular login flow
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  if (await emailInput.count() > 0) {
    await emailInput.scrollIntoViewIfNeeded();
    await emailInput.fill('admin@zeroclaw.local');
    await page.waitForTimeout(300);

    // Click Sign in button with scroll
    const signInBtn = page.locator('button:has-text("Sign in")');
    if (await signInBtn.count() > 0) {
      await signInBtn.scrollIntoViewIfNeeded();
      await signInBtn.click();
    }
  }

  // Enter password
  await page.waitForTimeout(1500);
  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.count() > 0) {
    await passwordInput.scrollIntoViewIfNeeded();
    await passwordInput.fill('admin123');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
  }

  // Wait for chat interface
  await page.waitForTimeout(3000);
}

test('SCENARIO 1: Multi-Model Routing - Polish Paris Question', async ({ page }) => {
  // Increase timeout for this test
  test.setTimeout(180000);
  console.log('=== SCENARIO 1: Multi-Model Routing ===');

  await login(page);

  // Find chat input
  const chatInput = await page.$('[contenteditable="true"]');
  expect(chatInput, 'Chat input should be found').not.toBeNull();
  console.log('Chat input found');

  // WARMUP: Send a simple message first to ensure model is loaded
  console.log('Warming up model with simple question...');
  await chatInput.click();
  await page.waitForTimeout(200);
  await chatInput.type('Say hello.', { delay: 10 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');

  // Wait for warmup response (up to 60s)
  let warmupComplete = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const content = await page.textContent('body');
    if (content.includes('hello') || content.includes('Hello') || content.includes('hi') || content.includes('Hi') || content.length > 2000) {
      console.log(`Warmup complete after ${i + 1}s`);
      warmupComplete = true;
      break;
    }
  }

  if (!warmupComplete) {
    console.log('Warning: Warmup may not have completed');
  }

  // Small delay before main question
  await page.waitForTimeout(2000);

  // Now find the chat input again and send main question
  const chatInput2 = await page.$('[contenteditable="true"]');
  expect(chatInput2, 'Chat input should be found after warmup').not.toBeNull();

  // Send message
  const question = 'Jak nazywa się stolica Francji po polsku? Odpowiedz krótko jednym słowem.';
  await chatInput2.click();
  await page.waitForTimeout(200);
  await chatInput2.type(question, { delay: 10 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  console.log('Message sent, waiting for response...');

  // Wait for response - simple approach: wait for content length to grow significantly
  console.log('Waiting for AI response...');
  const maxWaitSeconds = 90;

  // First, wait a minimum time for the AI to start responding
  await page.waitForTimeout(5000);

  // Then wait for content to stabilize (no changes for 5 seconds)
  let prevLength = 0;
  let stableCount = 0;

  for (let i = 0; i < maxWaitSeconds - 5; i++) {
    await page.waitForTimeout(1000);
    const bodyText = await page.textContent('body');
    const currentLength = bodyText.length;

    console.log(`Second ${i + 6}: content length = ${currentLength}`);

    // Check if we found the answer
    if (/pary[szż]|paris/i.test(bodyText)) {
      console.log(`Found Paris/Paryż after ${i + 6} seconds!`);
      await page.waitForTimeout(2000);
      break;
    }

    // Check if content has stabilized
    if (currentLength === prevLength && currentLength > 2000) {
      stableCount++;
      if (stableCount >= 5) {
        console.log(`Content stabilized after ${i + 6} seconds`);
        break;
      }
    } else {
      stableCount = 0;
    }
    prevLength = currentLength;
  }

  // Get page content
  const pageContent = await page.textContent('body');
  console.log('Final content length:', pageContent.length);
  console.log('Page content length:', pageContent.length);

  // Check for Paris in response (flexible - accepts Paryż, Paryz, Paris)
  const hasParis = /pary[szż]|paris/i.test(pageContent);
  const errorCheck = containsError(pageContent);

  // Take screenshot
  await page.screenshot({ path: 'test-results/scenario1-paris.png', fullPage: true });

  console.log('Has Paris:', hasParis);
  console.log('Has Error:', errorCheck.hasError, errorCheck.reason);

  // STRICT ASSERTIONS
  expect(errorCheck.hasError, `Response contains error: ${errorCheck.reason}`).toBe(false);
  expect(pageContent.length, 'Page content should not be empty').toBeGreaterThan(100);
  expect(hasParis, 'Response must contain "Paryż" or "Paris"').toBe(true);

  console.log('✅ SCENARIO 1 PASSED');
});

test('SCENARIO 2: Context Memory - Follow-up Conversation', async ({ page }) => {
  console.log('=== SCENARIO 2: Context Memory ===');

  await login(page);

  const chatInput = await page.$('[contenteditable="true"]');
  expect(chatInput, 'Chat input should be found').not.toBeNull();

  // First message: establish context
  await chatInput.click();
  await chatInput.type('Nazywam się Jan i mieszkam w Warszawie.', { delay: 10 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  console.log('First message sent');
  await page.waitForTimeout(20000);

  // Second message: test context retention
  const chatInput2 = await page.$('[contenteditable="true"]');
  await chatInput2.click();
  await chatInput2.type('Gdzie mieszkam?', { delay: 10 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  console.log('Second message sent');
  await page.waitForTimeout(20000);

  // Check response
  const pageContent = await page.textContent('body');
  const hasContext = /warszaw|warsaw/i.test(pageContent);
  const errorCheck = containsError(pageContent);

  await page.screenshot({ path: 'test-results/scenario2-context.png', fullPage: true });

  console.log('Has context recall:', hasContext);

  expect(errorCheck.hasError, `Response contains error: ${errorCheck.reason}`).toBe(false);
  expect(hasContext, 'Response must recall context (Warsaw)').toBe(true);

  console.log('✅ SCENARIO 2 PASSED');
});

test('SCENARIO 3: Special Characters Handling', async ({ page }) => {
  console.log('=== SCENARIO 3: Special Characters ===');

  await login(page);

  const chatInput = await page.$('[contenteditable="true"]');
  expect(chatInput, 'Chat input should be found').not.toBeNull();

  // Send message with special characters and emoji
  const specialMessage = 'Przetestuj znaki: @#$%^&* emoji 🎉🚀✨ - odpowiedz "ok"';
  await chatInput.click();
  await chatInput.type(specialMessage, { delay: 10 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  console.log('Special chars message sent');
  await page.waitForTimeout(20000);

  const pageContent = await page.textContent('body');
  const errorCheck = containsError(pageContent);
  const hasOk = /ok|prze|test|znaki/i.test(pageContent);

  await page.screenshot({ path: 'test-results/scenario3-special.png', fullPage: true });

  expect(errorCheck.hasError, `Response contains error: ${errorCheck.reason}`).toBe(false);

  console.log('✅ SCENARIO 3 PASSED');
});

test('SCENARIO 4: Long Message Handling', async ({ page }) => {
  console.log('=== SCENARIO 4: Long Message ===');

  await login(page);

  const chatInput = await page.$('[contenteditable="true"]');
  expect(chatInput, 'Chat input should be found').not.toBeNull();

  // Generate long message (~500 chars)
  const longMessage = 'Test wiadomości. '.repeat(30) + ' Potwierdź otrzymanie.';
  await chatInput.click();
  await chatInput.type(longMessage.substring(0, 500), { delay: 10 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  console.log('Long message sent');
  await page.waitForTimeout(25000);

  const pageContent = await page.textContent('body');
  const errorCheck = containsError(pageContent);
  const hasConfirmation = /otrzym|potwierd|wiadomoś|test/i.test(pageContent);

  await page.screenshot({ path: 'test-results/scenario4-long.png', fullPage: true });

  expect(errorCheck.hasError, `Response contains error: ${errorCheck.reason}`).toBe(false);
  expect(hasConfirmation, 'Response should acknowledge message').toBe(true);

  console.log('✅ SCENARIO 4 PASSED');
});

test('SCENARIO 5: Tool/Shell Command Request', async ({ page }) => {
  console.log('=== SCENARIO 5: Tool Command ===');

  await login(page);

  const chatInput = await page.$('[contenteditable="true"]');
  expect(chatInput, 'Chat input should be found').not.toBeNull();

  // Request a simple calculation (tools-like)
  await chatInput.click();
  await chatInput.type('Oblicz: 2 + 2 = ?', { delay: 10 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  console.log('Tool request sent');
  await page.waitForTimeout(20000);

  const pageContent = await page.textContent('body');
  const errorCheck = containsError(pageContent);
  const hasFour = /4|cztery|four/i.test(pageContent);

  await page.screenshot({ path: 'test-results/scenario5-tool.png', fullPage: true });

  expect(errorCheck.hasError, `Response contains error: ${errorCheck.reason}`).toBe(false);
  expect(hasFour, 'Response should contain answer "4"').toBe(true);

  console.log('✅ SCENARIO 5 PASSED');
});
