// web/src/stores/__tests__/taskStore.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useTaskStore } from '../taskStore'
import { TaskStatus, TaskPriority } from '@types'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('taskStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTaskStore.setState({
      tasks: [],
      filter: {},
      searchQuery: '',
      loading: false,
      error: null,
    })
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchTasks', () => {
    it('should fetch tasks successfully', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'todo' as TaskStatus, description: '', priority: 'medium' as TaskPriority, createdAt: Date.now(), updatedAt: Date.now() },
        { id: '2', title: 'Task 2', status: 'done' as TaskStatus, description: '', priority: 'medium' as TaskPriority, createdAt: Date.now(), updatedAt: Date.now() },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTasks }),
      })

      const { result } = renderHook(() => useTaskStore())

      await act(async () => {
        await result.current.fetchTasks()
      })

      expect(result.current.tasks).toEqual(mockTasks)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useTaskStore())

      await act(async () => {
        await result.current.fetchTasks()
      })

      expect(result.current.tasks).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Network error')
    })

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Unauthorized' }),
      })

      const { result } = renderHook(() => useTaskStore())

      await act(async () => {
        await result.current.fetchTasks()
      })

      expect(result.current.error?.message).toBe('Unauthorized')
    })
  })

  describe('createTask', () => {
    it('should create task successfully', async () => {
      const newTask = { id: '1', title: 'New Task', status: 'todo' as TaskStatus, description: 'Description', createdAt: Date.now() }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: newTask }),
      })

      const { result } = renderHook(() => useTaskStore())

      await act(async () => {
        const created = await result.current.createTask({
          title: 'New Task',
          description: 'Description',
          status: 'todo',
        })
        expect(created).toEqual(newTask)
      })

      expect(result.current.tasks).toContainEqual(newTask)
    })

    it('should handle create task errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to create'))

      const { result } = renderHook(() => useTaskStore())

      await expect(async () => {
        await act(async () => {
          await result.current.createTask({
            title: 'New Task',
          })
        })
      }).rejects.toThrow('Failed to create')
    })
  })

  describe('updateTask', () => {
    it('should update task with optimistic update', async () => {
      const initialTasks = [
        { 
          id: '1', 
          title: 'Task 1', 
          status: 'todo' as TaskStatus, 
          description: '', 
          priority: 'medium' as TaskPriority,
          createdAt: Date.now(),
          updatedAt: Date.now() 
        },
      ]

      const updatedTask = {
        ...initialTasks[0],
        title: 'Updated Task',
        status: 'in_progress' as TaskStatus,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedTask }),
      })

      const { result } = renderHook(() => useTaskStore())

      act(() => {
        result.current.tasks = initialTasks
      })

      // Optimistic update should happen immediately
      act(() => {
        result.current.updateTask('1', { title: 'Updated Task', status: 'in_progress' })
      })

      expect(result.current.tasks[0].title).toBe('Updated Task')

      // Wait for actual update
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(result.current.tasks[0]).toEqual(updatedTask)
    })

    it('should rollback on update error', async () => {
      const initialTasks = [
        { 
          id: '1', 
          title: 'Task 1', 
          status: 'todo' as TaskStatus, 
          description: '', 
          priority: 'medium' as TaskPriority,
          createdAt: Date.now(),
          updatedAt: Date.now() 
        },
      ]

      mockFetch.mockRejectedValueOnce(new Error('Update failed'))

      const { result } = renderHook(() => useTaskStore())

      act(() => {
        result.current.tasks = initialTasks
      })

      await expect(async () => {
        await act(async () => {
          await result.current.updateTask('1', { title: 'Updated Task' })
        })
      }).rejects.toThrow('Update failed')

      // Should rollback to original state
      expect(result.current.tasks[0].title).toBe('Task 1')
    })
  })

  describe('deleteTask', () => {
    it('should delete task with optimistic update', async () => {
      const initialTasks = [
        { 
          id: '1', 
          title: 'Task 1', 
          status: 'todo' as TaskStatus, 
          description: '', 
          priority: 'medium' as TaskPriority,
          createdAt: Date.now(),
          updatedAt: Date.now() 
        },
        { 
          id: '2', 
          title: 'Task 2', 
          status: 'todo' as TaskStatus, 
          description: '', 
          priority: 'medium' as TaskPriority,
          createdAt: Date.now(),
          updatedAt: Date.now() 
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const { result } = renderHook(() => useTaskStore())

      act(() => {
        result.current.tasks = initialTasks
      })

      await act(async () => {
        await result.current.deleteTask('1')
      })

      expect(result.current.tasks.length).toBe(1)
      expect(result.current.tasks[0].id).toBe('2')
    })

    it('should rollback on delete error', async () => {
      const initialTasks = [
        { 
          id: '1', 
          title: 'Task 1', 
          status: 'todo' as TaskStatus, 
          description: '', 
          priority: 'medium' as TaskPriority,
          createdAt: Date.now(),
          updatedAt: Date.now() 
        },
        { 
          id: '2', 
          title: 'Task 2', 
          status: 'todo' as TaskStatus, 
          description: '', 
          priority: 'medium' as TaskPriority,
          createdAt: Date.now(),
          updatedAt: Date.now() 
        },
      ]

      mockFetch.mockRejectedValueOnce(new Error('Delete failed'))

      const { result } = renderHook(() => useTaskStore())

      act(() => {
        result.current.tasks = initialTasks
      })

      await expect(async () => {
        await act(async () => {
          await result.current.deleteTask('1')
        })
      }).rejects.toThrow('Delete failed')

      // Should rollback to original state
      expect(result.current.tasks.length).toBe(2)
      expect(result.current.tasks[0].id).toBe('1')
    })
  })

  describe('moveTask', () => {
    it('should move task to new status', async () => {
      const initialTasks = [
        { id: '1', title: 'Task 1', status: 'todo' as TaskStatus, description: '', priority: 'medium' as TaskPriority, createdAt: Date.now(), updatedAt: Date.now() },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { ...initialTasks[0], status: 'in_progress' },
        }),
      })

      const { result } = renderHook(() => useTaskStore())

      act(() => {
        result.current.tasks = initialTasks
      })

      await act(async () => {
        await result.current.moveTask('1', 'in_progress')
      })

      expect(result.current.tasks[0].status).toBe('in_progress')
    })
  })

  describe('filtering', () => {
    it('should set filter', () => {
      const { result } = renderHook(() => useTaskStore())

      act(() => {
        result.current.setFilter({ status: 'todo' })
      })

      expect(result.current.filter).toEqual({ status: 'todo' })
    })

    it('should set search query', () => {
      const { result } = renderHook(() => useTaskStore())

      act(() => {
        result.current.setSearchQuery('test query')
      })

      expect(result.current.searchQuery).toBe('test query')
    })

    it('should clear error', () => {
      const { result } = renderHook(() => useTaskStore())

      act(() => {
        result.current.error = new Error('Test error')
      })

      expect(result.current.error).toBeInstanceOf(Error)

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)
    })
  })
})
