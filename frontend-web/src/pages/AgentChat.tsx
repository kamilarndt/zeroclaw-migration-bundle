import { useState, useRef, useEffect, useCallback } from 'react'
import { useWebSocket } from '../contexts/WebSocketContext'
import { ChatMessage as ChatMessageType } from '@types'
import { ChatInput } from '../components/chat/ChatInput'
import { ChatMessage } from '../components/chat/ChatMessage'
import { SwarmChatter } from '../components/chat/SwarmChatter'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, useDroppable } from '@dnd-kit/core'
import { Plus, GripVertical, X } from 'lucide-react'

interface Agent {
  id: string
  name: string
  description: string
  role: string
}

interface TaskSuggestion {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

const AVAILABLE_AGENTS: Agent[] = [
  { id: 'coder', name: 'Coder', description: 'Code generation and modification', role: 'Developer' },
  { id: 'researcher', name: 'Researcher', description: 'Information gathering and analysis', role: 'Analyst' },
  { id: 'tester', name: 'Tester', description: 'Test creation and execution', role: 'QA' },
  { id: 'planner', name: 'Planner', description: 'Project planning and task breakdown', role: 'Manager' },
]

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am ZeroClaw, your AI assistant. How can I help you today?',
      timestamp: Date.now()
    }
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSwarmChatter, setShowSwarmChatter] = useState(false)
  const [activeAgents, setActiveAgents] = useState<Agent[]>([])
  const [taskSuggestions, setTaskSuggestions] = useState<TaskSuggestion[]>([])
  const [showAddAgentModal, setShowAddAgentModal] = useState(false)
  const [isFallbackMode, setIsFallbackMode] = useState(false)
  const [draggingAgent, setDraggingAgent] = useState<Agent | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const objectUrlsRef = useRef<Set<string>>(new Set())

  /**
   * Revoke all tracked object URLs to prevent memory leaks
   */
  const revokeObjectUrls = useCallback((urls?: string[]) => {
    const urlsToRevoke = urls ?? Array.from(objectUrlsRef.current)
    urlsToRevoke.forEach(url => {
      URL.revokeObjectURL(url)
      objectUrlsRef.current.delete(url)
    })
  }, [])

  /**
   * Create and track an object URL for a file
   * Returns the URL that should be cleaned up later
   */
  const createTrackedObjectUrl = useCallback((file: File): string => {
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.add(url)
    return url
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokeObjectUrls()
    }
  }, [revokeObjectUrls])

  const { connected, connecting, send, lastMessage } = useWebSocket()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle incoming WebSocket messages from ZeroClaw backend
  useEffect(() => {
    if (!lastMessage) return

    // Handle errors (fallback routing)
    if (lastMessage.type === 'error') {
      const errorMsg = lastMessage?.payload?.error || lastMessage?.content || (lastMessage as any)?.message || 'Unknown error';
      
      // If it's NOT a 429 that we handle via fallback anyway, show it as a message
      if (!errorMsg.includes('429') && !errorMsg.toLowerCase().includes('too many requests')) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content: `⚠️ ERROR: ${errorMsg}`,
            timestamp: Date.now()
          }
        ])
        setIsStreaming(false)
      }

      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('too many requests')) {
        setIsFallbackMode(true)
        if (isStreaming) {
          setIsStreaming(false)
          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last && last.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...last, streaming: false, content: last.content + '\n\n_[Z.AI Rate Limit Reached. Switching to local Qwen2.5-Coder model...]_' }
              ]
            }
            return prev
          })
        }
        return
      }
    }

    // Handle streaming chunks from LLM
    if (lastMessage.type === 'chunk') {
      const content = lastMessage.content || ''

      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && last.streaming) {
          // Append to existing streaming message
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + content }
          ]
        }
        // Start new streaming message
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content,
            timestamp: Date.now(),
            streaming: true
          }
        ]
      })
    }

    // Handle tool calls (for Extraction Layer)
    if (lastMessage.type === 'tool_call') {
      const toolName = lastMessage.tool_name || 'unknown'
      const toolArgs = lastMessage.tool_args || {}

      console.log('Tool called:', toolName, toolArgs)

      // Extract task suggestions from tool calls
      // If the tool is creating tasks or similar, add to suggestions
      if (toolName === 'create_task' || toolName === 'suggest_tasks') {
        const newSuggestion: TaskSuggestion = {
          id: Date.now().toString(),
          title: toolArgs.title || 'Task from AI',
          description: toolArgs.description || 'Generated from conversation',
          priority: toolArgs.priority || 'medium'
        }
        setTaskSuggestions(prev => {
          // Avoid duplicates
          if (prev.find(s => s.title === newSuggestion.title)) return prev
          return [...prev, newSuggestion]
        })
      }
    }

    // Handle tool results (optional: display in UI)
    if (lastMessage.type === 'tool_result') {
      console.log('Tool result:', lastMessage.tool_name, lastMessage.tool_output)
    }

    // Handle message completion
    if (lastMessage.type === 'done') {
      const fullResponse = lastMessage.full_response || lastMessage.content || '';
      
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && last.streaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: fullResponse || last.content, streaming: false }
          ]
        }
        
        // If we didn't get chunks but got a full response, add it now
        if (fullResponse) {
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant' as const,
              content: fullResponse,
              timestamp: Date.now(),
              streaming: false
            }
          ]
        }
        
        return prev
      })
      setIsStreaming(false)
    }

    // Legacy support for chat_stream format
    if (lastMessage.type === 'chat_stream') {
      const payload = lastMessage.payload

      if (payload?.streaming) {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: payload.content }
            ]
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant' as const,
              content: payload.content,
              timestamp: Date.now(),
              streaming: true
            }
          ]
        })
      } else if (payload?.done) {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, streaming: false }
            ]
          }
          return prev
        })
        setIsStreaming(false)
      }
    }
  }, [lastMessage])

  const handleSendMessage = async (content: string, attachments?: File[], audioData?: ArrayBuffer) => {
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: attachments?.map(file => ({
        id: Date.now().toString() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        url: createTrackedObjectUrl(file)
      }))
    }

    setMessages(prev => [...prev, userMessage])
    setIsStreaming(true)

    // Send message to ZeroClaw backend using correct protocol
    // Protocol: {"type":"message","content":"Hello"}
    send({
      type: 'message',
      content: content,
      ...(isFallbackMode && { model: 'ollama/qwen2.5-coder' })
    })

    // Note: Task suggestions are now extracted from tool_call messages
    // from the real ZeroClaw backend, not from setTimeout mocks
  }

  const handleNewChat = () => {
    revokeObjectUrls()
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I am ZeroClaw, your AI assistant. How can I help you today?',
        timestamp: Date.now()
      }
    ])
    setIsStreaming(false)
    setTaskSuggestions([])
    setActiveAgents([])
  }

  const handleDragStart = (event: DragStartEvent) => {
    const agent = AVAILABLE_AGENTS.find(a => a.id === event.active.id)
    if (agent) {
      setDraggingAgent(agent)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setDraggingAgent(null)

    if (over && over.id === 'chat-zone') {
      const agent = AVAILABLE_AGENTS.find(a => a.id === active.id)
      if (agent && !activeAgents.find(a => a.id === agent.id)) {
        setActiveAgents(prev => [...prev, agent])
      }
    }
  }

  const removeAgent = (agentId: string) => {
    setActiveAgents(prev => prev.filter(a => a.id !== agentId))
  }

  const handleCreateTask = (suggestion: TaskSuggestion) => {
    // This would integrate with the task store to create the task
    console.log('Creating task:', suggestion)
    // Remove suggestion after "creating" task
    setTaskSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
  }

  // Set up droppable for chat zone
  const { setNodeRef: setChatZoneRef } = useDroppable({
    id: 'chat-zone',
  })

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <DragOverlay>
        {draggingAgent && (
          <div className="p-3 bg-neutral-800 rounded-lg border border-neutral-700 shadow-lg cursor-grabbing">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-neutral-400" />
              <div>
                <div className="font-semibold text-sm">{draggingAgent.name}</div>
                <div className="text-xs text-neutral-400">{draggingAgent.role}</div>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>

      <div className="flex flex-col h-full" data-testid="agent-chat-container">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800" data-testid="chat-header">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Agent Chat</h1>
            <div className="text-[10px] text-neutral-600 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5">
              Backend Status: {connected ? 'CONNECTED' : connecting ? 'CONNECTING' : 'DISCONNECTED'}
            </div>
            {!connected && (
              <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-500 rounded-full">
                Reconnecting...
              </span>
            )}
            {isFallbackMode && (
              <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full flex items-center gap-1" title="Z.AI rate limit reached. Using local model.">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                Local Fallback: Qwen2.5-Coder
              </span>
            )}
          </div>
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 text-sm bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
            data-testid="new-chat-button"
          >
            New Chat
          </button>
        </div>

        {/* Main 3-Panel Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Agents List */}
          <div className="w-72 border-r border-neutral-800 bg-neutral-900/30 flex flex-col" data-testid="agents-panel">
            <div className="p-4 border-b border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Available Agents</h2>
                <button
                  onClick={() => setShowAddAgentModal(true)}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors"
                  data-testid="add-agent-button"
                  title="Add Agent"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-neutral-500">Drag agents to the chat zone</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {AVAILABLE_AGENTS.map(agent => (
                <div
                  key={agent.id}
                  className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 cursor-grab hover:border-neutral-700 transition-colors"
                  data-testid={`agent-${agent.id}`}
                  data-agent-id={agent.id}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-neutral-500" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{agent.name}</div>
                      <div className="text-xs text-neutral-500">{agent.role}</div>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600 mt-1">{agent.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Center Panel: Chat Area */}
          <div
            ref={setChatZoneRef}
            className="flex-1 flex flex-col"
            data-testid="chat-zone"
            id="chat-zone"
          >
            {/* Active Agents Bar */}
            {activeAgents.length > 0 && (
              <div className="px-4 py-2 bg-neutral-900/50 border-b border-neutral-800 flex items-center gap-2 flex-wrap" data-testid="active-agents-bar">
                {activeAgents.map(agent => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 px-2 py-1 bg-neutral-800 rounded-lg text-sm"
                    data-testid={`active-agent-${agent.id}`}
                  >
                    <span className="font-medium">{agent.name}</span>
                    <button
                      onClick={() => removeAgent(agent.id)}
                      className="p-0.5 hover:bg-neutral-700 rounded transition-colors"
                      data-testid={`remove-agent-${agent.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="messages-container">
              {messages.map(message => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isStreaming && (
                <div className="flex items-center gap-2 text-neutral-500" data-testid="streaming-indicator">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput
              onSend={handleSendMessage}
              disabled={!connected || isStreaming}
            />
          </div>

          {/* Right Panel: Extraction Layer */}
          <div className="w-80 border-l border-neutral-800 bg-neutral-900/30 flex flex-col" data-testid="extraction-layer">
            <div className="p-4 border-b border-neutral-800">
              <h2 className="font-semibold text-sm">Task Suggestions</h2>
              <p className="text-xs text-neutral-500 mt-1">Extracted from conversation</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2" data-testid="task-suggestions">
              {taskSuggestions.length === 0 ? (
                <div className="text-center py-8 text-neutral-600" data-testid="empty-task-suggestions">
                  <p className="text-sm">Send a message to generate</p>
                  <p className="text-xs mt-1">task suggestions</p>
                </div>
              ) : (
                taskSuggestions.map(suggestion => (
                  <div
                    key={suggestion.id}
                    className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors"
                    data-testid={`task-suggestion-${suggestion.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{suggestion.title}</h3>
                        <p className="text-xs text-neutral-500 mt-1">{suggestion.description}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        suggestion.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        suggestion.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {suggestion.priority}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCreateTask(suggestion)}
                      className="mt-2 w-full py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
                      data-testid={`create-task-${suggestion.id}`}
                    >
                      Create Task
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Swarm Chatter Panel */}
        {showSwarmChatter && (
          <div className="w-80 border-l border-neutral-800 bg-neutral-900/50">
            <SwarmChatter onClose={() => setShowSwarmChatter(false)} />
          </div>
        )}

        {/* Toggle Swarm Chatter Button */}
        <button
          onClick={() => setShowSwarmChatter(!showSwarmChatter)}
          className={`
            absolute top-20 right-4 p-2 rounded-lg transition-colors
            ${showSwarmChatter ? 'bg-indigo-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'}
          `}
          data-testid="toggle-swarm-chatter"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
        </button>

        {/* Add Agent Modal */}
        {showAddAgentModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            data-testid="add-agent-modal"
            onClick={() => setShowAddAgentModal(false)}
          >
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6 w-96" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Add Agent</h2>
                <button
                  onClick={() => setShowAddAgentModal(false)}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors"
                  data-testid="close-add-agent-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-neutral-400 mb-4">
                Select an agent to add to the conversation
              </p>
              <div className="space-y-2">
                {AVAILABLE_AGENTS.filter(agent => !activeAgents.find(a => a.id === agent.id)).map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setActiveAgents(prev => [...prev, agent])
                      setShowAddAgentModal(false)
                    }}
                    className="w-full p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors"
                    data-testid={`modal-agent-${agent.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="font-semibold">{agent.name}</div>
                        <div className="text-xs text-neutral-500">{agent.role}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}
