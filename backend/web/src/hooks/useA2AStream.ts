import { useState, useEffect, useRef, useCallback } from 'react';
import { useA2AStore } from '../stores/store';
import { idbStore } from '../lib/storage';
import type { A2AMessage } from '../types/storage';

export function useA2AStream() {
  const { messages, addMessage } = useA2AStore();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/a2a`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = async () => {
        console.log('[A2A Stream] WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Fetch server state on connection/reconnection
        try {
          const response = await fetch('/v1/agent/status');
          if (response.ok) {
            const status = await response.json();
            console.log('[A2A Stream] Server status fetched:', status);
          }
        } catch (fetchError) {
          console.error('[A2A Stream] Failed to fetch server status:', fetchError);
        }
      };

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // Transform to A2AMessage format if needed
          const a2aMessage: A2AMessage = {
            hand_id: data.hand_id || 'unknown',
            timestamp: data.timestamp || Date.now(),
            role: data.role || 'system',
            content: data.content || JSON.stringify(data),
            metadata: data.metadata,
          };

          // Add to store
          addMessage(a2aMessage);

          // Persist to IndexedDB
          await idbStore.addMessage(a2aMessage);
        } catch (parseError) {
          console.error('[A2A Stream] Failed to parse message:', parseError);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[A2A Stream] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect after 5 seconds
        if (!event.wasClean) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[A2A Stream] Attempting to reconnect...');
            connect();
          }, 5000);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('[A2A Stream] WebSocket error:', event);
        setError('WebSocket connection error');
      };
    } catch (err) {
      console.error('[A2A Stream] Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [addMessage]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    messages,
    isConnected,
    error,
  };
}
