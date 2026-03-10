import { ActiveHands } from '@components/system/ActiveHands'
import { useMetrics } from '@hooks/useMetrics'

export function Hands() {
  const { metrics } = useMetrics()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800">
        <h1 className="text-lg font-semibold">Active Hands</h1>
        {metrics && (
          <div className="text-sm text-neutral-400">
            {metrics.cpu.percent.toFixed(1)}% CPU • {metrics.ram.percent.toFixed(1)}% RAM
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <ActiveHands />
      </div>
    </div>
  )
}
