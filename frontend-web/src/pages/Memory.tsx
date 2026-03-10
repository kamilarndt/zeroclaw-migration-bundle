import { Database, Search } from 'lucide-react'

export function Memory() {
  return (
    <div className="flex flex-col h-full">
      {/* Ambient glow */}
      <div className="ambient-glow" />

      {/* Header */}
      <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 relative z-10">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-neutral-400" />
          <h1 className="text-lg font-semibold text-neutral-100">Pamięć Wektorowa</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 relative z-10">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
          <Database className="w-16 h-16 mx-auto mb-4 text-neutral-700" />
          <h2 className="text-xl font-semibold text-neutral-300 mb-2">Eksplorator Qdrant</h2>
          <p className="text-neutral-500 mb-6">
            Wizualizacja pamięci wektorowej - w implementacji
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg text-neutral-400 text-sm">
            <Search className="w-4 h-4" />
            Coming soon
          </div>
        </div>
      </div>
    </div>
  )
}
