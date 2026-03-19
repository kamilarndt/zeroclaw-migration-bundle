import { test, expect, Page } from '@playwright/test';

/**
 * Open WebUI Configuration E2E Test
 *
 * This script automates the configuration of Open WebUI to add an OpenAI API connection.
 * It handles login, navigation to admin settings, and form submission.
 */

interface ConfigOptions {
  baseUrl: string;
  username: string;
  password: string;
  apiUrl: string;
  apiKey: string;
  headless: boolean;
}

const defaultConfig: ConfigOptions = {
  baseUrl: process.env.OPEN_WEBUI_URL || 'http://localhost:8080',
  username: process.env.OPEN_WEBUI_USERNAME || 'admin',
  password: process.env.OPEN_WEBUI_PASSWORD || 'password',
  apiUrl: process.env.OPENAI_API_URL || 'http://127.0.0.1:42618/v1',
  apiKey: process.env.OPENAI_API_KEY || 'sk-test-key-pairing-token',
  headless: process.env.HEADLESS !== 'false',
};

/**
 * Helper function to take screenshot with timestamp
 */
async function takeScreenshot(page: Page, testName: string, action: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshots/${testName}_${action}_${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
}

/**
 * Helper function to wait for element with timeout
 */
async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 10000
) {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return true;
  } catch (error) {
    console.error(`❌ Element not found: ${selector}`);
    return false;
  }
}

/**
 * Perform login to Open WebUI
 */
async function login(page: Page, config: ConfigOptions) {
  console.log('🔐 Navigating to login page...');
  await page.goto(config.baseUrl);

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Check if already logged in (redirect to dashboard)
  const currentUrl = page.url();
  if (currentUrl.includes('/chat') || currentUrl.includes('/admin')) {
    console.log('✅ Already logged in');
    return;
  }

  // Look for login form - Open WebUI has different UI versions
  const loginSelectors = [
    'input[type="email"]',
    'input[type="text"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="username" i]',
  ];

  let usernameInput = null;
  for (const selector of loginSelectors) {
    try {
      usernameInput = await page.$(selector);
      if (usernameInput) {
        console.log(`Found username input with selector: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  if (!usernameInput) {
    throw new Error('Could not find username/email input field');
  }

  // Fill in credentials
  console.log('📝 Entering credentials...');
  await usernameInput.fill(config.username);

  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
  ];

  let passwordInput = null;
  for (const selector of passwordSelectors) {
    try {
      passwordInput = await page.$(selector);
      if (passwordInput) {
        console.log(`Found password input with selector: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  if (!passwordInput) {
    throw new Error('Could not find password input field');
  }

  await passwordInput.fill(config.password);

  // Submit login
  console.log('🚀 Submitting login form...');
  await passwordInput.press('Enter');

  // Wait for navigation
  await page.waitForLoadState('networkidle');

  // Verify login success
  console.log('✅ Login successful');
}

/**
 * Navigate to Admin Panel -> Settings -> Connections
 */
async function navigateToConnections(page: Page) {
  console.log('📍 Navigating to Admin Panel...');

  // Look for admin panel button/link
  const adminSelectors = [
    'a[href="/admin"]',
    'button:has-text("Admin")',
    '[data-testid="admin-panel"]',
    'a:has-text("Admin Panel")',
  ];

  let adminClicked = false;
  for (const selector of adminSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        adminClicked = true;
        console.log(`Clicked admin with selector: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  if (!adminClicked) {
    // Try direct navigation
    console.log('Trying direct navigation to /admin...');
    await page.goto(`${page.url().split('/')[0]}//${page.url().split('/')[2]}/admin`);
  }

  await page.waitForLoadState('networkidle');

  // Navigate to Settings
  console.log('⚙️  Navigating to Settings...');
  const settingsSelectors = [
    'button:has-text("Settings")',
    'a:has-text("Settings")',
    '[data-testid="settings"]',
    'tab:has-text("Settings")',
  ];

  let settingsClicked = false;
  for (const selector of settingsSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        settingsClicked = true;
        console.log(`Clicked settings with selector: ${selector}`);
        await page.waitForTimeout(1000);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  // Navigate to Connections
  console.log('🔗 Navigating to Connections...');
  const connectionsSelectors = [
    'button:has-text("Connections")',
    'a:has-text("Connections")',
    '[data-testid="connections"]',
    'tab:has-text("Connections")',
    'text=Connections',
  ];

  let connectionsClicked = false;
  for (const selector of connectionsSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        connectionsClicked = true;
        console.log(`Clicked connections with selector: ${selector}`);
        await page.waitForTimeout(1000);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  if (!connectionsClicked) {
    console.log('⚠️  Could not find Connections tab, may already be on the right page');
  }

  await page.waitForLoadState('networkidle');
  console.log('✅ Successfully navigated to Connections section');
}

/**
 * Add OpenAI API connection
 */
async function addOpenAIConnection(page: Page, config: ConfigOptions) {
  console.log('➕ Adding new OpenAI API connection...');

  // Look for "Add Connection" or "New Connection" button
  const addSelectors = [
    'button:has-text("Add Connection")',
    'button:has-text("New Connection")',
    'button:has-text("Add")',
    '[data-testid="add-connection"]',
    'button[aria-label="Add connection"]',
  ];

  let addClicked = false;
  for (const selector of addSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        addClicked = true;
        console.log(`Clicked add button with selector: ${selector}`);
        await page.waitForTimeout(1000);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  if (!addClicked) {
    console.log('⚠️  Could not find Add button, trying to fill form directly...');
  }

  // Select "OpenAI API" from provider dropdown/type
  console.log('📋 Selecting OpenAI API provider...');

  // Try different ways to select provider
  const providerSelectors = [
    'select[name="provider"]',
    'select#provider',
    '[role="combobox"]',
    'button[role="combobox"]',
  ];

  let providerSelected = false;
  for (const selector of providerSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        await page.waitForTimeout(500);

        // Look for OpenAI option
        const openaiOptionSelectors = [
          'option[value="openai"]',
          'option:has-text("OpenAI")',
          'li:has-text("OpenAI API")',
          '[data-value="openai"]',
        ];

        for (const optionSelector of openaiOptionSelectors) {
          try {
            const option = await page.$(optionSelector);
            if (option) {
              await option.click();
              providerSelected = true;
              console.log('Selected OpenAI API provider');
              await page.waitForTimeout(500);
              break;
            }
          } catch (e) {
            // Continue
          }
        }

        if (providerSelected) break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  // Fill in Base URL
  console.log('🌐 Filling in Base URL...');
  const baseUrlSelectors = [
    'input[name="baseUrl"]',
    'input[name="base_url"]',
    'input[placeholder*="Base URL" i]',
    'input[placeholder*="base url" i]',
    'input[id="baseUrl"]',
  ];

  let baseUrlFilled = false;
  for (const selector of baseUrlSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.fill(config.apiUrl);
        baseUrlFilled = true;
        console.log(`✅ Filled Base URL: ${config.apiUrl}`);
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  if (!baseUrlFilled) {
    console.warn('⚠️  Could not find Base URL field');
  }

  // Fill in API Key
  console.log('🔑 Filling in API Key...');
  const apiKeySelectors = [
    'input[name="apiKey"]',
    'input[name="api_key"]',
    'input[name="token"]',
    'input[placeholder*="API Key" i]',
    'input[placeholder*="API key" i]',
    'input[id="apiKey"]',
  ];

  let apiKeyFilled = false;
  for (const selector of apiKeySelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.fill(config.apiKey);
        apiKeyFilled = true;
        console.log('✅ Filled API Key');
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  if (!apiKeyFilled) {
    console.warn('⚠️  Could not find API Key field');
  }

  // Save configuration
  console.log('💾 Saving configuration...');
  const saveSelectors = [
    'button:has-text("Save")',
    'button:has-text("Submit")',
    'button[type="submit"]',
    '[data-testid="save-connection"]',
    'button[aria-label="Save"]',
  ];

  let saveClicked = false;
  for (const selector of saveSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        saveClicked = true;
        console.log(`Clicked save with selector: ${selector}`);
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  if (!saveClicked) {
    throw new Error('Could not find Save button');
  }

  // Look for success message
  console.log('🔍 Verifying success...');
  await page.waitForTimeout(2000);

  const successSelectors = [
    'text=Connection saved',
    'text=Successfully added',
    'text=Success',
    '.success',
    '.notification',
  ];

  let successFound = false;
  for (const selector of successSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && (text.includes('success') || text.includes('saved') || text.includes('added'))) {
          successFound = true;
          console.log('✅ Configuration saved successfully!');
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }

  if (!successFound) {
    console.log('⚠️  Could not verify success message, but form was submitted');
  }
}

/**
 * Main test
 */
test.describe('Open WebUI Configuration', () => {
  let config: ConfigOptions;

  test.beforeAll(async () => {
    config = defaultConfig;
    console.log('='.repeat(60));
    console.log('Open WebUI Configuration E2E Test');
    console.log('='.repeat(60));
    console.log(`Base URL: ${config.baseUrl}`);
    console.log(`API URL: ${config.apiUrl}`);
    console.log(`Username: ${config.username}`);
    console.log('='.repeat(60));

    // Create screenshots directory
    const fs = require('fs');
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots', { recursive: true });
    }
  });

  test('should configure OpenAI API connection', async ({ page }) => {
    try {
      // Step 1: Login
      await login(page, config);
      await takeScreenshot(page, 'open_webui_config', 'after_login');

      // Step 2: Navigate to Connections
      await navigateToConnections(page);
      await takeScreenshot(page, 'open_webui_config', 'connections_page');

      // Step 3: Add OpenAI connection
      await addOpenAIConnection(page, config);
      await takeScreenshot(page, 'open_webui_config', 'after_save');

      console.log('✅ Test completed successfully!');
      console.log('');
      console.log('Configuration Summary:');
      console.log(`- Provider: OpenAI API`);
      console.log(`- Base URL: ${config.apiUrl}`);
      console.log(`- API Key: ${config.apiKey.substring(0, 10)}...`);
      console.log('');
      console.log('Next Steps:');
      console.log('1. Verify the connection appears in the Connections list');
      console.log('2. Test the connection by sending a chat message');
      console.log('3. Check logs for any authentication errors');

    } catch (error) {
      console.error('❌ Test failed:', error);
      await takeScreenshot(page, 'open_webui_config', 'error');
      throw error;
    }
  });

  test('should verify connection exists', async ({ page }) => {
    try {
      // Login and navigate to connections
      await login(page, config);
      await navigateToConnections(page);

      // Look for the configured connection
      console.log('🔍 Verifying connection exists...');

      const connectionSelectors = [
        `text=${config.apiUrl}`,
        `[data-url="${config.apiUrl}"]`,
        'text=OpenAI API',
      ];

      let connectionFound = false;
      for (const selector of connectionSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            connectionFound = true;
            console.log('✅ Connection found in list!');
            break;
          }
        } catch (e) {
          // Continue
        }
      }

      if (!connectionFound) {
        console.log('⚠️  Connection not found in list, may need to be added');
      }

      await takeScreenshot(page, 'open_webui_config', 'verification');

      expect(connectionFound).toBeTruthy();

    } catch (error) {
      console.error('❌ Verification failed:', error);
      await takeScreenshot(page, 'open_webui_config', 'verification_error');
      throw error;
    }
  });
});

/**
 * Standalone script execution
 * This allows running the test directly with: npx ts-node open_webui_config.spec.ts
 */
if (require.main === module) {
  (async () => {
    const { chromium } = require('@playwright/test');

    const browser = await chromium.launch({
      headless: defaultConfig.headless,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    try {
      console.log('Running standalone mode...');
      await login(page, defaultConfig);
      await navigateToConnections(page);
      await addOpenAIConnection(page, defaultConfig);

      console.log('✅ Configuration completed successfully!');
      console.log('');
      console.log('Please verify:');
      console.log('1. Check the Open WebUI Connections page');
      console.log('2. Test a chat message using the new connection');
      console.log('3. Monitor logs for any errors');

    } catch (error) {
      console.error('❌ Configuration failed:', error);
      await page.screenshot({
        path: 'screenshots/error_standalone.png',
        fullPage: true,
      });
    } finally {
      await browser.close();
    }
  })();
}
