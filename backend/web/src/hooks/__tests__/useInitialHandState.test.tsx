/**
 * Tests for useInitialHandState hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInitialHandState } from '../useInitialHandState';
import { UiStoreProvider, useUiStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';

// Mock the apiFetch function
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

global.localStorage = localStorageMock as any;

describe('useInitialHandState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and hydrate initial state on mount', async () => {
    const mockHands = [
      {
        id: 'hand-1',
        name: 'Test Hand 1',
        type: 'native' as const,
        status: 'idle' as const,
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'hand-2',
        name: 'Test Hand 2',
        type: 'wasm' as const,
        status: 'running' as const,
        createdAt: '2024-01-02T00:00:00Z',
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

    const { result } = renderHook(() => {
      useInitialHandState();
      return useUiStore();
    }, { wrapper });

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify that hands were set
    expect(result.current.hands).toEqual(mockHands);
    expect(result.current.error).toBeNull();

    // Verify apiFetch was called
    expect(apiFetch).toHaveBeenCalledWith('/api/status');
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(
      new Error('Network error')
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UiStoreProvider>{children}</UiStoreProvider>
    );

    const { result } = renderHook(() => {
      useInitialHandState();
      return useUiStore();
    }, { wrapper });

    // Wait for the error to be set
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify error state
    expect(result.current.error).toBe('Network error');
    expect(result.current.hands).toEqual([]);
  });

  it('should handle missing active_hands in response', async () => {
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

    const { result } = renderHook(() => {
      useInitialHandState();
      return useUiStore();
    }, { wrapper });

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify that hands defaults to empty array
    expect(result.current.hands).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
