/**
 * Storage-related type definitions
 */

/**
 * Agent-to-Agent message structure
 */
export interface A2AMessage {
  hand_id: string;
  timestamp: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

/**
 * UI state persistence structure
 */
export interface UiState {
  theme?: 'light' | 'dark' | 'system';
  sidebarCollapsed?: boolean;
  activeView?: string;
  lastUpdated?: number;
}

/**
 * Task definition for storage
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'Todo' | 'InProgress' | 'Review' | 'Done';
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Hand definition for storage
 */
export interface Hand {
  id: string;
  name: string;
  type: 'native' | 'wasm' | 'container';
  status: 'idle' | 'running' | 'paused' | 'error';
  config?: Record<string, any>;
  createdAt: string;
  lastActivity?: string;
}
