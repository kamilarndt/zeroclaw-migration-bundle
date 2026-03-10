// WebSocket Events
export type WSMessageType = 'a2a_stream' | 'chat_stream' | 'metrics' | 'hand_status' | 'chunk' | 'tool_call' | 'tool_result' | 'done' | 'error'

export interface WSMessage<T = any> {
  type: WSMessageType
  payload?: T
  content?: string
  full_response?: string
  tool_name?: string
  tool_args?: Record<string, any>
  tool_output?: string
  streaming?: boolean
  done?: boolean
}

// A2A Communication
export type A2AMessageType = 'TaskAssignment' | 'TaskProgress' | 'TaskCompletion' | 'ClarificationRequest'

export interface A2APacket {
  from: string
  to: string
  messageType: A2AMessageType
  content: any
  timestamp: number
}

// Chat
export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  attachments?: Attachment[]
  audioData?: ArrayBuffer
  streaming?: boolean
}

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
}

// Tasks
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  assignee?: string
  priority: TaskPriority
  createdAt: number
  updatedAt: number
  dueDate?: Date | string | null
  tags?: string[]
}

export interface TaskFilter {
  status?: TaskStatus
  assignee?: string
  priority?: TaskPriority
  search?: string
}

// SOPs
export interface SOP {
  id: string
  name: string
  description?: string
  yaml: string
  createdAt: number
  updatedAt: number
}

// Metrics
export interface MetricsData {
  ram: {
    used: number
    total: number
    percent: number
  }
  cpu: {
    percent: number
  }
  apiCost: {
    total: number
    currency: string
  }
  timestamp: number
}

// Active Hands
export type HandStatus = 'running' | 'paused' | 'stopping'

export interface ActiveHand {
  id: string
  task: string
  progress: number
  startTime: number
  status: HandStatus
}

// Extended Hand interface for UI components
export interface Hand {
  id: string
  name: string
  description?: string
  model?: string
  isIdle: boolean
  systemLoad: number
  lastActiveAt: string
  tasksCompleted: number
  status?: 'active' | 'idle' | 'error'
}

// Config
export interface ConfigData {
  network: {
    enabled: boolean
    whitelist: string[]
  }
  api: {
    provider: string
    maxTokens: number
  }
  limits: {
    maxIterations: number
    timeout: number
  }
  providers: {
    openai: boolean
    anthropic: boolean
    ollama: boolean
  }
}

// App State
export type MobileTab = 'chat' | 'tasks' | 'hands' | 'system'
export type Theme = 'light' | 'dark'

export interface AppState {
  currentRoute: string
  sidebarOpen: boolean
  rightPanelOpen: boolean
  mobileTab: MobileTab
  theme: Theme
}

// API Response wrappers
export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
