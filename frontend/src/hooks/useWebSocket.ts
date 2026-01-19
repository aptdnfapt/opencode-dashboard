// frontend/src/hooks/useWebSocket.ts
// WebSocket hook for real-time updates
import { useEffect, useRef, useCallback } from 'react'

interface WSMessage {
  type: 'auth' | 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle'
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

  // Keep callback ref fresh
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = `ws://${window.location.hostname}:3001`
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
      reconnectRef.current = setTimeout(connect, 5000)
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    wsRef.current = ws
  }, [password, onConnectionChange])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { reconnect: connect }
}