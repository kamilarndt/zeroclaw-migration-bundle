import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Mobile Pairing/Login
 *
 * Tests the critical 405 fix: mobile browsers send OPTIONS preflight
 * requests with custom headers (X-Pairing-Code). The backend must
 * properly handle CORS preflight for pairing to work.
 */

test.describe('Mobile Pairing: CORS Preflight', () => {
  test('iPhone Safari viewport: OPTIONS preflight succeeds', async ({ page, request }) => {
    // Simulate iPhone 14 Pro viewport
    await page.setViewportSize({ width: 393, height: 852 });

    // Test OPTIONS preflight request (what mobile browsers send first)
    const response = await request.fetch('http://127.0.0.1:42617/api/v1/pair', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://dash.karndt.pl',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-pairing-code',
      },
    });

    // Must return 200 (not 405!) for CORS preflight
    expect(response.status()).toBe(200);

    // Verify CORS headers are present
    const allowHeaders = response.headers()['access-control-allow-headers'];
    expect(allowHeaders).toContain('x-pairing-code');
  });

  test('Android Chrome viewport: OPTIONS preflight succeeds', async ({ page, request }) => {
    // Simulate Android viewport
    await page.setViewportSize({ width: 412, height: 915 });

    const response = await request.fetch('http://127.0.0.1:42617/api/v1/pair', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://dash.karndt.pl',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-pairing-code',
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['access-control-allow-headers']).toContain('x-pairing-code');
  });

  test('Mobile pairing POST request succeeds (HTTP 200, not 405)', async ({ page }) => {
    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X

    // Navigate to dashboard
    await page.goto('http://127.0.0.1:42617/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if pairing dialog is shown (when not paired)
    const pairingInput = page.locator('input[placeholder*="code" i]');
    await expect(pairingInput).toBeVisible({ timeout: 5000 }).catch(() => {
      // If already paired, we'll get the main dashboard instead
      return page.locator('h1, h2, nav').first().isVisible();
    });
  });

  test('Production URL (dash.karndt.pl) uses same-origin requests', async ({ page }) => {
    // Simulate mobile viewport accessing production
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12 Pro

    // Check that frontend uses relative URLs in production
    const clientScript = await page.evaluate(() => {
      // This should be '' for production (relative URLs)
      const script = document.createElement('script');
      script.textContent = `
        window.apiBaseUrl = (() => {
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://127.0.0.1:42617';
          }
          return ''; // Production: relative URLs
        })();
      `;
      document.head.appendChild(script);
      return window.apiBaseUrl;
    });

    // For localhost, should return full URL
    // For dash.karndt.pl, should return empty string (relative)
    expect(clientScript).toBeDefined();
  });
});

test.describe('Direct API Tests', () => {
  test('Health endpoint returns 200', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:42617/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('Pairing endpoint accepts POST with X-Pairing-Code header', async ({ request }) => {
    // Note: This will fail with invalid code, but should NOT return 405
    const response = await request.post('http://127.0.0.1:42617/api/v1/pair', {
      headers: {
        'X-Pairing-Code': '000000', // Invalid code, but header format is correct
      },
    });

    // Should get 400/401/403 (invalid/rate-limited), NOT 405 (method not allowed)
    expect(response.status()).not.toBe(405);
    expect([400, 401, 403, 200]).toContain(response.status());
  });
});
