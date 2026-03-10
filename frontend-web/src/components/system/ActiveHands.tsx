import { useState, useEffect } from 'react'
import { useWebSocket } from '@contexts/WebSocketContext'
import { ActiveHand } from '@types'
import { formatDistanceToNow } from 'date-fns'

export function ActiveHands() {
  const [hands, setHands] = useState<ActiveHand[]>([])
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set())
  const { lastMessage } = useWebSocket()

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'hand_status') return

    const hand = lastMessage.payload as ActiveHand

    setHands(prev => {
      const existing = prev.findIndex(h => h.id === hand.id)
      if (existing >= 0) {
        if (hand.status === 'stopping') {
          return prev.filter(h => h.id !== hand.id)
        }
        const updated = [...prev]
        updated[existing] = hand
        return updated
      }
      return [...prev, hand]
    })
  }, [lastMessage])

  const handleStopHand = async (handId: string) => {
    setStoppingIds(prev => new Set(prev).add(handId))

    try {
      const response = await fetch(`/v1/agent/${handId}/interrupt`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to stop hand')
      }
    } catch (err) {
      console.error('Failed to stop hand:', err)
      setStoppingIds(prev => {
        const next = new Set(prev)
        next.delete(handId)
        return next
      })
    }
  }

  if (hands.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-slate-500">No active hands</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {hands.map(hand => (
        <div key={hand.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-slate-200">{hand.id}</h3>
              <p className="text-sm text-slate-400 mt-1">{hand.task}</p>
            </div>

            <button
              onClick={() => handleStopHand(hand.id)}
              disabled={stoppingIds.has(hand.id) || hand.status === 'stopping'}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${stoppingIds.has(hand.id) || hand.status === 'stopping'
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
                }
              `}
            >
              {stoppingIds.has(hand.id) || hand.status === 'stopping' ? 'Stopping...' : 'STOP'}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Progress</span>
              <span className="text-slate-200">{hand.progress.toFixed(0)}%</span>
            </div>

            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${hand.progress}%` }}
              />
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Started {formatDistanceToNow(new Date(hand.startTime), { addSuffix: true })}
          </div>
        </div>
      ))}
    </div>
  )
}
