import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { WSMessage, MetricsData, A2APacket, ChatMessage } from '@types'

interface WebSocketState {
  connected: boolean
  connecting: boolean
  error: Error | null
  lastMessage: WSMessage | null
  send: (data: any) => void
  reconnect: () => void
  disconnect: () => void
}

const WebSocketContext = createContext<WebSocketState | undefined>(undefined)

interface WebSocketProviderProps {
  children: ReactNode
  url?: string
}

// Token validation helper
function isValidToken(token: string): boolean {
  // Basic validation: JWT tokens have 3 parts separated by dots
  // and should be at least 30 characters long
  const parts = token.split('.')
  if (parts.length !== 3) return false

  // Check if each part is base64-like (only contains valid base64 chars)
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/
  return parts.every(part => part.length > 0 && base64Regex.test(part))
}

// Sanitize WebSocket URL
function sanitizeWebSocketUrl(url: string): string {
  try {
    const urlObj = new URL(url)

    // Only allow ws:// or wss:// protocols
    if (!['ws:', 'wss:'].includes(urlObj.protocol)) {
      throw new Error('Invalid WebSocket protocol')
    }

    // Validate hostname
    if (!urlObj.hostname || urlObj.hostname === 'localhost' || urlObj.hostname.startsWith('127.') ||
        urlObj.hostname.startsWith('10.') || urlObj.hostname.startsWith('192.168.') ||
        urlObj.hostname === '[::1]' || urlObj.hostname.startsWith('192.0.0.')) {
      return url
    }

    // For production, add your domain whitelist here
    const allowedHosts = ['dash.karndt.pl', 'karndt.pl', 'localhost', '127.0.0.1']
    if (allowedHosts.includes(urlObj.hostname)) {
      return url
    }
    throw new Error('Unauthorized WebSocket hostname')
  } catch (err) {
    console.error('WebSocket URL validation failed:', err)
    throw err
  }
}

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
  // Dynamic WebSocket URL based on environment
  const getWebSocketUrl = (): string => {
    if (url) return url

    // Determine WebSocket protocol and host based on current environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? '127.0.0.1:42619' // Use pairing server port for now
      : '127.0.0.1:42619' // Use pairing server port for production
    
    const baseWsUrl = `${protocol}//${host}/ws/chat`
    const token = window.localStorage.getItem('zeroclaw_token')
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''
    return `${baseWsUrl}${tokenParam}`
  }

  // Check if we're in test mode (via localStorage or environment)
  const isTestMode = useCallback(() => {
    // Check for test token or test flag in localStorage
    const testToken = window.localStorage.getItem('zeroclaw_token')
    if (testToken === 'mock-test-token-123') return true

    // Check for explicit test mode flag
    if (window.localStorage.getItem('zeroclaw_test_mode') === 'true') return true

    return false
  }, [])

  const wsUrl = getWebSocketUrl()
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [shouldReconnect, setShouldReconnect] = useState(true)
  const [authError, setAuthError] = useState(false)

  const MAX_RECONNECT_ATTEMPTS = 10
  const BASE_RECONNECT_DELAY = 1000
  const MAX_RECONNECT_DELAY = 30000

  const connect = useCallback(() => {
    if (connecting || connected) return

    setConnecting(true)
    setError(null)
    setAuthError(false)

    try {
      // Sanitize URL
      const sanitizedUrl = sanitizeWebSocketUrl(wsUrl)

      // Get token safely (using try-catch for localStorage access)
      let token: string | null = null
      try {
        const storageValue = window.localStorage.getItem('zeroclaw_token')
        token = storageValue

        // Validate token before using it
        if (token && !isValidToken(token)) {
          console.warn('Invalid token format, connecting without authentication')
          window.localStorage.removeItem('zeroclaw_token')
          token = null
        }
      } catch (err) {
        console.warn('Failed to access localStorage:', err)
      }

      const connectionUrl = sanitizedUrl
      console.log('🔌 Connecting WebSocket to:', connectionUrl)
      const websocket = new WebSocket(connectionUrl)

      websocket.onopen = () => {
        console.log('✅ WebSocket Connected')
        setConnected(true)
        setConnecting(false)
        setReconnectAttempts(0)
        setError(null)
        setAuthError(false)

        // Subscribe to all channels
        if (token) websocket.send(JSON.stringify({type: "auth", token}));
        try {
          websocket.send(JSON.stringify({
            type: 'subscribe',
            channels: ['a2a_stream', 'chat_stream', 'metrics', 'hand_status']
          }))
        } catch (err) {
          console.error('Failed to send subscription message:', err)
        }
      }

      websocket.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)

          // Handle auth errors - check payload for error information
          if (message.payload && typeof message.payload === 'object' && 'error' in message.payload) {
            const errorPayload = message.payload as { error?: string }
            if (errorPayload.error?.toLowerCase().includes('auth')) {
              setAuthError(true)
              setError(new Error('Authentication failed'))
              setConnected(false)

              // Clear invalid token
              try {
                window.localStorage.removeItem('zeroclaw_token')
              } catch (err) {
                console.warn('Failed to clear invalid token:', err)
              }
              return
            }
          }

          setLastMessage(message)
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      websocket.onclose = (event) => {
        setConnected(false)
        setConnecting(false)
        setWs(null)

        // Handle unauthorized close
        if (event.code === 4001 || event.code === 401 || event.code === 403) {
          setAuthError(true)
          setError(new Error(`WebSocket closed: ${event.reason || 'Unauthorized'}`))

          // Clear invalid token
          try {
            window.localStorage.removeItem('zeroclaw_token')
          } catch (err) {
            console.warn('Failed to clear invalid token:', err)
          }

          // Don't auto-reconnect on auth errors
          return
        }

        // Exponential backoff reconnection
        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
            MAX_RECONNECT_DELAY
          )

          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1)
            connect()
          }, delay)
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setError(new Error('Max reconnection attempts reached'))
        }
      }

      websocket.onerror = (err) => {
        console.error('❌ WebSocket Error:', err)
        setError(new Error('WebSocket connection failed'))
        setConnecting(false)
      }

      setWs(websocket)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create WebSocket')
      setError(error)
      setConnecting(false)
    }
  }, [wsUrl, connecting, connected, reconnectAttempts, shouldReconnect])

  const disconnect = useCallback(() => {
    setShouldReconnect(false)
    if (ws) {
      ws.close()
    }
    setWs(null)
    setConnected(false)
  }, [ws])

  const reconnect = useCallback(() => {
    setShouldReconnect(true)
    setReconnectAttempts(0)
    if (ws) {
      ws.close()
    }
    connect()
  }, [ws, connect])

  const send = useCallback((data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data))
      } catch (err) {
        console.error('Failed to send WebSocket message:', err)
        setError(err instanceof Error ? err : new Error('Failed to send message'))
      }
    } else {
      console.warn('WebSocket is not connected. Message not sent:', data)
    }
  }, [ws])

  useEffect(() => {
    // Expose connection status to window for E2E tests
    // @ts-ignore - exposing for testing
    window.wsConnected = connected

    if (connected) {
      console.log('🔗 WebSocket Status: CONNECTED')
    } else {
      console.log('🔗 WebSocket Status: DISCONNECTED')
    }
  }, [connected])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [])

  const value: WebSocketState = {
    connected,
    connecting,
    error,
    lastMessage,
    send,
    reconnect,
    disconnect
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}