import { useState, useEffect, useCallback } from 'react'
import { MetricsData } from '@types'
import { useWebSocket } from '@contexts/WebSocketContext'

interface UseMetricsReturn {
  metrics: MetricsData | null
  history: MetricsData[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

const MAX_HISTORY_SIZE = 60 // Keep last 60 data points

export function useMetrics(): UseMetricsReturn {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [history, setHistory] = useState<MetricsData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const { connected, lastMessage } = useWebSocket()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/metrics', {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('zeroclaw_token'),
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      if (data.success) {
        setMetrics(data.data)
        setHistory(prev => {
          const newHistory = [...prev, data.data]
          return newHistory.slice(-MAX_HISTORY_SIZE)
        })
      } else {
        throw new Error(data.error || 'Failed to fetch metrics')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch metrics')
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Listen for WebSocket metrics updates
  useEffect(() => {
    if (lastMessage?.type === 'metrics') {
      const metricsData = lastMessage.payload as MetricsData
      setMetrics(metricsData)
      setHistory(prev => {
        const newHistory = [...prev, metricsData]
        return newHistory.slice(-MAX_HISTORY_SIZE)
      })
      setLoading(false)
    }
  }, [lastMessage])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-refresh every 5 seconds if WebSocket is not connected
  useEffect(() => {
    if (connected) return

    const interval = setInterval(() => {
      refresh()
    }, 5000)

    return () => clearInterval(interval)
  }, [connected, refresh])

  return {
    metrics,
    history,
    loading,
    error,
    refresh
  }
}
