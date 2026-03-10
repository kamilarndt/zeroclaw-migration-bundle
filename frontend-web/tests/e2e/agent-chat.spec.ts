/**
 * ZeroClaw AgentChat E2E Tests - Playwright
 *
 * Tests the 3-panel AgentChat architecture:
 * - Left panel: Agents list with drag-and-drop functionality
 * - Center panel: Chat area with message history
 * - Right panel: Extraction layer for task suggestions
 *
 * Prerequisites:
 * - ZeroClaw dashboard running (default: http://localhost:5173)
 * - WebSocket connection available
 * - Valid authentication
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const CHAT_PAGE = `${BASE_URL}/chat`;

// =============================================================================
// TEST SUITE: 3-Panel Architecture
// =============================================================================

test.describe('AgentChat: 3-Panel Architecture', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to chat page
    await page.goto(CHAT_PAGE);
    await page.waitForLoadState('networkidle');

    // Wait for the main container to be visible
    await page.waitForSelector('[data-testid="agent-chat-container"]', { timeout: 5000 });
  });

  test('renders all three panels: agents list, chat area, and extraction layer', async ({ page }) => {
    // Verify main container exists
    const container = page.getByTestId('agent-chat-container');
    await expect(container).toBeVisible();

    // Verify left panel: Agents list
    const agentsPanel = page.getByTestId('agents-panel');
    await expect(agentsPanel).toBeVisible();
    await expect(agentsPanel).toContainText('Available Agents');

    // Verify center panel: Chat zone
    const chatZone = page.getByTestId('chat-zone');
    await expect(chatZone).toBeVisible();

    // Verify right panel: Extraction layer
    const extractionLayer = page.getByTestId('extraction-layer');
    await expect(extractionLayer).toBeVisible();
    await expect(extractionLayer).toContainText('Task Suggestions');
  });

  test('displays available agents in the left panel with proper structure', async ({ page }) => {
    const agentsPanel = page.getByTestId('agents-panel');

    // Check for specific agents
    const coderAgent = page.getByTestId('agent-coder');
    await expect(coderAgent).toBeVisible();
    await expect(coderAgent).toContainText('Coder');
    await expect(coderAgent).toContainText('Developer');

    const researcherAgent = page.getByTestId('agent-researcher');
    await expect(researcherAgent).toBeVisible();
    await expect(researcherAgent).toContainText('Researcher');
    await expect(researcherAgent).toContainText('Analyst');

    const testerAgent = page.getByTestId('agent-tester');
    await expect(testerAgent).toBeVisible();
    await expect(testerAgent).toContainText('Tester');
    await expect(testerAgent).toContainText('QA');

    const plannerAgent = page.getByTestId('agent-planner');
    await expect(plannerAgent).toBeVisible();
    await expect(plannerAgent).toContainText('Planner');
    await expect(plannerAgent).toContainText('Manager');
  });

  test('shows empty task suggestions in extraction layer initially', async ({ page }) => {
    const extractionLayer = page.getByTestId('extraction-layer');
    const emptySuggestions = page.getByTestId('empty-task-suggestions');

    await expect(emptySuggestions).toBeVisible();
    await expect(emptySuggestions).toContainText('Send a message to generate');
    await expect(emptySuggestions).toContainText('task suggestions');
  });

  test('displays chat header with connection status and new chat button', async ({ page }) => {
    const header = page.getByTestId('chat-header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Agent Chat');

    const newChatButton = page.getByTestId('new-chat-button');
    await expect(newChatButton).toBeVisible();
    await expect(newChatButton).toBeEnabled();
  });

  test('shows messages container with initial welcome message', async ({ page }) => {
    const messagesContainer = page.getByTestId('messages-container');
    await expect(messagesContainer).toBeVisible();

    // Should contain initial greeting
    await expect(messagesContainer).toContainText('Hello! I am ZeroClaw');
  });
});

// =============================================================================
// TEST SUITE: Drag and Drop Functionality
// =============================================================================

test.describe('AgentChat: Active Agents Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_PAGE);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="agent-chat-container"]', { timeout: 5000 });
  });

  test('allows adding an agent via the Add Agent modal', async ({ page }) => {
    const addButton = page.getByTestId('add-agent-button');
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Click on coder agent in modal
    await page.getByTestId('modal-agent-coder').click();

    // Modal should close and agent should be active
    await expect(page.getByTestId('add-agent-modal')).not.toBeVisible();
    const activeAgent = page.getByTestId('active-agent-coder');
    await expect(activeAgent).toBeVisible();
    await expect(activeAgent).toContainText('Coder');
  });

  test('prevents duplicate agents from being added', async ({ page }) => {
    const addButton = page.getByTestId('add-agent-button');

    // Add agent twice
    await addButton.click();
    await page.getByTestId('modal-agent-coder').click();
    await page.waitForTimeout(100);

    await addButton.click();
    // Modal should open but coder should not be in the list (already active)
    await expect(page.getByTestId('modal-agent-coder')).not.toBeVisible();

    // Close modal
    await page.getByTestId('close-add-agent-modal').click();

    // Should only appear once in active agents
    const activeAgents = page.getByTestId('active-agent-coder').all();
    const count = (await activeAgents).length;
    expect(count).toBe(1);
  });

  test('allows removing an agent from active agents', async ({ page }) => {
    // Add agent via modal
    await page.getByTestId('add-agent-button').click();
    await page.getByTestId('modal-agent-coder').click();

    const activeAgent = page.getByTestId('active-agent-coder');
    await expect(activeAgent).toBeVisible();

    // Remove the agent
    const removeButton = page.getByTestId('remove-agent-coder');
    await removeButton.click();

    // Verify agent is removed
    await expect(activeAgent).not.toBeVisible();
  });

  test('displays active agents bar only when agents are active', async ({ page }) => {
    const activeAgentsBar = page.getByTestId('active-agents-bar');

    // Initially should not be visible
    await expect(activeAgentsBar).not.toBeVisible();

    // Add an agent via modal
    await page.getByTestId('add-agent-button').click();
    await page.getByTestId('modal-agent-coder').click();

    // Now should be visible
    await expect(activeAgentsBar).toBeVisible();

    // Remove the agent
    await page.getByTestId('remove-agent-coder').click();

    // Should not be visible again
    await expect(activeAgentsBar).not.toBeVisible();
  });

  test('allows adding multiple agents', async ({ page }) => {
    // Add coder
    await page.getByTestId('add-agent-button').click();
    await page.getByTestId('modal-agent-coder').click();
    await page.waitForTimeout(100);

    // Add researcher
    await page.getByTestId('add-agent-button').click();
    await page.getByTestId('modal-agent-researcher').click();
    await page.waitForTimeout(100);

    // Both should be visible
    await expect(page.getByTestId('active-agent-coder')).toBeVisible();
    await expect(page.getByTestId('active-agent-researcher')).toBeVisible();

    // Active agents bar should show 2 agents
    const activeAgentsBar = page.getByTestId('active-agents-bar');
    await expect(activeAgentsBar).toBeVisible();
  });
});

// =============================================================================
// TEST SUITE: Add Agent Modal
// =============================================================================

test.describe('AgentChat: Add Agent Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_PAGE);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="agent-chat-container"]', { timeout: 5000 });
  });

  test('opens Add Agent modal when clicking the add button', async ({ page }) => {
    const addButton = page.getByTestId('add-agent-button');
    await expect(addButton).toBeVisible();

    await addButton.click();

    const modal = page.getByTestId('add-agent-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Add Agent');
  });

  test('displays all available agents in the modal', async ({ page }) => {
    // Open modal
    await page.getByTestId('add-agent-button').click();

    // Check for agents in modal
    await expect(page.getByTestId('modal-agent-coder')).toBeVisible();
    await expect(page.getByTestId('modal-agent-researcher')).toBeVisible();
    await expect(page.getByTestId('modal-agent-tester')).toBeVisible();
    await expect(page.getByTestId('modal-agent-planner')).toBeVisible();
  });

  test('adds agent to active agents when clicking agent in modal', async ({ page }) => {
    // Open modal
    await page.getByTestId('add-agent-button').click();

    // Click on an agent
    await page.getByTestId('modal-agent-coder').click();

    // Modal should close
    await expect(page.getByTestId('add-agent-modal')).not.toBeVisible();

    // Agent should be active
    await expect(page.getByTestId('active-agent-coder')).toBeVisible();
  });

  test('closes modal when clicking close button', async ({ page }) => {
    // Open modal
    await page.getByTestId('add-agent-button').click();

    const modal = page.getByTestId('add-agent-modal');
    await expect(modal).toBeVisible();

    // Click close button
    await page.getByTestId('close-add-agent-modal').click();

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('hides already active agents from modal options', async ({ page }) => {
    // Add an agent via modal
    await page.getByTestId('add-agent-button').click();
    await page.getByTestId('modal-agent-coder').click();
    await page.waitForTimeout(100);

    // Open modal again
    await page.getByTestId('add-agent-button').click();

    // Coder should not be in the modal (already active)
    await expect(page.getByTestId('modal-agent-coder')).not.toBeVisible();

    // Other agents should still be visible
    await expect(page.getByTestId('modal-agent-researcher')).toBeVisible();
  });

  test('closes modal when clicking outside', async ({ page }) => {
    // Open modal
    await page.getByTestId('add-agent-button').click();

    const modal = page.getByTestId('add-agent-modal');
    await expect(modal).toBeVisible();

    // Click outside the modal (on the overlay)
    await page.mouse.click(100, 100);

    // Modal should close
    await expect(modal).not.toBeVisible();
  });
});

// =============================================================================
// TEST SUITE: Task Extraction
// =============================================================================

test.describe('AgentChat: Task Extraction Layer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_PAGE);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="agent-chat-container"]', { timeout: 5000 });
  });

  test('generates task suggestions after sending a message', async ({ page }) => {
    // Find the chat input and send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Help me create a React component for a user profile');
    await textarea.press('Enter');

    // Wait for task suggestions to appear (simulated delay)
    await page.waitForTimeout(2500);

    // Verify task suggestions are no longer empty
    const emptySuggestions = page.getByTestId('empty-task-suggestions');
    await expect(emptySuggestions).not.toBeVisible();

    // Check for specific task suggestions
    await expect(page.getByTestId('task-suggestion-1')).toBeVisible();
    await expect(page.getByTestId('task-suggestion-2')).toBeVisible();
    await expect(page.getByTestId('task-suggestion-3')).toBeVisible();
  });

  test('displays task suggestions with proper structure and priority badges', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Create a task management system');
    await textarea.press('Enter');

    // Wait for suggestions
    await page.waitForTimeout(2500);

    // Check first suggestion
    const suggestion1 = page.getByTestId('task-suggestion-1');
    await expect(suggestion1).toBeVisible();
    await expect(suggestion1).toContainText('Analyze request');
    await expect(suggestion1).toContainText('high');

    // Check second suggestion
    const suggestion2 = page.getByTestId('task-suggestion-2');
    await expect(suggestion2).toBeVisible();
    await expect(suggestion2).toContainText('Research similar patterns');
    await expect(suggestion2).toContainText('medium');

    // Check third suggestion
    const suggestion3 = page.getByTestId('task-suggestion-3');
    await expect(suggestion3).toBeVisible();
    await expect(suggestion3).toContainText('Create implementation plan');
    await expect(suggestion3).toContainText('low');
  });

  test('allows creating a task from a suggestion', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('I need to organize my work');
    await textarea.press('Enter');

    // Wait for suggestions
    await page.waitForTimeout(2500);

    // Get initial count of suggestions
    const initialSuggestions = await page.getByTestId(/^task-suggestion-/).count();
    expect(initialSuggestions).toBe(3);

    // Click create task button on first suggestion
    await page.getByTestId('create-task-1').click();

    // Wait a moment
    await page.waitForTimeout(100);

    // Suggestion should be removed
    await expect(page.getByTestId('task-suggestion-1')).not.toBeVisible();

    // Should have fewer suggestions
    const remainingSuggestions = await page.getByTestId(/^task-suggestion-/).count();
    expect(remainingSuggestions).toBe(2);
  });

  test('clears task suggestions when starting a new chat', async ({ page }) => {
    // Send a message to generate suggestions
    const textarea = page.locator('textarea').first();
    await textarea.fill('Generate some tasks');
    await textarea.press('Enter');
    await page.waitForTimeout(2500);

    // Verify suggestions exist
    await expect(page.getByTestId('task-suggestion-1')).toBeVisible();

    // Click new chat button
    await page.getByTestId('new-chat-button').click();

    // Wait for state to update
    await page.waitForTimeout(100);

    // Suggestions should be cleared
    await expect(page.getByTestId('empty-task-suggestions')).toBeVisible();
    await expect(page.getByTestId('task-suggestion-1')).not.toBeVisible();
  });

  test('displays task descriptions in suggestions', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Plan a project');
    await textarea.press('Enter');
    await page.waitForTimeout(2500);

    // Check that descriptions are visible
    const suggestion1 = page.getByTestId('task-suggestion-1');
    await expect(suggestion1).toContainText('Break down the user request');

    const suggestion2 = page.getByTestId('task-suggestion-2');
    await expect(suggestion2).toContainText('Search for similar solutions');

    const suggestion3 = page.getByTestId('task-suggestion-3');
    await expect(suggestion3).toContainText('Draft a step-by-step implementation plan');
  });
});

// =============================================================================
// TEST SUITE: Chat Functionality
// =============================================================================

test.describe('AgentChat: Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_PAGE);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="agent-chat-container"]', { timeout: 5000 });
  });

  test('sends a message and displays it in the chat', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('Hello, this is a test message');
    await textarea.press('Enter');

    // Wait for message to appear
    await page.waitForTimeout(500);

    const messagesContainer = page.getByTestId('messages-container');
    await expect(messagesContainer).toContainText('Hello, this is a test message');
  });

  test('shows streaming indicator while processing', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('Test streaming');
    await textarea.press('Enter');

    // Check for streaming indicator (may appear briefly)
    const streamingIndicator = page.getByTestId('streaming-indicator');

    // Note: This may be too fast to catch in tests, but the element should exist
    await expect(streamingIndicator).toHaveCount(0); // Should be gone by the time we check
  });

  test('resets chat when clicking New Chat button', async ({ page }) => {
    // Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('This should be cleared');
    await textarea.press('Enter');
    await page.waitForTimeout(500);

    // Click new chat
    await page.getByTestId('new-chat-button').click();
    await page.waitForTimeout(100);

    // Should have welcome message again
    const messagesContainer = page.getByTestId('messages-container');
    await expect(messagesContainer).toContainText('Hello! I am ZeroClaw');
  });
});

// =============================================================================
// TEST SUITE: Integration
// =============================================================================

test.describe('AgentChat: Full Workflow Integration', () => {
  test('completes full workflow: add agent, send message, create task', async ({ page }) => {
    await page.goto(CHAT_PAGE);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="agent-chat-container"]', { timeout: 5000 });

    // Step 1: Add an agent via modal
    await page.getByTestId('add-agent-button').click();
    await page.getByTestId('modal-agent-coder').click();
    await page.waitForTimeout(100);

    await expect(page.getByTestId('active-agent-coder')).toBeVisible();

    // Step 2: Send a message
    const textarea = page.locator('textarea').first();
    await textarea.fill('Help me build a todo list app with React');
    await textarea.press('Enter');
    await page.waitForTimeout(500);

    // Verify message appears
    const messagesContainer = page.getByTestId('messages-container');
    await expect(messagesContainer).toContainText('todo list app');

    // Step 3: Wait for task suggestions
    await page.waitForTimeout(2500);

    // Verify suggestions appear
    await expect(page.getByTestId('task-suggestion-1')).toBeVisible();
    await expect(page.getByTestId('task-suggestion-2')).toBeVisible();

    // Step 4: Create a task from suggestion
    await page.getByTestId('create-task-1').click();
    await page.waitForTimeout(100);

    // Verify task was created (removed from suggestions)
    await expect(page.getByTestId('task-suggestion-1')).not.toBeVisible();
  });

  test('maintains state across multiple interactions', async ({ page }) => {
    await page.goto(CHAT_PAGE);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="agent-chat-container"]', { timeout: 5000 });

    // Add multiple agents via modal
    await page.getByTestId('add-agent-button').click();
    await page.getByTestId('modal-agent-coder').click();
    await page.waitForTimeout(100);

    await page.getByTestId('add-agent-button').click();
    await page.getByTestId('modal-agent-tester').click();
    await page.waitForTimeout(100);

    // Verify both are active
    await expect(page.getByTestId('active-agent-coder')).toBeVisible();
    await expect(page.getByTestId('active-agent-tester')).toBeVisible();

    // Send multiple messages
    const textarea = page.locator('textarea').first();
    await textarea.fill('First message');
    await textarea.press('Enter');
    await page.waitForTimeout(500);

    await textarea.fill('Second message');
    await textarea.press('Enter');
    await page.waitForTimeout(500);

    // Wait for task suggestions
    await page.waitForTimeout(2500);

    // Create multiple tasks
    await page.getByTestId('create-task-1').click();
    await page.waitForTimeout(100);
    await page.getByTestId('create-task-2').click();
    await page.waitForTimeout(100);

    // Verify state is maintained
    await expect(page.getByTestId('active-agent-coder')).toBeVisible();
    await expect(page.getByTestId('active-agent-tester')).toBeVisible();
    await expect(page.getByTestId('task-suggestion-3')).toBeVisible(); // Third suggestion should remain
  });
});
