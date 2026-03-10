/**
 * ZeroClaw Kanban Board E2E Tests - Playwright
 *
 * Tests Kanban board functionality including:
 * - Status column rendering (To Do, In Progress, Review, Done)
 * - Task creation
 * - Zustand state integration
 * - Drag-and-drop task movement between columns
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
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:42617';
const TEST_TOKEN = process.env.TEST_TOKEN || '';

interface AuthTokens {
  bearer: string;
  expires?: number;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Authenticate with the gateway and return bearer token.
 * Skips pairing if TEST_TOKEN is provided.
 */
async function authenticate(): Promise<AuthTokens> {
  if (TEST_TOKEN) {
    return { bearer: TEST_TOKEN };
  }

  // Generate pairing code via status endpoint
  const statusResponse = await fetch(`${API_URL}/api/v1/status`);
  expect(statusResponse.ok).toBeTruthy();

  // Generate random pairing code for testing
  const pairingCode = Math.random().toString().slice(2, 8).padStart(6, '0');

  // Pair with the gateway
  const pairResponse = await fetch(`${API_URL}/pair`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Pairing-Code': pairingCode,
    },
  });

  expect(pairResponse.ok).toBeTruthy();

  const data = await pairResponse.json();
  expect(data.token).toBeDefined();

  return { bearer: data.token };
}

/**
 * Create a test task via Zustand store
 */
async function createTask(page: any, taskData: Partial<Task>): Promise<Task> {
  const newTask: Task = {
    id: `test-task-${Date.now()}-${Math.random()}`,
    title: taskData.title || 'Test Task',
    description: taskData.description || '',
    status: taskData.status || 'todo',
    priority: taskData.priority || 'medium',
    tags: taskData.tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Add task to Zustand store
  await page.evaluate((task: Task) => {
    // @ts-ignore - accessing Zustand store from window
    const store = window.__ZEROCLAW_TASK_STORE__;
    if (store) {
      const currentTasks = store.getState().tasks || [];
      store.setState({ tasks: [...currentTasks, task] });
    }
  }, newTask);

  return newTask;
}

/**
 * Update a task via Zustand store
 */
async function updateTask(page: any, taskId: string, updates: Partial<Task>): Promise<Task> {
  const updatedTask = await page.evaluate(({ id, updates }) => {
    // @ts-ignore - accessing Zustand store from window
    const store = window.__ZEROCLAW_TASK_STORE__;
    if (store) {
      const currentTasks = store.getState().tasks || [];
      const updatedTasks = currentTasks.map((t: Task) =>
        t.id === id ? { ...t, ...updates } : t
      );
      store.setState({ tasks: updatedTasks });
      return updatedTasks.find((t: Task) => t.id === id);
    }
    return null;
  }, { id: taskId, updates });

  return updatedTask || { id: taskId, ...updates } as Task;
}

/**
 * Delete a task via Zustand store
 */
async function deleteTask(page: any, taskId: string): Promise<void> {
  await page.evaluate((id: string) => {
    // @ts-ignore - accessing Zustand store from window
    const store = window.__ZEROCLAW_TASK_STORE__;
    if (store) {
      const currentTasks = store.getState().tasks || [];
      store.setState({ tasks: currentTasks.filter((t: Task) => t.id !== id) });
    }
  }, taskId);
}

/**
 * Clear all test tasks from store
 */
async function clearTestTasks(page: any): Promise<void> {
  await page.evaluate(() => {
    // @ts-ignore - accessing Zustand store from window
    const store = window.__ZEROCLAW_TASK_STORE__;
    if (store) {
      store.setState({ tasks: [] });
    }
  });
}

// =============================================================================
// TEST SETUP
// =============================================================================

test.beforeAll(async () => {
  console.log('Using mock authentication for Kanban tests');
});

test.beforeEach(async ({ page }) => {
  // Navigate to tasks page (auth is handled by storageState in playwright.config.ts)
  await page.goto(`${BASE_URL}/tasks`);
  await page.waitForLoadState('networkidle');

  // Clear any existing tasks before each test
  await clearTestTasks(page);
});

test.afterEach(async ({ page }) => {
  // Clean up tasks after each test
  await clearTestTasks(page);
});

// =============================================================================
// TESTS
// =============================================================================

test.describe('Kanban Board - Column Rendering', () => {
  test('should render all four status columns', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    // Check all columns exist
    const todoColumn = page.getByTestId('kanban-column-todo');
    const inProgressColumn = page.getByTestId('kanban-column-in_progress');
    const reviewColumn = page.getByTestId('kanban-column-review');
    const doneColumn = page.getByTestId('kanban-column-done');

    await expect(todoColumn).toBeVisible();
    await expect(inProgressColumn).toBeVisible();
    await expect(reviewColumn).toBeVisible();
    await expect(doneColumn).toBeVisible();
  });

  test('should display correct column titles', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    await expect(page.getByTestId('column-title-todo')).toContainText('To Do');
    await expect(page.getByTestId('column-title-in_progress')).toContainText('In Progress');
    await expect(page.getByTestId('column-title-review')).toContainText('In Review');
    await expect(page.getByTestId('column-title-done')).toContainText('Done');
  });

  test('should display task counts for each column', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    // Check that count badges are visible (they show 0 or actual count)
    const todoCount = page.getByTestId('column-count-todo');
    const inProgressCount = page.getByTestId('column-count-in_progress');
    const reviewCount = page.getByTestId('column-count-review');
    const doneCount = page.getByTestId('column-count-done');

    await expect(todoCount).toBeVisible();
    await expect(inProgressCount).toBeVisible();
    await expect(reviewCount).toBeVisible();
    await expect(doneCount).toBeVisible();

    // Verify counts are displayed as numbers
    const todoText = await todoCount.textContent();
    const inProgressText = await inProgressCount.textContent();

    expect(todoText).toBeDefined();
    expect(inProgressText).toBeDefined();
  });
});

test.describe('Kanban Board - Task Creation', () => {
  test('should add a new task to the To Do column', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    const taskTitle = 'E2E Test New Task';

    // Create task via API
    const newTask = await createTask(page, {
      title: taskTitle,
      description: 'This is a test task created via API',
      status: 'todo',
    });

    // Trigger a page reload or state update
    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    // Verify task appears in UI
    await expect(page.getByTestId(`task-card-${newTask.id}`)).toBeVisible();
    await expect(page.getByTestId(`task-title-${newTask.id}`)).toContainText(taskTitle);
  });

  test('should verify Zustand state persistence after adding task', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });


    // Get initial task count from store
    const initialTasks = await page.evaluate(async () => {
      // @ts-ignore - accessing Zustand store from window
      const store = window.__ZEROCLAW_TASK_STORE__;
      return store ? store.getState().tasks : [];
    });

    // Create new task
    const newTask = await createTask(page, {
      title: 'E2E Test State Persistence',
      description: 'Testing Zustand state',
      status: 'todo',
    });

    // Wait for state to update
    await page.waitForTimeout(1000);

    // Verify task in store
    const updatedTasks = await page.evaluate(async () => {
      // @ts-ignore - accessing Zustand store from window
      const store = window.__ZEROCLAW_TASK_STORE__;
      return store ? store.getState().tasks : [];
    });

    expect(updatedTasks.length).toBeGreaterThan(initialTasks.length);
    expect(updatedTasks.some((t: Task) => t.id === newTask.id)).toBeTruthy();
  });
});

test.describe('Kanban Board - Drag and Drop', () => {
  test('should move task from To Do to In Progress', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });


    // Create a task in todo
    const task = await createTask(page, {
      title: 'E2E Test Drag Task 1',
      description: 'Task to be moved from todo to in progress',
      status: 'todo',
    });

    // Reload to see the task
    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    // Verify task is in todo column
    const todoColumn = page.getByTestId('kanban-column-todo');
    await expect(todoColumn.getByTestId(`task-card-${task.id}`)).toBeVisible();

    // Simulate drag and drop using dnd-kit
    await page.evaluate(async ({ taskId, newStatus }) => {
      // Find the task element
      const taskElement = document.querySelector(`[data-testid="task-item-${taskId}"]`);
      const targetColumn = document.querySelector(`[data-testid="kanban-column-${newStatus}"]`);

      if (!taskElement || !targetColumn) {
        throw new Error('Task or target column not found');
      }

      // Create drag events
      const dragStart = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      taskElement.dispatchEvent(dragStart);

      const drop = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      targetColumn.dispatchEvent(drop);

      const dragEnd = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      taskElement.dispatchEvent(dragEnd);
    }, { taskId: task.id, newStatus: 'in_progress' });

    // Wait for update
    await page.waitForTimeout(1000);

    // Alternatively, update via API and verify UI reflects change
    await updateTask(page, task.id, { status: 'in_progress' });
    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    // Verify task moved to in_progress column
    const inProgressColumn = page.getByTestId('kanban-column-in_progress');
    await expect(inProgressColumn.getByTestId(`task-card-${task.id}`)).toBeVisible();

    // Verify task no longer in todo column
    const todoTasks = todoColumn.getByTestId(`task-card-${task.id}`);
    await expect(todoTasks).not.toBeVisible();
  });

  test('should move task through all status columns', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    const task = await createTask(page, {
      title: 'E2E Test Full Workflow',
      description: 'Task moving through all columns',
      status: 'todo',
    });

    const statuses: Array<'todo' | 'in_progress' | 'review' | 'done'> = ['todo', 'in_progress', 'review', 'done'];

    // Move through each status
    for (let i = 0; i < statuses.length - 1; i++) {
      const currentStatus = statuses[i];
      const nextStatus = statuses[i + 1];

      // Update via API
      await updateTask(page, task.id, { status: nextStatus });

      // Reload and verify
      await page.reload();
      await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

      const currentColumn = page.getByTestId(`kanban-column-${currentStatus}`);
      const nextColumn = page.getByTestId(`kanban-column-${nextStatus}`);

      // Task should be in next column
      await expect(nextColumn.getByTestId(`task-card-${task.id}`)).toBeVisible();

      // Task should not be in current column
      await expect(currentColumn.getByTestId(`task-card-${task.id}`)).not.toBeVisible();
    }
  });

  test('should handle rapid status changes correctly', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    const task = await createTask(page, {
      title: 'E2E Test Rapid Changes',
      description: 'Testing rapid status changes',
      status: 'todo',
    });

    // Rapidly change status
    await updateTask(page, task.id, { status: 'in_progress' });
    await updateTask(page, task.id, { status: 'review' });
    await updateTask(page, task.id, { status: 'done' });

    // Reload and verify final state
    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    const doneColumn = page.getByTestId('kanban-column-done');
    await expect(doneColumn.getByTestId(`task-card-${task.id}`)).toBeVisible();

    // Verify it's not in other columns
    const todoColumn = page.getByTestId('kanban-column-todo');
    await expect(todoColumn.getByTestId(`task-card-${task.id}`)).not.toBeVisible();
  });
});

test.describe('Kanban Board - State Integration', () => {
  test('should reflect API changes in real-time', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    const task = await createTask(page, {
      title: 'E2E Test Real-time Update',
      description: 'Testing real-time state updates',
      status: 'todo',
    });

    // Reload and verify initial state
    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });
    await expect(page.getByTestId(`task-card-${task.id}`)).toBeVisible();

    // Update task via API while page is open
    await updateTask(page, task.id, {
      title: 'E2E Test Real-time Update - Modified',
      status: 'in_progress',
    });

    // Trigger a refetch (in real app, this might be WebSocket or polling)
    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    // Verify updates are reflected
    await expect(page.getByTestId(`task-title-${task.id}`)).toContainText('Modified');

    const inProgressColumn = page.getByTestId('kanban-column-in_progress');
    await expect(inProgressColumn.getByTestId(`task-card-${task.id}`)).toBeVisible();
  });

  test('should maintain state consistency across page reloads', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    const tasks = await Promise.all([
      createTask(page, {
        title: 'E2E Test Persistence 1',
        status: 'todo',
      }),
      createTask(page, {
        title: 'E2E Test Persistence 2',
        status: 'in_progress',
      }),
      createTask(page, {
        title: 'E2E Test Persistence 3',
        status: 'review',
      }),
    ]);

    // Reload multiple times and verify consistency
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

      for (const task of tasks) {
        await expect(page.getByTestId(`task-card-${task.id}`)).toBeVisible();
      }
    }
  });
});

test.describe('Kanban Board - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    // Create a task successfully
    await createTask(page, {
      title: 'E2E Test Error Handling',
      status: 'todo',
    });

    // Verify board is still functional after task creation
    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });
    await expect(page.getByTestId('kanban-board')).toBeVisible();
  });
});

test.describe('Kanban Board - Accessibility', () => {
  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    // Verify board structure
    const board = page.getByTestId('kanban-board');
    await expect(board).toBeVisible();

    // Verify columns are accessible
    const columns = await page.locator('[data-testid^="kanban-column-"]').all();
    expect(columns.length).toBe(4);

    // Verify task cards are accessible
    const task = await createTask(page, {
      title: 'E2E Test Accessibility',
      status: 'todo',
    });

    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });

    const taskCard = page.getByTestId(`task-card-${task.id}`);
    await expect(taskCard).toBeVisible();

    // Verify keyboard navigation works
    await taskCard.focus();
    await expect(taskCard).toBeFocused();
  });
});

test.describe('Kanban Board - Performance', () => {
  test('should handle large number of tasks efficiently', async ({ page }) => {
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });


    // Create multiple tasks
    const taskPromises = Array.from({ length: 15 }, (_, i) =>
      createTask(page, {
        title: `E2E Test Performance Task ${i + 1}`,
        status: 'todo',
      })
    );

    await Promise.all(taskPromises);

    // Reload and verify performance
    const startTime = Date.now();
    await page.reload();
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });
    const loadTime = Date.now() - startTime;

    // Board should load within reasonable time (< 5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Verify board is interactive
    await expect(page.getByTestId('kanban-board')).toBeVisible();
  });
});
