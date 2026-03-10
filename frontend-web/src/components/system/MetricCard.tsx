import { useMemo, useId } from 'react'

interface MetricCardProps {
  title: string
  value: number
  unit: string
  history: number[]
  color: 'blue' | 'emerald' | 'amber' | 'red'
  loading?: boolean
  format?: 'number' | 'currency' | 'percent'
}

const COLOR_CLASSES = {
  blue: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    stroke: 'stroke-blue-500'
  },
  emerald: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    stroke: 'stroke-emerald-500'
  },
  amber: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    stroke: 'stroke-amber-500'
  },
  red: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    stroke: 'stroke-red-500'
  }
}

export function MetricCard({ title, value, unit, history, color, loading, format = 'number' }: MetricCardProps) {
  const classes = COLOR_CLASSES[color]

  const formattedValue = useMemo(() => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: unit
      }).format(value)
    }
    return `${value.toFixed(2)}${unit === '%' ? '' : ' '}${unit}`
  }, [value, unit, format])

  const sparklinePath = useMemo(() => {
    if (history.length < 2) return ''

    const width = 200
    const height = 40
    const padding = 2

    const min = Math.min(...history)
    const max = Math.max(...history)
    const range = max - min || 1

    const points = history.map((val, i) => {
      const x = (i / (history.length - 1)) * (width - 2 * padding) + padding
      const y = height - padding - ((val - min) / range) * (height - 2 * padding)
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }, [history])

  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-400 mb-2">{title}</h3>

      {loading ? (
        <div className="h-16 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-2xl font-bold ${classes.text}`}>{formattedValue}</span>
          </div>

          {history.length > 1 && (
            <svg width="100%" height="40" className="overflow-visible">
              <path
                d={sparklinePath}
                fill="none"
                className={classes.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </>
      )}
    </div>
  )
}
