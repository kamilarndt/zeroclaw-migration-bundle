// web/src/hooks/__tests__/useNetworkStatus.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useNetworkStatus } from '../useNetworkStatus'

describe('useNetworkStatus', () => {
  const originalNavigatorOnline = navigator.onLine
  const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
  const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalNavigatorOnline,
    })
    addEventListenerSpy.mockClear()
    removeEventListenerSpy.mockClear()
  })

  it('should return initial online status from navigator', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOnline).toBe(true)
  })

  it('should return offline status initially when navigator is offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOnline).toBe(false)
  })

  it('should update status when going online', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOnline).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isOnline).toBe(true)
    expect(result.current.lastChanged).toBeInstanceOf(Date)
  })

  it('should update status when going offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOnline).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOnline).toBe(false)
    expect(result.current.lastChanged).toBeInstanceOf(Date)
  })

  it('should add event listeners on mount', () => {
    renderHook(() => useNetworkStatus())

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('should remove event listeners on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('should provide saveData from network connection if available', () => {
    const mockConnection = {
      effectiveType: '4g',
      saveData: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    Object.defineProperty(navigator, 'connection', {
      writable: true,
      value: mockConnection,
    })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.saveData).toBe(false)
  })

  it('should provide effectiveType from network connection if available', () => {
    const mockConnection = {
      effectiveType: '3g',
      saveData: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    Object.defineProperty(navigator, 'connection', {
      writable: true,
      value: mockConnection,
    })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.effectiveType).toBe('3g')
  })

  it('should handle missing navigator connection gracefully', () => {
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      value: undefined,
    })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.effectiveType).toBeUndefined()
    expect(result.current.saveData).toBe(false)
  })
})
