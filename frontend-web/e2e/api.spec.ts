import { test, expect } from '@playwright/test';

test.describe('ZeroClaw API', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:42617/health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('paired');
  });

  test('status endpoint returns system info', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:42617/api/status');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('daemon');
  });

  test('config endpoint is protected', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:42617/api/config');
    // Should return 401 without token
    expect(response.status()).toBe(401);
  });

  test('dashboard frontend loads', async ({ page }) => {
    await page.goto('http://127.0.0.1:42617/_app/');
    await expect(page).toHaveTitle(/ZeroClaw/);
    await expect(page.locator('body')).toBeVisible();
  });
});
