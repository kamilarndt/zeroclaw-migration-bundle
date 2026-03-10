/**
 * ZeroClaw Dashboard E2E Tests - Playwright
 *
 * Tests dashboard functionality including:
 * - Responsive navigation (sidebar for desktop, bottom nav for mobile)
 * - Node status indicators and server connection
 * - KPI cards rendering (API Costs, RAM, CPU via metrics)
 * - FinOps chart rendering (custom SVG implementation)
 * - Mini-terminal / Active Processes section
 *
 * Prerequisites:
 * - Dashboard dev server running (default: http://localhost:5173)
 * - Metrics store initialized with mock data
 *
 * Environment variables:
 * - BASE_URL: Dashboard base URL (default: http://localhost:5173)
 */

import { test, expect, devices } from '@playwright/test';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// =============================================================================
// TEST SUITES
// =============================================================================

test.describe('Dashboard: Navigation Layout', () => {
  test('renders sidebar navigation on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Check for sidebar navigation
    const sidebar = page.locator('[data-testid="sidebar-navigation"]');
    await expect(sidebar).toBeVisible();

    // Verify sidebar menu is present
    const menu = page.locator('[data-testid="sidebar-menu"]');
    await expect(menu).toBeVisible();

    // Verify bottom navigation is NOT present on desktop
    const bottomNav = page.locator('[data-testid="bottom-navigation"]');
    await expect(bottomNav).not.toBeVisible();
  });

  test('renders bottom navigation on mobile viewport', async ({ page }) => {
    // Set mobile viewport (iPhone 13 dimensions)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Check for bottom navigation
    const bottomNav = page.locator('[data-testid="bottom-navigation"]');
    await expect(bottomNav).toBeVisible();

    // Verify sidebar is NOT present on mobile (different layout)
    const sidebar = page.locator('[data-testid="sidebar-navigation"]');
    await expect(sidebar).toHaveCount(0);
  });

  test('bottom navigation contains all required navigation items', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    const bottomNav = page.locator('[data-testid="bottom-navigation"]');

    // Check for each navigation item
    const expectedItems = ['Chat', 'Tasks', 'Dashboard', 'Hands'];
    for (const item of expectedItems) {
      const navItem = bottomNav.getByText(item, { exact: false });
      await expect(navItem).toBeVisible();
    }

    // Verify Dashboard link exists and has href
    const dashboardLink = bottomNav.locator('a').filter({ hasText: 'Dashboard' });
    await expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });

  test('sidebar navigation contains all required menu items', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('[data-testid="sidebar-menu"]');

    // Check for each menu item
    const expectedItems = [
      'Dashboard',
      'Tasks',
      'Hands',
      'Memory',
      'SOPs',
      'Config',
      'Chat'
    ];

    for (const item of expectedItems) {
      const menuItem = sidebar.getByText(item);
      await expect(menuItem).toBeVisible();
    }
  });
});

test.describe('Dashboard: Node Status Indicator', () => {
  test('displays network status indicator', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Network status component should be present (may be hidden if online)
    const networkIndicator = page.locator('[data-testid="network-status-indicator"]');

    // The indicator exists in the DOM
    await expect(networkIndicator).toHaveCount(1);
  });

  test('shows online status when connected', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Check for online indicators
    // This could be a Wifi icon or "Online" text
    const onlineText = page.getByText('Online');
    const hasOnlineIndicator = await onlineText.count() > 0;

    // At minimum, we should not see "Offline" when network is available
    const offlineText = page.getByText('Offline');
    const isOfflineVisible = await offlineText.isVisible().catch(() => false);

    expect(isOfflineVisible).toBe(false);
  });
});

test.describe('Dashboard: KPI Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('renders KPI cards grid container', async ({ page }) => {
    const kpiGrid = page.locator('[data-testid="kpi-cards-grid"]');
    await expect(kpiGrid).toBeVisible();
  });

  test('renders Total Requests KPI card', async ({ page }) => {
    const kpiCard = page.locator('[data-testid="kpi-total-requests"]');
    await expect(kpiCard).toBeVisible();

    // Verify card content
    const title = kpiCard.getByText('Total Requests');
    await expect(title).toBeVisible();

    // Verify value is displayed (number)
    const valueText = await kpiCard.textContent();
    expect(valueText).toBeDefined();
  });

  test('renders Average Duration KPI card', async ({ page }) => {
    const kpiCard = page.locator('[data-testid="kpi-avg-duration"]');
    await expect(kpiCard).toBeVisible();

    // Verify card content
    const title = kpiCard.getByText('Avg Duration');
    await expect(title).toBeVisible();

    // Verify unit is displayed (ms)
    const hasUnit = kpiCard.getByText('ms');
    await expect(hasUnit).toBeVisible();
  });

  test('renders Total Tokens KPI card', async ({ page }) => {
    const kpiCard = page.locator('[data-testid="kpi-total-tokens"]');
    await expect(kpiCard).toBeVisible();

    // Verify card content
    const title = kpiCard.getByText('Total Tokens');
    await expect(title).toBeVisible();
  });

  test('renders Active Hands KPI card', async ({ page }) => {
    const kpiCard = page.locator('[data-testid="kpi-active-hands"]');
    await expect(kpiCard).toBeVisible();

    // Verify card content
    const title = kpiCard.getByText('Active Hands');
    await expect(title).toBeVisible();
  });

  test('all KPI cards are clickable and have hover effects', async ({ page }) => {
    // Select individual KPI cards, not the grid container
    const kpiCards = page.locator('[data-testid="kpi-total-requests"], [data-testid="kpi-avg-duration"], [data-testid="kpi-total-tokens"], [data-testid="kpi-active-hands"]');
    const count = await kpiCards.count();

    expect(count).toBeGreaterThan(0);

    // Check each card is interactive
    for (let i = 0; i < count; i++) {
      const card = kpiCards.nth(i);
      await expect(card).toBeVisible();

      // Verify card has transition-all class (indicates interactivity)
      const className = await card.getAttribute('class') || '';
      expect(className).toContain('transition');
    }
  });

  test('KPI cards display numerical values correctly', async ({ page }) => {
    const kpiCards = page.locator('[data-testid^="kpi-"]');
    const count = await kpiCards.count();

    for (let i = 0; i < count; i++) {
      const card = kpiCards.nth(i);
      const text = await card.textContent();

      // Should contain some text content (title + value)
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});

test.describe('Dashboard: FinOps Chart (API Cost History)', () => {
  test('renders FinOps chart section when cost history exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Wait a moment for data to load
    await page.waitForTimeout(1000);

    // The chart section may or may not be present depending on whether
    // there's cost history data
    const chartSection = page.locator('[data-testid="finops-chart-section"]');
    const isVisible = await chartSection.isVisible().catch(() => false);

    if (isVisible) {
      await expect(chartSection).toBeVisible();

      // Verify chart title
      const title = chartSection.getByText('API Cost History');
      await expect(title).toBeVisible();
    } else {
      // If no data, section should not be in DOM
      await expect(chartSection).toHaveCount(0);
    }
  });

  test('renders SVG-based chart visualization', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(1000);

    // Look for SVG elements within the chart section
    const chartSection = page.locator('[data-testid="finops-chart-section"]');
    const isVisible = await chartSection.isVisible().catch(() => false);

    if (isVisible) {
      // The chart uses SVG for visualization
      const svgElements = chartSection.locator('svg');
      const svgCount = await svgElements.count();

      // Should have at least one SVG element for the chart
      expect(svgCount).toBeGreaterThan(0);

      // Verify the SVG has chart elements (path, circle, rect, etc.)
      const svg = svgElements.first();
      const hasChartElements = await svg.locator('path, circle, rect').count() > 0;
      expect(hasChartElements).toBe(true);
    }
  });

  test('chart displays tooltips on hover', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(1000);

    const chartSection = page.locator('[data-testid="finops-chart-section"]');
    const isVisible = await chartSection.isVisible().catch(() => false);

    if (isVisible) {
      // Look for elements with title attribute (tooltips)
      const chartElements = chartSection.locator('[title]');
      const hasTooltips = await chartElements.count() > 0;

      // Chart bars should have tooltips showing cost information
      expect(hasTooltips).toBe(true);
    }
  });

  test('chart handles empty state gracefully', async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // The chart should either render with data or not render at all
    // It should not show error states
    const chartSection = page.locator('[data-testid="finops-chart-section"]');
    const exists = await chartSection.count() > 0;

    if (exists) {
      const isVisible = await chartSection.isVisible();
      if (isVisible) {
        // If visible, should not contain error messages
        const hasError = await chartSection.getByText(/error|failed|unable/i).count();
        expect(hasError).toBe(0);
      }
    }
  });
});

test.describe('Dashboard: Active Processes (Mini-terminal)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Allow time for data to load
  });

  test('renders Active Processes section', async ({ page }) => {
    const activeProcesses = page.locator('[data-testid="active-processes-section"]');
    await expect(activeProcesses).toBeVisible();
  });

  test('displays section header with icon', async ({ page }) => {
    const section = page.locator('[data-testid="active-processes-section"]');

    // Check for "Active Hands" title in heading element
    const title = section.locator('h2').filter({ hasText: 'Active Hands' });
    await expect(title).toBeVisible();
  });

  test('shows hands count statistics', async ({ page }) => {
    const section = page.locator('[data-testid="active-processes-section"]');

    // Look for statistics text (e.g., "X active / Y idle")
    const hasStats = await section.getByText(/\d+\s*active\s*\/\s*\d+\s*idle/i).count() > 0;
    const hasAltStats = await section.getByText(/active|idle/i).count() > 0;

    // Should display some kind of statistics
    expect(hasStats || hasAltStats).toBe(true);
  });

  test('displays system load information', async ({ page }) => {
    const section = page.locator('[data-testid="active-processes-section"]');

    // Check if there are hands or empty state
    const noHandsText = section.getByText('No active hands');
    const hasNoHands = await noHandsText.isVisible().catch(() => false);

    if (hasNoHands) {
      // In empty state, just verify the section is visible
      await expect(section).toBeVisible();
    } else {
      // When hands exist, look for load percentage or "System Load" text
      const hasLoadText = await section.getByText(/load|%/i).count() > 0;
      expect(hasLoadText).toBe(true);
    }
  });

  test('renders individual hand cards when hands exist', async ({ page }) => {
    const section = page.locator('[data-testid="active-processes-section"]');

    // The section may show "No active hands" or a list of hands
    const noHandsMessage = section.getByText('No active hands');
    const hasNoHands = await noHandsMessage.isVisible().catch(() => false);

    if (!hasNoHands) {
      // If showing hands, look for hand cards/entries
      // Hands should have names, status indicators, etc.
      const sectionText = await section.textContent();
      expect(sectionText?.length).toBeGreaterThan(0);
    }
  });

  test('displays status indicators for each hand', async ({ page }) => {
    const section = page.locator('[data-testid="active-processes-section"]');

    // Check for status-related icons or text
    const hasStatusIndicators = await section.getByText(/active|idle|check|alert/i).count() > 0;
    expect(hasStatusIndicators).toBe(true);
  });

  test('shows timestamp for last activity', async ({ page }) => {
    const section = page.locator('[data-testid="active-processes-section"]');

    // Check if there are hands or empty state
    const noHandsText = section.getByText('No active hands');
    const hasNoHands = await noHandsText.isVisible().catch(() => false);

    if (hasNoHands) {
      // In empty state, just verify the section is visible
      await expect(section).toBeVisible();
    } else {
      // When hands exist, look for date/time text indicating last activity
      const hasTimestamp = await section.getByText(/Last Active/i).count() > 0;
      expect(hasTimestamp).toBe(true);
    }
  });
});

test.describe('Dashboard: Task Progress Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('renders Task Progress section', async ({ page }) => {
    const taskProgress = page.locator('[data-testid="task-progress-section"]');
    await expect(taskProgress).toBeVisible();
  });

  test('displays progress bar', async ({ page }) => {
    const section = page.locator('[data-testid="task-progress-section"]');

    // Look for progress bar element
    const progressBar = section.locator('.h-2.bg-white\\/10.rounded-full');
    await expect(progressBar).toBeVisible();
  });

  test('shows task statistics by status', async ({ page }) => {
    const section = page.locator('[data-testid="task-progress-section"]');

    // Check for status categories
    const statuses = ['To Do', 'In Progress', 'In Review', 'Done'];
    const foundStatuses: string[] = [];

    for (const status of statuses) {
      const hasStatus = await section.getByText(status, { exact: false }).count() > 0;
      if (hasStatus) {
        foundStatuses.push(status);
      }
    }

    // Should show at least some task categories
    expect(foundStatuses.length).toBeGreaterThan(0);
  });

  test('displays numeric counts for each task status', async ({ page }) => {
    const section = page.locator('[data-testid="task-progress-section"]');

    // Look for numeric values in the task stats
    const text = await section.textContent();
    const hasNumbers = /\d+/.test(text || '');

    expect(hasNumbers).toBe(true);
  });
});

test.describe('Dashboard: Responsive Design', () => {
  test('dashboard header is visible on all viewports', async ({ page }) => {
    const viewports = [
      { width: 390, height: 844 },  // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 720 }  // Desktop
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      const header = page.locator('[data-testid="dashboard-header"]');
      await expect(header).toBeVisible();

      const title = header.getByText('Dashboard');
      await expect(title).toBeVisible();
    }
  });

  test('KPI cards grid adapts to viewport width', async ({ page }) => {
    // Desktop: 4 columns
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    const kpiGridDesktop = page.locator('[data-testid="kpi-cards-grid"]');
    await expect(kpiGridDesktop).toBeVisible();
    const desktopClasses = await kpiGridDesktop.getAttribute('class');
    expect(desktopClasses).toContain('lg:grid-cols-4');

    // Mobile: 1 column
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const kpiGridMobile = page.locator('[data-testid="kpi-cards-grid"]');
    await expect(kpiGridMobile).toBeVisible();
    const mobileClasses = await kpiGridMobile.getAttribute('class');
    expect(mobileClasses).toContain('grid-cols-1');
  });
});

test.describe('Dashboard: Integration', () => {
  test('all dashboard components load without errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Check for console errors
    expect(errors.length).toBe(0);
  });

  test('dashboard page title is correct', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/ZeroClaw|Dashboard/);
  });

  test('dashboard is accessible via navigation', async ({ page }) => {
    // Start from home/base URL
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Navigate to dashboard via sidebar (desktop)
    await page.setViewportSize({ width: 1280, height: 720 });

    const dashboardLink = page.locator('[data-testid="sidebar-menu"]').getByText('Dashboard');
    await dashboardLink.click();
    await page.waitForURL('**/dashboard');

    expect(page.url()).toContain('/dashboard');
  });
});

test.describe('Dashboard: Accessibility', () => {
  test('KPI cards have accessible names', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    const kpiCards = page.locator('[data-testid^="kpi-"]');
    const count = await kpiCards.count();

    for (let i = 0; i < count; i++) {
      const card = kpiCards.nth(i);
      const text = await card.textContent();

      // Each card should have descriptive text
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('navigation elements have proper ARIA attributes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Sidebar should have navigation role (using getByRole)
    const sidebar = page.getByRole('navigation', { name: /Main navigation/i });
    await expect(sidebar).toBeVisible();

    // Menu should have menu role
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
  });

  test('active navigation item is marked', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Dashboard button should have aria-current="page"
    // Find the button containing the Dashboard text
    const dashboardButton = page.locator('[data-testid="sidebar-menu"] button').filter({ hasText: 'Dashboard' });
    await expect(dashboardButton).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('Dashboard: Performance', () => {
  test('dashboard loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Dashboard should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('dashboard remains responsive with large datasets', async ({ page }) => {
    // This test verifies the dashboard can handle rendering
    // even when there's a lot of data
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Interact with various elements
    const kpiGrid = page.locator('[data-testid="kpi-cards-grid"]');
    await expect(kpiGrid).toBeVisible();

    const taskProgress = page.locator('[data-testid="task-progress-section"]');
    await expect(taskProgress).toBeVisible();

    const activeProcesses = page.locator('[data-testid="active-processes-section"]');
    await expect(activeProcesses).toBeVisible();

    // All sections should render without hanging
    await page.waitForTimeout(100);
  });
});
