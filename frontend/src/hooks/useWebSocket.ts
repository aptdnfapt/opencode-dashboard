// frontend/src/hooks/useWebSocket.ts
// WebSocket hook for real-time updates
import { useEffect, useLayoutEffect, useRef, useCallback } from 'react'

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
  const connectRef = useRef<(() => void) | null>(null)

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
          onMessage(msg)
        }
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      onConnectionChange?.(false)
      // Reconnect after 5s using the ref
      if (connectRef.current) {
        reconnectRef.current = setTimeout(connectRef.current, 5000)
      }
    }

    wsRef.current = ws
  }, [password, onMessage, onConnectionChange])

  // Store connect in ref so it can be referenced in onclose callback
  // Use useLayoutEffect to avoid render phase updates
  useLayoutEffect(() => {
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