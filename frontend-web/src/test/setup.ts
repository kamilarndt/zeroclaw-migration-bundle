// web/src/test/setup.ts
import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

// Mock localStorage with full implementation
const localStorageMock: Storage = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    }
  }
})()

// Override localStorage on global scope
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

// Mock sessionStorage as well
const sessionStorageMock: Storage = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    }
  }
})()

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true,
})

// Mock fetch with better implementation
const mockFetch = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
  // Mock authentication
  if (typeof url === 'string' && url.includes('/api/auth')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        token: 'mock-test-token-123',
        user: { id: 'test-user-1', email: 'test@example.com' }
      })
    } as Response
  }

  // Mock tasks API
  if (typeof url === 'string' && url.includes('/api/tasks')) {
    const mockTasks = [
      {
        id: '1',
        title: 'Test Task 1',
        description: 'Test description',
        status: 'todo',
        priority: 'high',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        title: 'Test Task 2',
        description: 'Another test task',
        status: 'in-progress',
        priority: 'medium',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }
    ]

    // Handle POST (create task)
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body as string)
      const newTask = { ...body, id: '3', created_at: new Date().toISOString() }
      return {
        ok: true,
        status: 201,
        json: async () => newTask
      } as Response
    }

    // Handle PUT (update task)
    if (options?.method === 'PUT') {
      const body = JSON.parse(options.body as string)
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...mockTasks[0], ...body })
      } as Response
    }

    // Handle DELETE
    if (options?.method === 'DELETE') {
      return {
        ok: true,
        status: 204,
        json: async () => ({})
      } as Response
    }

    // Default GET
    return {
      ok: true,
      status: 200,
      json: async () => ({ tasks: mockTasks, total: mockTasks.length })
    } as Response
  }

  // Mock WebSocket health check
  if (typeof url === 'string' && url.includes('/api/health')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'healthy' })
    } as Response
  }

  // Default mock response
  return {
    ok: true,
    status: 200,
    json: async () => ({})
  } as Response
})

global.fetch = mockFetch as any

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() { return [] }
  unobserve() {}
} as any

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any

// Clear mocks before each test
beforeEach(() => {
  localStorageMock.clear()
  sessionStorageMock.clear()
  vi.clearAllMocks()
})

// Suppress console errors in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress certain React warnings
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Warning: Each child in a list'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
