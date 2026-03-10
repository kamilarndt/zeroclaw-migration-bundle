/**
 * Integration test for useInitialHandState hook
 * This test verifies that the hook correctly fetches and hydrates state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useInitialHandState } from '../useInitialHandState';
import { UiStoreProvider, useUiStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';

// Mock the apiFetch function
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useInitialHandState Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('should integrate with UI store and hydrate state', async () => {
    const mockHands = [
      {
        id: 'hand-1',
        name: 'Test Hand',
        type: 'native' as const,
        status: 'idle' as const,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(apiFetch).mockResolvedValueOnce({
      active_hands: mockHands,
      provider: 'test',
      model: 'test-model',
      temperature: 0.7,
      uptime_seconds: 100,
      gateway_port: 8080,
      locale: 'en',
      memory_backend: 'memory',
      paired: true,
      channels: {},
      health: {
        pid: 1234,
        updated_at: '2024-01-01T00:00:00Z',
        uptime_seconds: 100,
        components: {},
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UiStoreProvider>{children}</UiStoreProvider>
    );

    // Render the hook
    const { result } = renderHook(
      () => {
        useInitialHandState();
        return useUiStore();
      },
      { wrapper }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify hands were set
    expect(result.current.hands).toEqual(mockHands);
    expect(result.current.error).toBeNull();

    // Verify localStorage was updated
    expect(localStorageMock.getItem('zeroclaw_hands')).toBe(
      JSON.stringify(mockHands)
    );
  });

  it('should persist state changes to localStorage', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      provider: 'test',
      model: 'test-model',
      temperature: 0.7,
      uptime_seconds: 100,
      gateway_port: 8080,
      locale: 'en',
      memory_backend: 'memory',
      paired: true,
      channels: {},
      health: {
        pid: 1234,
        updated_at: '2024-01-01T00:00:00Z',
        uptime_seconds: 100,
        components: {},
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UiStoreProvider>{children}</UiStoreProvider>
    );

    const { result } = renderHook(
      () => {
        useInitialHandState();
        return useUiStore();
      },
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Add a task
    const newTask = {
      id: 'task-1',
      title: 'Test Task',
      status: 'Todo' as const,
    };

    result.current.addTask(newTask);

    // Verify it was persisted
    await waitFor(() => {
      const storedTasks = localStorageMock.getItem('zeroclaw_tasks');
      expect(storedTasks).toContain('Test Task');
    });
  });
});
