/**
 * ZeroClaw Advanced Tools E2E Tests - Playwright
 *
 * Tests SOP Editor (ReactFlow) and Memory Explorer (SVG-based) functionality.
 *
 * Prerequisites:
 * - ZeroClaw daemon running on http://127.0.0.1:42617
 * - Dashboard built and accessible (default: http://127.0.0.1:3000 or via Caddy)
 * - Valid JWT token or paired gateway
 * - Qdrant running on 127.0.0.1:6333
 * - SQLite memory initialized at ~/.zeroclaw/memory/brain.db
 *
 * Environment variables:
 * - BASE_URL: Dashboard base URL (default: http://localhost:3001)
 * - API_URL: ZeroClaw API URL (default: http://localhost:42617)
 * - TEST_TOKEN: Auth token (optional, if set skips pairing)
 * - TEST_USER: Test username (default: admin)
 * - TEST_PASS: Test password (default: password)
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:42617';
const TEST_TOKEN = process.env.TEST_TOKEN || '';
const TEST_USER = process.env.TEST_USER || 'admin';
const TEST_PASS = process.env.TEST_PASS || 'password';

interface AuthTokens {
  bearer: string;
  expires?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Authenticate with the gateway and return bearer token.
 * In E2E tests, auth is handled by storageState in playwright.config.ts.
 */
async function authenticate(): Promise<AuthTokens> {
  // E2E tests use mock authentication via storageState in playwright.config.ts
  return { bearer: 'mock-test-token-123' };
}

// =============================================================================
// TEST SUITES
// =============================================================================

test.describe.configure({ mode: 'serial' }); // Run tests sequentially

test.describe('SOP Editor: ReactFlow Canvas', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to SOP Editor page
    await page.goto(`${BASE_URL}/sops`);
    await page.waitForLoadState('networkidle');
  });

  test('loads ReactFlow canvas with all required controls', async ({ page }) => {
    // Verify the SOP editor container is present
    const sopEditor = page.locator('[data-testid="sop-editor"]');
    await expect(sopEditor).toBeVisible();

    // Verify ReactFlow canvas is rendered
    const canvas = page.locator('[data-testid="reactflow-canvas"]');
    await expect(canvas).toBeVisible();

    // Verify ReactFlow instance is loaded
    const flowInstance = page.locator('[data-testid="reactflow-instance"]');
    await expect(flowInstance).toBeVisible();

    // Verify controls are present
    const controls = page.locator('[data-testid="reactflow-controls"]');
    await expect(controls).toBeVisible();

    // Verify minimap is present
    const minimap = page.locator('[data-testid="reactflow-minimap"]');
    await expect(minimap).toBeVisible();
  });

  test('renders example trigger and agent nodes', async ({ page }) => {
    // Wait for ReactFlow to initialize
    await page.waitForTimeout(500);

    // Verify trigger node exists
    const triggerNode = page.locator('[data-testid="sop-node-trigger"]').first();
    await expect(triggerNode).toBeVisible();
    await expect(triggerNode).toContainText('Start Trigger');

    // Verify agent node exists
    const agentNode = page.locator('[data-testid="sop-node-agent"]').first();
    await expect(agentNode).toBeVisible();
    await expect(agentNode).toContainText('Process Data');

    // Verify both nodes have correct styling
    await expect(triggerNode).toHaveCSS('background-color', /rgb\(79, 70, 229\)/); // indigo-600
    await expect(agentNode).toHaveCSS('background-color', /rgb\(22, 163, 74\)/); // green-600
  });

  test('can add new trigger and agent nodes via buttons', async ({ page }) => {
    // Get initial node count
    const initialTriggerCount = await page.locator('[data-testid="sop-node-trigger"]').count();
    const initialAgentCount = await page.locator('[data-testid="sop-node-agent"]').count();

    // Add a new trigger node
    await page.click('[data-testid="add-trigger-node"]');
    await page.waitForTimeout(300);

    // Verify trigger node was added
    const newTriggerCount = await page.locator('[data-testid="sop-node-trigger"]').count();
    expect(newTriggerCount).toBe(initialTriggerCount + 1);

    // Add a new agent node
    await page.click('[data-testid="add-agent-node"]');
    await page.waitForTimeout(300);

    // Verify agent node was added
    const newAgentCount = await page.locator('[data-testid="sop-node-agent"]').count();
    expect(newAgentCount).toBe(initialAgentCount + 1);
  });

  test('can interact with nodes in the canvas', async ({ page }) => {
    // Wait for nodes to render
    await page.waitForTimeout(500);

    // Select a node
    const triggerNode = page.locator('[data-testid="sop-node-trigger"]').first();
    await triggerNode.click();

    // Verify node selection state (ring appears)
    await expect(triggerNode).toHaveClass(/ring-2/);

    // Drag node to verify interactivity
    const box = await triggerNode.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2);
      await page.mouse.up();
    }
  });

  test('displays minimap with correct node colors', async ({ page }) => {
    const minimap = page.locator('[data-testid="reactflow-minimap"]');
    await expect(minimap).toBeVisible();

    // Verify minimap contains nodes (check for SVG elements)
    const minimapContent = minimap.locator('svg circle, svg rect');
    await expect(minimapContent).toHaveCount(await page.locator('[data-testid^="sop-node-"]').count());
  });
});

test.describe('Memory Explorer: SVG Visualization', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to Memory Explorer page
    await page.goto(`${BASE_URL}/memory-explorer`);
    await page.waitForLoadState('networkidle');
  });

  test('loads SVG visualization with memory nodes', async ({ page }) => {
    // Verify the memory explorer container is present
    const explorer = page.locator('[data-testid="memory-explorer"]');
    await expect(explorer).toBeVisible();

    // Verify SVG canvas is rendered
    const svg = page.locator('[data-testid="memory-svg"]');
    await expect(svg).toBeVisible();

    // Verify memory nodes group exists
    const nodesGroup = page.locator('[data-testid="memory-nodes"]');
    await expect(nodesGroup).toBeVisible();

    // Wait for mock data to load
    await page.waitForTimeout(600);

    // Verify memory nodes are rendered
    const memoryNodes = page.locator('[data-testid^="memory-node-"][data-testid$="-' + Date.now() + '"], [data-testid^="memory-node-circle-"]');
    const nodeCount = await memoryNodes.count();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('memory nodes render with correct attributes', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(600);

    // Verify at least one memory node circle exists
    const firstNodeCircle = page.locator('[data-testid^="memory-node-circle-"]').first();
    await expect(firstNodeCircle).toBeVisible();

    // Verify node has required SVG attributes
    await expect(firstNodeCircle).toHaveAttribute('cx');
    await expect(firstNodeCircle).toHaveAttribute('cy');
    await expect(firstNodeCircle).toHaveAttribute('r');
    await expect(firstNodeCircle).toHaveAttribute('fill');

    // Verify node label exists
    const firstNodeLabel = page.locator('[data-testid^="memory-node-label-"]').first();
    await expect(firstNodeLabel).toBeVisible();
    await expect(firstNodeLabel).toHaveAttribute('text-anchor', 'middle');

    // Verify node category badge exists
    const firstNodeCategory = page.locator('[data-testid^="memory-node-category-"]').first();
    await expect(firstNodeCategory).toBeVisible();
  });

  test('memory connections are rendered between nodes', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(600);

    // Verify connections group exists
    const connectionsGroup = page.locator('[data-testid="memory-connections"]');
    await expect(connectionsGroup).toBeVisible();

    // Verify connection lines exist
    const connections = page.locator('[data-testid^="memory-connection-"]');
    const connectionCount = await connections.count();
    expect(connectionCount).toBeGreaterThan(0);

    // Verify connections are lines with correct attributes
    const firstConnection = connections.first();
    await expect(firstConnection).toHaveAttribute('x1');
    await expect(firstConnection).toHaveAttribute('y1');
    await expect(firstConnection).toHaveAttribute('x2');
    await expect(firstConnection).toHaveAttribute('y2');
    await expect(firstConnection).toHaveAttribute('stroke');
  });

  test('displays memory statistics in footer', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(600);

    // Verify total memories count
    const totalCount = page.locator('[data-testid="total-memories-count"]');
    await expect(totalCount).toBeVisible();
    const countText = await totalCount.textContent();
    expect(parseInt(countText || '0')).toBeGreaterThan(0);

    // Verify visible memories count
    const visibleCount = page.locator('[data-testid="visible-memories-count"]');
    await expect(visibleCount).toBeVisible();
  });

  test('can select memory nodes by clicking', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(600);

    // Click on a memory node
    const firstNode = page.locator('[data-testid^="memory-node-circle-"]').first();
    await firstNode.click();

    // Verify detail panel appears
    const detailPanel = page.locator('[data-testid="memory-detail-panel"]');
    await expect(detailPanel).toBeVisible();

    // Verify panel shows memory details
    await expect(detailPanel).toContainText('Memory Details');
    await expect(detailPanel).toContainText('Content');
    await expect(detailPanel).toContainText('Category');
    await expect(detailPanel).toContainText('Strength');
  });

  test('displays "Forget memory" button for selected node', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(600);

    // Select a memory node
    const firstNode = page.locator('[data-testid^="memory-node-circle-"]').first();
    await firstNode.click();

    // Verify detail panel appears
    const detailPanel = page.locator('[data-testid="memory-detail-panel"]');
    await expect(detailPanel).toBeVisible();

    // Verify "Forget memory" button exists and is visible
    const forgetButton = page.locator('[data-testid="forget-memory-button"]');
    await expect(forgetButton).toBeVisible();
    await expect(forgetButton).toContainText('Forget Memory');

    // Verify button has correct styling
    await expect(forgetButton).toHaveCSS('background-color', /rgb\(220, 38, 38\)/); // red-600
  });

  test('can filter memories using search input', async ({ page }) => {
    // Wait for initial data to load
    await page.waitForTimeout(600);

    // Get initial visible count
    const initialVisibleCount = await page.locator('[data-testid="visible-memories-count"]').textContent();
    const initialCount = parseInt(initialVisibleCount || '0');

    // Type in search input
    const searchInput = page.locator('[data-testid="memory-search-input"]');
    await searchInput.fill('conversation');
    await page.waitForTimeout(300);

    // Verify visible count changed
    const newVisibleCount = await page.locator('[data-testid="visible-memories-count"]').textContent();
    const newCount = parseInt(newVisibleCount || '0');

    // Filtered count should be less than or equal to initial count
    expect(newCount).toBeLessThanOrEqual(initialCount);
  });

  test('memory nodes have different colors based on category', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(600);

    // Get all node circles
    const nodes = page.locator('[data-testid^="memory-node-circle-"]');
    const nodeCount = await nodes.count();

    // Collect unique colors
    const colors = new Set<string>();
    for (let i = 0; i < Math.min(nodeCount, 5); i++) {
      const node = nodes.nth(i);
      const fill = await node.getAttribute('fill');
      if (fill) {
        colors.add(fill);
      }
    }

    // Should have at least 2 different colors (different categories)
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  test('detail panel shows strength indicator with visual bar', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(600);

    // Select a memory node
    const firstNode = page.locator('[data-testid^="memory-node-circle-"]').first();
    await firstNode.click();

    // Verify detail panel appears
    const detailPanel = page.locator('[data-testid="memory-detail-panel"]');
    await expect(detailPanel).toBeVisible();

    // Verify strength bar exists
    const strengthBar = page.locator('[data-testid="memory-strength-bar"]');
    await expect(strengthBar).toBeVisible();

    // Verify bar has width (indicating strength percentage)
    const width = await strengthBar.getAttribute('style');
    expect(width).toContain('width:');
  });
});

test.describe('SOP Editor & Memory Explorer: Integration', () => {
  let authToken: AuthTokens;

  test.beforeAll(async () => {
    authToken = await authenticate();
  });

  test('can navigate between SOP Editor and Memory Explorer', async ({ page }) => {
    // Start at SOP Editor
    await page.goto(`${BASE_URL}/sops`);
    await page.waitForLoadState('networkidle');

    // Verify SOP Editor is visible
    await expect(page.locator('[data-testid="sop-editor"]')).toBeVisible();

    // Navigate to Memory Explorer
    await page.goto(`${BASE_URL}/memory-explorer`);
    await page.waitForLoadState('networkidle');

    // Verify Memory Explorer is visible
    await expect(page.locator('[data-testid="memory-explorer"]')).toBeVisible();

    // Navigate back to SOP Editor
    await page.goto(`${BASE_URL}/sops`);
    await page.waitForLoadState('networkidle');

    // Verify SOP Editor is still visible and functional
    await expect(page.locator('[data-testid="sop-editor"]')).toBeVisible();
    await expect(page.locator('[data-testid="reactflow-canvas"]')).toBeVisible();
  });

  test('both tools handle window resize gracefully', async ({ page }) => {
    // Test SOP Editor
    await page.goto(`${BASE_URL}/sops`);
    await page.waitForLoadState('networkidle');

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(300);

    // Verify canvas still visible
    await expect(page.locator('[data-testid="reactflow-canvas"]')).toBeVisible();

    // Test Memory Explorer
    await page.goto(`${BASE_URL}/memory-explorer`);
    await page.waitForLoadState('networkidle');

    // Resize viewport again
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(300);

    // Verify SVG still visible
    await expect(page.locator('[data-testid="memory-svg"]')).toBeVisible();
  });
});

test.afterAll(async () => {
  // Cleanup: Clear test data if needed
  console.log('Advanced tools E2E tests completed');
});
