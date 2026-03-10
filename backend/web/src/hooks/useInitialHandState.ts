import { useEffect } from 'react';
import { useUiStore } from '../stores/store';
import { apiFetch } from '../lib/api';
import type { Hand } from '../types/storage';

/**
 * Response shape from /api/status endpoint
 */
interface StatusResponse {
  active_hands?: Hand[];
  [key: string]: any;
}

/**
 * Hook to fetch initial hand state from the server on mount
 * and hydrate the UI store with both server and localStorage data
 */
export function useInitialHandState(): void {
  const { hydrate, setHands, setLoading, setError } = useUiStore();

  useEffect(() => {
    let cancelled = false;

    const fetchInitialState = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch active hands from server
        const response = await apiFetch<StatusResponse>('/api/status');

        if (!cancelled) {
          // Extract active_hands from response if available
          const serverHands = response.active_hands ?? [];

          // Hydrate store with server data, merging with localStorage
          hydrate({
            hands: serverHands,
          });

          // Also set hands directly to ensure store is updated
          setHands(serverHands);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch initial state:', error);

          // On error, still hydrate from localStorage as fallback
          hydrate({});

          setError(
            error instanceof Error ? error.message : 'Failed to fetch initial state'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchInitialState();

    return () => {
      cancelled = true;
    };
  }, [hydrate, setHands, setLoading, setError]);
}
