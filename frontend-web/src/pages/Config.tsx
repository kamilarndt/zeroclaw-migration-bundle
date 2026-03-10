import { useState } from 'react'
import { useConfig } from '@hooks/useConfig'
import { validateWhitelist, validateNumber } from '@utils/validation'

export function Config() {
  const { config, loading, error, updateConfig } = useConfig()
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const clearValidationError = (field: string) => {
    setValidationErrors(prev => {
      const copy = { ...prev }
      delete copy[field]
      return copy
    })
  }

  const handleUpdate = async (section: keyof typeof config, updates: any) => {
    if (!config) return

    // Validate updates based on field
    if (section === 'network' && updates.whitelist !== undefined) {
      const validation = validateWhitelist(updates.whitelist.join(', '))

      if (!validation.valid) {
        setValidationErrors(prev => ({
          ...prev,
          whitelist: validation.error!
        }))
        return
      }

      clearValidationError('whitelist')
    }

    if (section === 'api' && updates.maxTokens !== undefined) {
      const validation = validateNumber(updates.maxTokens.toString(), 1, 200000)

      if (!validation.valid) {
        setValidationErrors(prev => ({
          ...prev,
          maxTokens: validation.error!
        }))
        return
      }

      clearValidationError('maxTokens')
    }

    if (section === 'limits' && updates.maxIterations !== undefined) {
      const validation = validateNumber(updates.maxIterations.toString(), 1, 100)

      if (!validation.valid) {
        setValidationErrors(prev => ({
          ...prev,
          maxIterations: validation.error!
        }))
        return
      }

      clearValidationError('maxIterations')
    }

    if (section === 'limits' && updates.timeout !== undefined) {
      const validation = validateNumber(updates.timeout.toString(), 1, 3600)

      if (!validation.valid) {
        setValidationErrors(prev => ({
          ...prev,
          timeout: validation.error!
        }))
        return
      }

      clearValidationError('timeout')
    }

    setSaving(true)
    setSaveSuccess(false)

    try {
      await updateConfig({
        ...config,
        [section]: {
          ...config[section],
          ...updates
        }
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      console.error('Failed to update config:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500">Loading configuration...</div>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-400">
          {error?.message || 'Failed to load configuration'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800">
        <h1 className="text-lg font-semibold">Configuration</h1>
        {saveSuccess && (
          <span className="px-3 py-1 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg">
            Saved successfully
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Network Section */}
        <section className="bg-neutral-800/50 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Network</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-neutral-200">Enable Network Access</div>
                <div className="text-sm text-neutral-400">Allow agents to access external network</div>
              </div>
              <button
                onClick={() => handleUpdate('network', { enabled: !config.network.enabled })}
                className={`
                  relative w-12 h-6 rounded-full transition-colors
                  ${config.network.enabled ? 'bg-indigo-600' : 'bg-neutral-700'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                    ${config.network.enabled ? 'translate-x-7' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Whitelist Domains (comma-separated)
              </label>
              <input
                type="text"
                value={config.network.whitelist.join(', ')}
                onChange={(e) => {
                  const validation = validateWhitelist(e.target.value)

                  if (!validation.valid) {
                    setValidationErrors(prev => ({
                      ...prev,
                      whitelist: validation.error!
                    }))
                  } else {
                    clearValidationError('whitelist')
                    handleUpdate('network', {
                      whitelist: validation.domains
                    })
                  }
                }}
                placeholder="api.example.com, cdn.example.com"
                className={`
                  w-full px-3 py-2 bg-neutral-900 border rounded-lg focus:outline-none
                  ${validationErrors.whitelist
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-neutral-700 focus:border-indigo-500'
                  }
                `}
              />
              {validationErrors.whitelist && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.whitelist}</p>
              )}
            </div>
          </div>
        </section>

        {/* API Section */}
        <section className="bg-neutral-800/50 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">API Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Provider
              </label>
              <select
                value={config.api.provider}
                onChange={(e) => handleUpdate('api', { provider: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-indigo-500"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                min="1"
                max="200000"
                value={config.api.maxTokens}
                onChange={(e) => {
                  const validation = validateNumber(e.target.value, 1, 200000)

                  if (!validation.valid) {
                    setValidationErrors(prev => ({
                      ...prev,
                      maxTokens: validation.error!
                    }))
                  } else {
                    clearValidationError('maxTokens')
                    handleUpdate('api', { maxTokens: validation.value })
                  }
                }}
                className={`
                  w-full px-3 py-2 bg-neutral-900 border rounded-lg focus:outline-none
                  ${validationErrors.maxTokens
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-neutral-700 focus:border-indigo-500'
                  }
                `}
              />
              {validationErrors.maxTokens && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.maxTokens}</p>
              )}
            </div>
          </div>
        </section>

        {/* Limits Section */}
        <section className="bg-neutral-800/50 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Limits</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Max Iterations per Task
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.limits.maxIterations}
                onChange={(e) => {
                  const validation = validateNumber(e.target.value, 1, 100)

                  if (!validation.valid) {
                    setValidationErrors(prev => ({
                      ...prev,
                      maxIterations: validation.error!
                    }))
                  } else {
                    clearValidationError('maxIterations')
                    handleUpdate('limits', { maxIterations: validation.value })
                  }
                }}
                className={`
                  w-full px-3 py-2 bg-neutral-900 border rounded-lg focus:outline-none
                  ${validationErrors.maxIterations
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-neutral-700 focus:border-indigo-500'
                  }
                `}
              />
              {validationErrors.maxIterations && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.maxIterations}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Task Timeout (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="3600"
                value={config.limits.timeout}
                onChange={(e) => {
                  const validation = validateNumber(e.target.value, 1, 3600)

                  if (!validation.valid) {
                    setValidationErrors(prev => ({
                      ...prev,
                      timeout: validation.error!
                    }))
                  } else {
                    clearValidationError('timeout')
                    handleUpdate('limits', { timeout: validation.value })
                  }
                }}
                className={`
                  w-full px-3 py-2 bg-neutral-900 border rounded-lg focus:outline-none
                  ${validationErrors.timeout
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-neutral-700 focus:border-indigo-500'
                  }
                `}
              />
              {validationErrors.timeout && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.timeout}</p>
              )}
            </div>
          </div>
        </section>

        {/* Providers Section */}
        <section className="bg-neutral-800/50 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Active Providers</h2>

          <div className="space-y-3">
            {Object.entries(config.providers).map(([provider, enabled]) => (
              <div key={provider} className="flex items-center justify-between py-2">
                <span className="capitalize text-neutral-200">{provider}</span>
                <button
                  onClick={() => handleUpdate('providers', {
                    ...config.providers,
                    [provider]: !enabled
                  })}
                  disabled={saving}
                  className={`
                    relative w-12 h-6 rounded-full transition-colors
                    ${enabled ? 'bg-indigo-600' : 'bg-neutral-700'}
                  `}
                >
                  <span
                    className={`
                      absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                      ${enabled ? 'translate-x-7' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
