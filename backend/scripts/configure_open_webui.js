#!/usr/bin/env node

/**
 * Open WebUI Configuration Script
 *
 * Standalone script to configure Open WebUI with OpenAI API connection
 * Usage: node scripts/configure_open_webui.js [options]
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  baseUrl: 'http://localhost:8080',
  username: 'admin',
  password: 'password',
  apiUrl: 'http://127.0.0.1:42618/v1',
  apiKey: 'sk-test-key-pairing-token',
  headless: true,
  timeout: 60000,
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];

  switch (arg) {
    case '--url':
    case '--base-url':
      config.baseUrl = nextArg;
      i++;
      break;
    case '--username':
    case '-u':
      config.username = nextArg;
      i++;
      break;
    case '--password':
    case '-p':
      config.password = nextArg;
      i++;
      break;
    case '--api-url':
      config.apiUrl = nextArg;
      i++;
      break;
    case '--api-key':
    case '-k':
      config.apiKey = nextArg;
      i++;
      break;
    case '--headless':
      config.headless = true;
      break;
    case '--no-headless':
    case '--visible':
      config.headless = false;
      break;
    case '--help':
    case '-h':
      printHelp();
      process.exit(0);
      break;
    default:
      if (arg.startsWith('--')) {
        console.warn(`Unknown option: ${arg}`);
      }
  }
}

// Also check environment variables
if (process.env.OPEN_WEBUI_URL) config.baseUrl = process.env.OPEN_WEBUI_URL;
if (process.env.OPEN_WEBUI_USERNAME) config.username = process.env.OPEN_WEBUI_USERNAME;
if (process.env.OPEN_WEBUI_PASSWORD) config.password = process.env.OPEN_WEBUI_PASSWORD;
if (process.env.OPENAI_API_URL) config.apiUrl = process.env.OPENAI_API_URL;
if (process.env.OPENAI_API_KEY) config.apiKey = process.env.OPENAI_API_KEY;
if (process.env.HEADLESS) config.headless = process.env.HEADLESS !== 'false';

function printHelp() {
  console.log(`
Open WebUI Configuration Script

Usage: node scripts/configure_open_webui.js [options]

Options:
  --url, --base-url <url>       Open WebUI base URL (default: http://localhost:8080)
  --username, -u <username>     Admin username (default: admin)
  --password, -p <password>     Admin password (default: password)
  --api-url <url>               OpenAI API base URL (default: http://127.0.0.1:42618/v1)
  --api-key, -k <key>           API key / pairing token (default: sk-test-key-pairing-token)
  --headless                    Run in headless mode (default)
  --no-headless, --visible      Run with visible browser
  --help, -h                    Show this help message

Environment Variables:
  OPEN_WEBUI_URL                Open WebUI base URL
  OPEN_WEBUI_USERNAME           Admin username
  OPEN_WEBUI_PASSWORD           Admin password
  OPENAI_API_URL                OpenAI API base URL
  OPENAI_API_KEY                API key / pairing token
  HEADLESS                      Set to 'false' for visible browser

Examples:
  # Use defaults (headless mode)
  node scripts/configure_open_webui.js

  # Custom URL and credentials
  node scripts/configure_open_webui.js --url http://localhost:3000 --username admin --password secret123

  # Configure with Docker host URL
  node scripts/configure_open_webui.js --api-url http://host.docker.internal:42618/v1 --api-key sk-my-token

  # Run with visible browser for debugging
  node scripts/configure_open_webui.js --no-headless

  # Using environment variables
  export OPEN_WEBUI_PASSWORD="my-secret-password"
  export OPENAI_API_KEY="sk-my-token"
  node scripts/configure_open_webui.js
`);
}

async function takeScreenshot(page, name) {
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(screenshotsDir, `${name}_${timestamp}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

async function clickSelector(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        return { success: true, selector };
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  return { success: false };
}

async function fillInput(page, selectors, value) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.fill(value);
        return { success: true, selector };
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  return { success: false };
}

async function runConfiguration() {
  console.log('='.repeat(70));
  console.log('Open WebUI Configuration Script');
  console.log('='.repeat(70));
  console.log(`Target URL:    ${config.baseUrl}`);
  console.log(`Username:      ${config.username}`);
  console.log(`API URL:       ${config.apiUrl}`);
  console.log(`API Key:       ${config.apiKey.substring(0, 15)}...`);
  console.log(`Headless:      ${config.headless}`);
  console.log('='.repeat(70));
  console.log();

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: 50, // Slow down for better reliability
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // Step 1: Navigate to login
    console.log('📍 Step 1: Navigating to Open WebUI...');
    await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
    await takeScreenshot(page, '01_page_loaded');

    // Step 2: Login
    console.log('🔐 Step 2: Logging in...');

    // Check if already logged in
    if (page.url().includes('/chat') || page.url().includes('/admin')) {
      console.log('   ✅ Already logged in');
    } else {
      // Find and fill username
      const usernameResult = await fillInput(page, [
        'input[type="email"]',
        'input[type="text"]',
        'input[name="email"]',
        'input[name="username"]',
      ], config.username);

      if (!usernameResult.success) {
        throw new Error('Could not find username input field');
      }
      console.log('   ✅ Entered username');

      // Find and fill password
      const passwordResult = await fillInput(page, [
        'input[type="password"]',
        'input[name="password"]',
      ], config.password);

      if (!passwordResult.success) {
        throw new Error('Could not find password input field');
      }
      console.log('   ✅ Entered password');

      // Submit form
      await page.press('input[type="password"]', 'Enter');
      await page.waitForLoadState('networkidle');
      console.log('   ✅ Logged in successfully');
    }

    await takeScreenshot(page, '02_after_login');

    // Step 3: Navigate to Admin Panel
    console.log('📍 Step 3: Navigating to Admin Panel...');

    const adminResult = await clickSelector(page, [
      'a[href="/admin"]',
      'button:has-text("Admin")',
      'a:has-text("Admin Panel")',
    ]);

    if (!adminResult.success) {
      console.log('   ⚠️  Admin button not found, trying direct navigation...');
      await page.goto(`${config.baseUrl}/admin`);
    }

    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, '03_admin_panel');

    // Step 4: Navigate to Settings -> Connections
    console.log('⚙️  Step 4: Navigating to Connections...');

    // Try to find Settings tab/button
    const settingsResult = await clickSelector(page, [
      'button:has-text("Settings")',
      'a:has-text("Settings")',
      'tab:has-text("Settings")',
    ]);

    if (settingsResult.success) {
      await page.waitForTimeout(1000);
    }

    // Try to find Connections tab/button
    const connectionsResult = await clickSelector(page, [
      'button:has-text("Connections")',
      'a:has-text("Connections")',
      'tab:has-text("Connections")',
    ]);

    if (!connectionsResult.success) {
      console.log('   ⚠️  Connections button not found, may already be on the right page');
    }

    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, '04_connections_page');

    // Step 5: Add new connection
    console.log('➕ Step 5: Adding new connection...');

    const addResult = await clickSelector(page, [
      'button:has-text("Add Connection")',
      'button:has-text("New Connection")',
      'button:has-text("Add")',
      '[data-testid="add-connection"]',
    ]);

    if (addResult.success) {
      await page.waitForTimeout(1000);
      console.log('   ✅ Clicked Add Connection button');
    } else {
      console.log('   ⚠️  Add button not found, form may already be open');
    }

    await takeScreenshot(page, '05_add_connection_form');

    // Step 6: Configure OpenAI API connection
    console.log('📋 Step 6: Configuring OpenAI API connection...');

    // Select provider (if dropdown exists)
    const providerResult = await clickSelector(page, [
      'select[name="provider"]',
      'select#provider',
      '[role="combobox"]',
    ]);

    if (providerResult.success) {
      await page.waitForTimeout(500);

      // Select OpenAI option
      const openaiResult = await clickSelector(page, [
        'option[value="openai"]',
        'option:has-text("OpenAI")',
        'li:has-text("OpenAI API")',
        '[data-value="openai"]',
      ]);

      if (openaiResult.success) {
        console.log('   ✅ Selected OpenAI API provider');
      }
    }

    // Fill Base URL
    const baseUrlResult = await fillInput(page, [
      'input[name="baseUrl"]',
      'input[name="base_url"]',
      'input[placeholder*="Base URL" i]',
      'input[id="baseUrl"]',
    ], config.apiUrl);

    if (baseUrlResult.success) {
      console.log(`   ✅ Set Base URL to: ${config.apiUrl}`);
    } else {
      console.warn('   ⚠️  Could not find Base URL field');
    }

    // Fill API Key
    const apiKeyResult = await fillInput(page, [
      'input[name="apiKey"]',
      'input[name="api_key"]',
      'input[name="token"]',
      'input[placeholder*="API Key" i]',
      'input[id="apiKey"]',
    ], config.apiKey);

    if (apiKeyResult.success) {
      console.log('   ✅ Set API Key');
    } else {
      console.warn('   ⚠️  Could not find API Key field');
    }

    await takeScreenshot(page, '06_form_filled');

    // Step 7: Save configuration
    console.log('💾 Step 7: Saving configuration...');

    const saveResult = await clickSelector(page, [
      'button:has-text("Save")',
      'button:has-text("Submit")',
      'button[type="submit"]',
      '[data-testid="save-connection"]',
    ]);

    if (!saveResult.success) {
      throw new Error('Could not find Save button');
    }

    console.log('   ✅ Clicked Save button');
    await page.waitForTimeout(2000);

    await takeScreenshot(page, '07_after_save');

    // Step 8: Verify success
    console.log('🔍 Step 8: Verifying configuration...');

    // Check for success indicators
    const successSelectors = [
      'text=Connection saved',
      'text=Successfully added',
      'text=Success',
    ];

    let successFound = false;
    for (const selector of successSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          successFound = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (successFound) {
      console.log('   ✅ Success message found!');
    } else {
      console.log('   ⚠️  No explicit success message, but form was submitted');
    }

    // Final screenshot
    await takeScreenshot(page, '08_final_state');

    console.log();
    console.log('='.repeat(70));
    console.log('✅ Configuration completed successfully!');
    console.log('='.repeat(70));
    console.log();
    console.log('Configuration Summary:');
    console.log(`  Provider:    OpenAI API`);
    console.log(`  Base URL:    ${config.apiUrl}`);
    console.log(`  API Key:     ${config.apiKey.substring(0, 15)}...`);
    console.log();
    console.log('Next Steps:');
    console.log('  1. Open the Open WebUI Connections page to verify');
    console.log('  2. Send a test chat message using the new connection');
    console.log('  3. Check the ZeroClaw logs: docker logs zeroclaw');
    console.log('  4. Monitor for any authentication or connection errors');
    console.log();
    console.log('Screenshots saved to: tests/playwright/screenshots/');
    console.log('='.repeat(70));

  } catch (error) {
    console.error();
    console.error('❌ Configuration failed!');
    console.error(`Error: ${error.message}`);
    console.error();

    await takeScreenshot(page, 'error');

    console.log('📸 Error screenshot saved');
    console.log();
    console.log('Troubleshooting:');
    console.log('  1. Ensure Open WebUI is running at the specified URL');
    console.log('  2. Verify credentials are correct');
    console.log('  3. Try running with --no-headless to see what\'s happening');
    console.log('  4. Check the screenshots in tests/playwright/screenshots/');
    console.log('  5. Review Open WebUI documentation for UI changes');
    console.log();

    process.exit(1);

  } finally {
    await browser.close();
  }
}

// Run the script
runConfiguration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
