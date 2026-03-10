// web/src/components/__tests__/ErrorBoundary.test.tsx
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'

// Component that throws an error
function ThrowError(): never {
  throw new Error('Test error')
}

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test Child</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Test Child')).toBeInTheDocument()
  })

  it('should catch and display error when child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/Test error/)).toBeInTheDocument()
    expect(screen.getByText('Reload Page')).toBeInTheDocument()

    consoleError.mockRestore()
  })

  it('should render custom fallback when provided', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary fallback={<div>Custom Error</div>}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom Error')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()

    consoleError.mockRestore()
  })

  it('should reload page when reload button is clicked', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reloadSpy = vi.fn()
    // Mock window.location.reload using Object.defineProperty
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
      configurable: true,
    })

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    const reloadButton = screen.getByText('Reload Page')
    act(() => {
      reloadButton.click()
    })

    expect(reloadSpy).toHaveBeenCalled()

    consoleError.mockRestore()
    reloadSpy.mockRestore()
  })

  it('should reset error state when re-mounted', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(
      <ErrorBoundary>
        <div>Test Child</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Test Child')).toBeInTheDocument()

    rerender(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    rerender(
      <ErrorBoundary>
        <div>Test Child 2</div>
      </ErrorBoundary>
    )

    // ErrorBoundary should still be in error state
    expect(screen.queryByText('Test Child 2')).not.toBeInTheDocument()

    consoleError.mockRestore()
  })
})

describe('ErrorFallback', () => {
  it('should render error message', async () => {
    const { ErrorFallback } = await import('../ErrorBoundary')

    render(<ErrorFallback message="Test error message" />)

    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('should render default message when not provided', async () => {
    const { ErrorFallback } = await import('../ErrorBoundary')

    render(<ErrorFallback />)

    expect(screen.getByText('An error occurred')).toBeInTheDocument()
  })
})
