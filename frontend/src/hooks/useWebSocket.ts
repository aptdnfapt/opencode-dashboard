// frontend/src/hooks/useWebSocket.ts
// WebSocket hook for real-time updates
import { useEffect, useRef, useCallback } from 'react'

interface WSMessage {
  type: 'auth' | 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle' | 'error'
  success?: boolean
  data?: Record<string, unknown>
}

export function useWebSocket(
  password: string,
  onMessage: (msg: WSMessage) => void,
  onConnectionChange?: (connected: boolean) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()
  const onMessageRef = useRef(onMessage)
  const connectRef = useRef<() => void>()

  // Keep callback ref fresh
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Use same protocol as current page (ws:// or wss://)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.hostname}:3001`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      onConnectionChange?.(true)
      ws.send(JSON.stringify({ type: 'auth', password }))
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.type === 'auth') {
          if (!msg.success) {
            console.error('WS auth failed')
            ws.close()
          }
        } else {
          onMessageRef.current(msg)
        }
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      onConnectionChange?.(false)
      // Reconnect after delay using ref to avoid circular dependency
      reconnectRef.current = setTimeout(() => connectRef.current?.(), 5000)
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    wsRef.current = ws
  }, [password, onConnectionChange])

  // Keep connect ref updated
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { reconnect: connect }
}