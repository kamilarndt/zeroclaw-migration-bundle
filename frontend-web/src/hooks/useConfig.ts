import { useState, useCallback, useEffect } from 'react'
import { ConfigData, APIResponse } from '@types'

interface UseConfigReturn {
  config: ConfigData | null
  loading: boolean
  error: Error | null
  updateConfig: (updates: Partial<ConfigData>) => Promise<ConfigData>
  refresh: () => Promise<void>
}

const DEFAULT_CONFIG: ConfigData = {
  network: {
    enabled: true,
    whitelist: []
  },
  api: {
    provider: 'anthropic',
    maxTokens: 4096
  },
  limits: {
    maxIterations: 10,
    timeout: 300
  },
  providers: {
    openai: true,
    anthropic: true,
    ollama: false
  }
}

export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/config', {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('zeroclaw_token'),
          'Content-Type': 'application/json'
        }
      })
      const data: APIResponse<ConfigData> = await response.json()

      if (data.success && data.data) {
        setConfig(data.data)
      } else {
        throw new Error(data.error || 'Failed to fetch config')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch config')
      setError(error)
      // Use default config on error
      setConfig(DEFAULT_CONFIG)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateConfig = useCallback(async (updates: Partial<ConfigData>): Promise<ConfigData> => {
    setLoading(true)
    setError(null)

    try {
      const mergedConfig = { ...config!, ...updates }
      const response = await fetch('/api/v1/config', {
        method: 'PUT',
        headers: { 
          'Authorization': 'Bearer ' + localStorage.getItem('zeroclaw_token'),
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(mergedConfig)
      })

      const data: APIResponse<ConfigData> = await response.json()

      if (data.success && data.data) {
        setConfig(data.data)
        return data.data
      } else {
        throw new Error(data.error || 'Failed to update config')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update config')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [config])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    config,
    loading,
    error,
    updateConfig,
    refresh
  }
}
