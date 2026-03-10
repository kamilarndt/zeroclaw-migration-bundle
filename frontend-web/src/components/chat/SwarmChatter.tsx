import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from '@contexts/WebSocketContext'
import { A2APacket, A2AMessageType } from '@types'
import { formatDistanceToNow } from 'date-fns'
import { X, Search } from 'lucide-react'

interface SwarmChatterProps {
  onClose: () => void
}

const MESSAGE_TYPE_COLORS: Record<A2AMessageType, string> = {
  TaskAssignment: 'text-blue-400 bg-blue-500/20 border border-blue-500/20',
  TaskProgress: 'text-amber-400 bg-amber-500/20 border border-amber-500/20',
  TaskCompletion: 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/20',
  ClarificationRequest: 'text-violet-400 bg-violet-500/20 border border-violet-500/20'
}

const MESSAGE_TYPE_ICONS: Record<A2AMessageType, string> = {
  TaskAssignment: '📋',
  TaskProgress: '⚙️',
  TaskCompletion: '✅',
  ClarificationRequest: '❓'
}

export function SwarmChatter({ onClose }: SwarmChatterProps) {
  const [messages, setMessages] = useState<A2APacket[]>([])
  const [filter, setFilter] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { lastMessage } = useWebSocket()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'a2a_stream') return

    const packet = lastMessage.payload as A2APacket
    setMessages(prev => [...prev.slice(-99), packet])
  }, [lastMessage])

  const filteredMessages = filter
    ? messages.filter(m =>
        m.from.toLowerCase().includes(filter.toLowerCase()) ||
        m.to.toLowerCase().includes(filter.toLowerCase())
      )
    : messages

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h3 className="font-semibold text-sm text-neutral-200">Swarm Chatter</h3>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-950">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Filter by agent..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:border-indigo-500 text-neutral-200 placeholder:text-neutral-600"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-neutral-500 text-sm py-8">
            No A2A messages yet
          </div>
        ) : (
          filteredMessages.map((msg, index) => (
            <div
              key={`${msg.from}-${msg.to}-${msg.timestamp}-${index}`}
              className="p-3 bg-neutral-900 rounded-xl border border-neutral-800"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{MESSAGE_TYPE_ICONS[msg.messageType]}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${MESSAGE_TYPE_COLORS[msg.messageType]}`}>
                  {msg.messageType}
                </span>
              </div>

              <div className="text-xs text-neutral-400 mb-1">
                <span className="font-medium text-blue-400">{msg.from}</span>
                <span className="mx-1 text-neutral-600">→</span>
                <span className="font-medium text-violet-400">{msg.to}</span>
              </div>

              <div className="text-sm text-neutral-300">
                {typeof msg.content === 'string' ? (
                  msg.content
                ) : (
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(msg.content, null, 2)}
                  </pre>
                )}
              </div>

              <div className="text-xs text-neutral-500 mt-2">
                {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-neutral-800 bg-neutral-950">
        <div className="text-xs text-neutral-500">
          {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
