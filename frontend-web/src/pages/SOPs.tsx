import { useState, useEffect } from 'react'
import { SOP } from '@types'

export function SOPs() {
  const [sops, setSops] = useState<SOP[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSop, setSelectedSop] = useState<SOP | null>(null)
  const [editingYaml, setEditingYaml] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSOPs()
  }, [])

  const fetchSOPs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/v1/sops')
      const data = await response.json()
      if (data.success) {
        setSops(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch SOPs:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSop = () => {
    const newSop: SOP = {
      id: 'new',
      name: 'New Procedure',
      yaml: `name: New Procedure\ndescription: |\n  Add description here\nsteps:\n  - tool: example\n    params:\n      key: value`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setSelectedSop(newSop)
    setEditingYaml(newSop.yaml)
  }

  const handleSaveSop = async () => {
    if (!selectedSop) return

    setSaving(true)
    try {
      const response = await fetch(`/v1/sops${selectedSop.id !== 'new' ? '/' + selectedSop.id : ''}`, {
        method: selectedSop.id === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedSop.name,
          yaml: editingYaml
        })
      })

      const data = await response.json()
      if (data.success) {
        await fetchSOPs()
        setSelectedSop(null)
        setEditingYaml('')
      }
    } catch (err) {
      console.error('Failed to save SOP:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSop = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SOP?')) return

    try {
      const response = await fetch(`/v1/sops/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        setSops(prev => prev.filter(s => s.id !== id))
        if (selectedSop?.id === id) {
          setSelectedSop(null)
          setEditingYaml('')
        }
      }
    } catch (err) {
      console.error('Failed to delete SOP:', err)
    }
  }

  const handleRunSop = async (id: string) => {
    try {
      const response = await fetch(`/v1/sops/${id}/run`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        alert(`SOP execution started: ${data.data.executionId}`)
      }
    } catch (err) {
      console.error('Failed to run SOP:', err)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800">
        <h1 className="text-lg font-semibold">SOPs</h1>
        <button
          onClick={handleCreateSop}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
        >
          + New SOP
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* SOP List */}
        <div className={`
          border-r border-neutral-800 overflow-y-auto
          ${selectedSop ? 'w-64 hidden md:block' : 'w-full md:w-80'}
        `}>
          {loading ? (
            <div className="p-4 text-center text-neutral-500">Loading...</div>
          ) : sops.length === 0 ? (
            <div className="p-4 text-center text-neutral-500">
              No SOPs found. Create one to get started.
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {sops.map(sop => (
                <div
                  key={sop.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedSop?.id === sop.id ? 'bg-neutral-900' : 'hover:bg-neutral-900/50'
                  }`}
                  onClick={() => {
                    setSelectedSop(sop)
                    setEditingYaml(sop.yaml)
                  }}
                >
                  <h3 className="font-medium text-neutral-200">{sop.name}</h3>
                  {sop.description && (
                    <p className="text-sm text-neutral-400 mt-1 line-clamp-2">{sop.description}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRunSop(sop.id)
                      }}
                      className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
                    >
                      Run
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSop(sop.id)
                      }}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        {selectedSop && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <input
                type="text"
                value={selectedSop.name}
                onChange={(e) => setSelectedSop({ ...selectedSop, name: e.target.value })}
                className="bg-transparent text-lg font-semibold text-neutral-200 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSop(null)}
                  className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSop}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* YAML Editor */}
            <div className="flex-1 p-4 overflow-hidden">
              <textarea
                value={editingYaml}
                onChange={(e) => setEditingYaml(e.target.value)}
                spellCheck={false}
                className="w-full h-full font-mono text-sm bg-neutral-950 border border-neutral-700 rounded-lg p-4 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="# Enter YAML here..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
