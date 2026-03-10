// web/src/stores/chatStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMessage } from '@types'

export interface Agent {
  id: string
  name: string
  role: string
  avatar: string
  color: string
}

export interface Session {
  id: string
  title: string
  agents: Agent[]
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export interface SuggestedTask {
  id: string
  title: string
  description: string
  sourceMessage?: string
}

interface ChatStore {
  // State
  sessions: Session[]
  activeSessionId: string | null
  agents: Agent[]
  suggestedTasks: SuggestedTask[]
  isStreaming: boolean

  // Session actions
  setActiveSession: (id: string) => void
  createSession: () => void
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void

  // Message actions
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id'>) => void
  updateLastMessage: (sessionId: string, content: string) => void
  setStreaming: (streaming: boolean) => void

  // Agent actions
  addAgentToSession: (sessionId: string, agent: Agent) => void
  removeAgentFromSession: (sessionId: string, agentId: string) => void
  addAgent: (agent: Agent) => void

  // Task actions
  generateTaskSuggestions: () => void
  removeSuggestedTask: (taskId: string) => void
  sendTaskToKanban: (task: SuggestedTask) => void

  // WebSocket handler
  handleWebSocketMessage: (message: any) => void
}

// Default agents - will be replaced with API call
const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Z.AI Core',
    role: 'Planner',
    avatar: '🧠',
    color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20'
  },
  {
    id: 'agent-2',
    name: 'Rust Coder',
    role: 'Executor',
    avatar: '🦀',
    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20'
  },
  {
    id: 'agent-3',
    name: 'UI/UX React',
    role: 'Frontend',
    avatar: '🎨',
    color: 'text-sky-400 bg-sky-400/10 border-sky-400/20'
  }
]

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      sessions: [
        {
          id: 'session-1',
          title: 'New Conversation',
          agents: [DEFAULT_AGENTS[0]],
          messages: [
            {
              id: 'msg-1',
              role: 'assistant',
              content: 'Hello! I am ZeroClaw, your AI assistant. How can I help you today?',
              timestamp: Date.now()
            }
          ],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ],
      activeSessionId: 'session-1',
      agents: DEFAULT_AGENTS,
      suggestedTasks: [],
      isStreaming: false,

      // Session actions
      setActiveSession: (id) => set({ activeSessionId: id }),

      createSession: () => {
        const newSession: Session = {
          id: `session-${Date.now()}`,
          title: 'New Conversation',
          agents: [],
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: newSession.id
        }))
      },

      deleteSession: (id) => {
        set((state) => {
          const filtered = state.sessions.filter(s => s.id !== id)
          const activeId = state.activeSessionId === id
            ? (filtered[0]?.id || null)
            : state.activeSessionId
          return { sessions: filtered, activeSessionId: activeId }
        })
      },

      renameSession: (id, title) => {
        set((state) => ({
          sessions: state.sessions.map(s =>
            s.id === id ? { ...s, title, updatedAt: Date.now() } : s
          )
        }))
      },

      // Message actions
      addMessage: (sessionId, message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg-${Date.now()}-${Math.random()}`
        }
        set((state) => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, newMessage], updatedAt: Date.now() }
              : s
          )
        }))
      },

      updateLastMessage: (sessionId, content) => {
        set((state) => ({
          sessions: state.sessions.map(s => {
            if (s.id !== sessionId) return s
            const messages = [...s.messages]
            const last = messages[messages.length - 1]
            if (last && last.streaming) {
              messages[messages.length - 1] = { ...last, content }
            }
            return { ...s, messages, updatedAt: Date.now() }
          })
        }))
      },

      setStreaming: (streaming) => set({ isStreaming: streaming }),

      // Agent actions
      addAgentToSession: (sessionId, agent) => {
        set((state) => ({
          sessions: state.sessions.map(s => {
            if (s.id !== sessionId) return s
            if (s.agents.find(a => a.id === agent.id)) return s
            return { ...s, agents: [...s.agents, agent], updatedAt: Date.now() }
          })
        }))
      },

      removeAgentFromSession: (sessionId, agentId) => {
        set((state) => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, agents: s.agents.filter(a => a.id !== agentId) }
              : s
          )
        }))
      },

      addAgent: (agent) => {
        set((state) => ({ agents: [...state.agents, agent] }))
      },

      // Task actions
      generateTaskSuggestions: () => {
        const newTask: SuggestedTask = {
          id: `task-${Date.now()}`,
          title: 'Example Task from Chat',
          description: 'This task was extracted from the conversation'
        }
        set((state) => ({
          suggestedTasks: [...state.suggestedTasks, newTask]
        }))
      },

      removeSuggestedTask: (taskId) => {
        set((state) => ({
          suggestedTasks: state.suggestedTasks.filter(t => t.id !== taskId)
        }))
      },

      sendTaskToKanban: (task) => {
        // Import taskStore to create task
        const { useTaskStore } = require('@stores/taskStore')

        // Create task in taskStore
        useTaskStore.getState().createTask({
          title: task.title,
          description: task.description,
          status: 'todo',
          priority: 'medium'
        }).then(() => {
          console.log('[ChatStore] Task sent to Kanban:', task.title)
        }).catch((err: Error) => {
          console.error('[ChatStore] Failed to send task to Kanban:', err)
        })

        // Remove from suggested tasks
        get().removeSuggestedTask(task.id)
      },

      // WebSocket handler
      handleWebSocketMessage: (wsMessage) => {
        if (wsMessage.type === 'chat_stream') {
          const { streaming, content, done } = wsMessage.payload
          const { activeSessionId } = get()

          if (!activeSessionId) return

          if (streaming) {
            get().updateLastMessage(activeSessionId, content)
            get().setStreaming(true)
          } else if (done) {
            get().setStreaming(false)
          }
        }
      }
    }),
    {
      name: 'zeroclaw-chat-storage',
      version: 1,
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        agents: state.agents,
        suggestedTasks: state.suggestedTasks
      }),
      migrate: (persistedState: any, version: number) => {
        // Migrate from version 0 (no version) to version 1
        if (version === 0) {
          // Ensure all required fields exist
          return {
            ...persistedState,
            sessions: persistedState.sessions || [],
            activeSessionId: persistedState.activeSessionId || null,
            agents: persistedState.agents || DEFAULT_AGENTS,
            suggestedTasks: persistedState.suggestedTasks || [],
            isStreaming: false
          }
        }
        return persistedState
      },
      onRehydrateStorage: () => (state) => {
        console.log('[ChatStore] Rehydrated state:', state?.sessions?.length || 0, 'sessions')
      }
    }
  )
)
