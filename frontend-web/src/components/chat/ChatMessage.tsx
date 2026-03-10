import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatMessage as ChatMessageType } from '@types'
import { formatDistanceToNow } from 'date-fns'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="px-3 py-1 text-xs bg-neutral-900 text-neutral-400 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Message Bubble */}
        <div
          className={`
            rounded-lg px-4 py-2
            ${isUser
              ? 'bg-indigo-600 text-white rounded-br-none'
              : 'bg-neutral-900 text-neutral-100 rounded-bl-none'
            }
          `}
        >
          {!isUser && (
            <div className="text-xs text-blue-400 font-medium mb-1">ZeroClaw</div>
          )}

          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map(attachment => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 px-2 py-1 bg-black/20 rounded text-xs"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {attachment.name}
                </div>
              ))}
            </div>
          )}

          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              code: ({ className, children }: any) => {
                const match = /language-(\w+)/.exec(className || '')
                const isInline = !match && !className
                if (isInline) {
                  return <code className="px-1 py-0.5 bg-black/20 rounded text-sm">{children}</code>
                }
                return (
                  <code className={className}>
                    {children}
                  </code>
                )
              },
              pre: ({ children }) => (
                <pre className="overflow-x-auto p-3 bg-black/40 rounded-lg text-sm">
                  {children}
                </pre>
              )
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-neutral-500 px-1">
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}
