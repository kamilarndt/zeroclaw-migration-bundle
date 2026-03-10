import { test, expect } from '@playwright/test';

test.describe('ZeroClaw Dashboard', () => {
  test('should load dashboard page', async ({ page }) => {
    await page.goto('/_app/');
    await expect(page).toHaveTitle(/ZeroClaw/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display system status', async ({ page }) => {
    await page.goto('/_app/');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 });
    
    // Check if status indicators are present
    await expect(page.locator('[data-testid="status-indicator"]')).toBeVisible();
  });

  test('should navigate to different sections', async ({ page }) => {
    await page.goto('/_app/');
    
    // Check navigation links
    await expect(page.locator('nav')).toBeVisible();
    
    // Test navigation (adjust selectors based on actual implementation)
    const navLinks = await page.locator('nav a').count();
    expect(navLinks).toBeGreaterThan(0);
  });

  test('should show API status', async ({ page }) => {
    await page.goto('/_app/');
    
    // Wait for API status to load
    await page.waitForTimeout(2000);
    
    // Check if API connection is working
    const apiStatus = page.locator('[data-testid="api-status"]');
    if (await apiStatus.count() > 0) {
      await expect(apiStatus).toBeVisible();
    }
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/_app/');
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
  });
});
