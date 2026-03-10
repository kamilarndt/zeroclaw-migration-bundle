// web/src/stores/taskStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Task, TaskStatus, TaskFilter, APIResponse } from '@types'

// Re-export Task type for convenience
export type { Task, TaskStatus }

interface TaskStore {
  tasks: Task[]
  filter: TaskFilter
  searchQuery: string
  loading: boolean
  error: Error | null

  // Actions
  fetchTasks: () => Promise<void>
  addTask: (data: Partial<Task>) => Promise<Task>
  createTask: (data: Partial<Task>) => Promise<Task>
  updateTask: (id: string, updates: Partial<Task>) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  moveTask: (id: string, status: TaskStatus) => Promise<void>
  setFilter: (filter: TaskFilter) => void
  setSearchQuery: (query: string) => void
  clearError: () => void
}

const taskStoreImpl = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      filter: {},
      searchQuery: '',
      loading: false,
      error: null,

      fetchTasks: async () => {
        // Check if user is authenticated before fetching
        const token = localStorage.getItem('zeroclaw_token');
        if (!token) {
          return; // Don't fetch tasks if no token
        }

        set({ loading: true, error: null })
        try {
          const response = await fetch('/api/v1/tasks', {
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            }
          })
          const data: APIResponse<Task[]> = await response.json()

          if (data.success && data.data) {
            set({ tasks: data.data, loading: false })
          } else {
            throw new Error(data.error || 'Failed to fetch tasks')
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to fetch tasks')
          set({ error, loading: false })
        }
      },

      createTask: async (data) => {
        set({ loading: true, error: null })
        try {
          const response = await fetch('/api/v1/tasks', {
            method: 'POST',
            headers: { 
              'Authorization': 'Bearer ' + localStorage.getItem('zeroclaw_token'),
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
              title: data.title,
              description: data.description,
              status: data.status || 'todo',
              priority: data.priority || 'medium'
            })
          })

          const result: APIResponse<Task> = await response.json()

          if (result.success && result.data) {
            set((state) => ({ tasks: [...state.tasks, result.data!], loading: false }))
            return result.data
          } else {
            throw new Error(result.error || 'Failed to create task')
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to create task')
          set({ error, loading: false })
          throw error
        }
      },

      addTask: async (data) => {
        return await get().createTask(data)
      },

      updateTask: async (id, updates) => {
        // Optimistic update
        const previousTasks = get().tasks
        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
        }))

        try {
          const token = localStorage.getItem('zeroclaw_token');
          if (!token) {
            throw new Error('Authentication required');
          }

          const response = await fetch(`/api/v1/tasks/${id}`, {
            method: 'PUT',
            headers: { 
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify(updates)
          })

          const result: APIResponse<Task> = await response.json()

          if (result.success && result.data) {
            set((state) => ({
              tasks: state.tasks.map(t => t.id === id ? result.data! : t),
              loading: false
            }))
            return result.data
          } else {
            // Rollback on error
            set({ tasks: previousTasks })
            throw new Error(result.error || 'Failed to update task')
          }
        } catch (err) {
          set({ tasks: previousTasks })
          throw err
        }
      },

      deleteTask: async (id) => {
        // Optimistic update
        const previousTasks = get().tasks
        set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) }))

        try {
          const token = localStorage.getItem('zeroclaw_token');
          if (!token) {
            throw new Error('Authentication required');
          }

          const response = await fetch(`/api/v1/tasks/${id}`, { 
            method: 'DELETE',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            }
          })
          const result: APIResponse<void> = await response.json()

          if (!result.success) {
            // Rollback on error
            set({ tasks: previousTasks })
            throw new Error(result.error || 'Failed to delete task')
          }
        } catch (err) {
          set({ tasks: previousTasks })
          throw err
        }
      },

      moveTask: async (id, status) => {
        await get().updateTask(id, { status })
      },

      setFilter: (filter) => set({ filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      clearError: () => set({ error: null })
    }),
    {
      name: 'zeroclaw-task-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        // In test mode, persist tasks so they survive page reloads
        const isTestMode = typeof window !== 'undefined' &&
          (localStorage.getItem('zeroclaw_test_mode') === 'true' ||
           localStorage.getItem('zeroclaw_token') === 'mock-test-token-123');

        if (isTestMode) {
          return {
            filter: state.filter,
            searchQuery: state.searchQuery,
            tasks: state.tasks, // Persist tasks in test mode
          };
        }

        return {
          filter: state.filter,
          searchQuery: state.searchQuery
          // Nie persistujemy tasks, bo zawsze fetchujemy z API
        };
      }
    }
  )
)

// Export the hook
export const useTaskStore = taskStoreImpl

// Export store for testing (exposes getState, setState, subscribe)
export const __taskStore = taskStoreImpl

// Expose on window for E2E testing
if (typeof window !== 'undefined') {
  // @ts-ignore - exposing store for E2E testing
  window.__ZEROCLAW_TASK_STORE__ = taskStoreImpl
}
