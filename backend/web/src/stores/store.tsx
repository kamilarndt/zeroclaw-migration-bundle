/**
 * Global state store for A2A messages and UI state
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import type { A2AMessage } from '../types/storage';
import type { Task } from '../types/tasks';
import type { Hand } from '../types/storage';
import { localStore } from '../lib/storage';

// ---------------------------------------------------------------------------
// A2A Message Store
// ---------------------------------------------------------------------------

interface A2AStoreContextType {
  messages: A2AMessage[];
  addMessage: (message: A2AMessage) => void;
  clearMessages: () => void;
}


// Sliding window configuration for message history
const MAX_MESSAGES = 100;
const A2AStoreContext = createContext<A2AStoreContextType | null>(null);

export function A2AStoreProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<A2AMessage[]>([]);

  const addMessage = useCallback((message: A2AMessage) => {
    setMessages((prev) => {
      const updated = [...prev, message];
      // Implement sliding window: remove oldest message if limit exceeded
      if (updated.length > MAX_MESSAGES) {
        updated.shift(); // Remove oldest message to prevent memory leak
      }
      return updated;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <A2AStoreContext.Provider value={{ messages, addMessage, clearMessages }}>
      {children}
    </A2AStoreContext.Provider>
  );
}

export function useA2AStore(): A2AStoreContextType {
  const context = useContext(A2AStoreContext);
  if (!context) {
    throw new Error('useA2AStore must be used within A2AStoreProvider');
  }
  return context;
}

// ---------------------------------------------------------------------------
// UI Store for Tasks and Hands
// ---------------------------------------------------------------------------

/**
 * UI Store state interface
 */
export interface UiStoreState {
  /** List of tasks */
  tasks: Task[];
  /** List of hands */
  hands: Hand[];
  /** Loading state for initial data fetch */
  isLoading: boolean;
  /** Error state for initial data fetch */
  error: string | null;
}

/**
 * UI Store actions interface
 */
export interface UiStoreActions {
  /** Set the list of tasks */
  setTasks: (tasks: Task[]) => void;
  /** Set the list of hands */
  setHands: (hands: Hand[]) => void;
  /** Add a new task */
  addTask: (task: Task) => void;
  /** Update an existing task */
  updateTask: (id: string, updates: Partial<Task>) => void;
  /** Remove a task */
  removeTask: (id: string) => void;
  /** Add a new hand */
  addHand: (hand: Hand) => void;
  /** Update an existing hand */
  updateHand: (id: string, updates: Partial<Hand>) => void;
  /** Remove a hand */
  removeHand: (id: string) => void;
  /** Hydrate state from storage */
  hydrate: (state: Partial<UiStoreState>) => void;
  /** Persist current state to storage */
  persist: () => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Subscribe to state changes */
  subscribe: (listener: (state: UiStoreState) => void) => () => void;
}

/**
 * Combined store interface
 */
export interface UiStore extends UiStoreState, UiStoreActions {}

const UiStoreContext = createContext<UiStore | null>(null);

/**
 * Provider props
 */
export interface UiStoreProviderProps {
  children: ReactNode;
}

/**
 * Create the store implementation
 */
function createUiStore(): UiStore {
  let state: UiStoreState = {
    tasks: [],
    hands: [],
    isLoading: false,
    error: null,
  };

  const listeners = new Set<(state: UiStoreState) => void>();

  const getState = () => state;

  const setState = (
    partial: Partial<UiStoreState> | ((prev: UiStoreState) => Partial<UiStoreState>)
  ) => {
    const prevState = { ...state };
    const updates = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...updates };

    // Only notify listeners if state actually changed (shallow comparison)
    const stateKeys = Object.keys(state) as Array<keyof UiStoreState>;
    const hasChanged = stateKeys.some((key) => state[key] !== prevState[key]);

    if (hasChanged) {
      listeners.forEach((listener) => listener(state));
    }
  };

  const subscribe = (listener: (state: UiStoreState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // Persist state to localStorage
  const persist = () => {
    try {
      localStore.set('tasks', state.tasks);
      localStore.set('hands', state.hands);
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  };

  // Hydrate state from localStorage
  const hydrate = (incomingState: Partial<UiStoreState>) => {
    try {
      const storedTasks = localStore.get<Task[]>('tasks');
      const storedHands = localStore.get<Hand[]>('hands');

      setState({
        ...incomingState,
        tasks: incomingState.tasks ?? storedTasks ?? [],
        hands: incomingState.hands ?? storedHands ?? [],
      });
    } catch (error) {
      console.error('Error hydrating state:', error);
      setState(incomingState);
    }
  };

  // Task actions
  const setTasks = (tasks: Task[]) => {
    setState({ tasks });
  };

  const addTask = (task: Task) => {
    setState((prev) => ({ tasks: [...prev.tasks, task] }));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setState((prev) => ({
      tasks: prev.tasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      ),
    }));
  };

  const removeTask = (id: string) => {
    setState((prev) => ({
      tasks: prev.tasks.filter((task) => task.id !== id),
    }));
  };

  // Hand actions
  const setHands = (hands: Hand[]) => {
    setState({ hands });
  };

  const addHand = (hand: Hand) => {
    setState((prev) => ({ hands: [...prev.hands, hand] }));
  };

  const updateHand = (id: string, updates: Partial<Hand>) => {
    setState((prev) => ({
      hands: prev.hands.map((hand) =>
        hand.id === id ? { ...hand, ...updates } : hand
      ),
    }));
  };

  const removeHand = (id: string) => {
    setState((prev) => ({
      hands: prev.hands.filter((hand) => hand.id !== id),
    }));
  };

  // Loading and error actions
  const setLoading = (loading: boolean) => {
    setState({ isLoading: loading });
  };

  const setError = (error: string | null) => {
    setState({ error });
  };

  // Auto-persist on state changes
  subscribe(() => {
    persist();
  });

  return {
    ...getState(),
    setTasks,
    addTask,
    updateTask,
    removeTask,
    setHands,
    addHand,
    updateHand,
    removeHand,
    hydrate,
    persist,
    setLoading,
    setError,
    subscribe,
  };
}

/**
 * UI Store Provider Component
 */
export function UiStoreProvider({ children }: UiStoreProviderProps) {
  const storeRef = useRef<UiStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createUiStore();
  }

  return React.createElement(
    UiStoreContext.Provider,
    { value: storeRef.current },
    children
  );
}

/**
 * Hook to access the UI store
 */
export function useUiStore(): UiStore {
  const store = useContext(UiStoreContext);
  if (!store) {
    throw new Error('useUiStore must be used within a UiStoreProvider');
  }
  return store;
}

/**
 * Hook to subscribe to store updates for a specific selector
 * This ensures components re-render when selected state changes
 */
export function useUiStoreSelector<T>(selector: (state: UiStoreState) => T): T {
  const store = useUiStore();
  const [selected, setSelected] = useState<T>(() => selector(store));

  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      const newSelected = selector(state);
      setSelected((prev) => {
        // Shallow comparison to avoid unnecessary re-renders
        if (Array.isArray(newSelected) && Array.isArray(prev)) {
          if (newSelected.length === prev.length) {
            return newSelected.every((item, i) => item === prev[i]) ? prev : newSelected;
          }
          return newSelected;
        }
        return newSelected === prev ? prev : newSelected;
      });
    });

    return unsubscribe;
  }, [store, selector]);

  return selected;
}
