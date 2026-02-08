// WebSocket service with auto-reconnect and Svelte 5 runes

import { store } from './store.svelte'
import type { WSMessage, Session, TimelineEvent } from './types'

// WS_URL computed lazily to avoid SSR window access
function getWsUrl(): string {
  if (typeof window === 'undefined') return ''
  return import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001`
}

function getPassword(): string {
  // Use stored password from login, fallback to env var
  if (typeof window !== 'undefined') {
    return localStorage.getItem('dashboard_password') || import.meta.env.VITE_FRONTEND_PASSWORD || ''
  }
  return import.meta.env.VITE_FRONTEND_PASSWORD || ''
}

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 15000
  private retryCount = 0
  private maxRetries = 5
  private authFailed = false // Don't reconnect if auth failed

  connect() {
    // Check both OPEN and CONNECTING to prevent race condition
    if (this.ws?.readyState === WebSocket.OPEN || 
        this.ws?.readyState === WebSocket.CONNECTING) return

    store.setConnectionStatus('connecting')
    
    try {
      this.ws = new WebSocket(getWsUrl())
      
      this.ws.onopen = () => {
        console.log('[WS] Connected')
        this.reconnectDelay = 1000 // Reset delay on success
        this.retryCount = 0 // Reset retry count on successful connection
        this.authFailed = false // Reset auth flag
        this.startHeartbeat() // Start heartbeat
        
        // Authenticate if password required
        const password = getPassword()
        if (password) {
          this.ws?.send(JSON.stringify({ type: 'auth', password }))
        } else {
          store.setConnectionStatus('connected')
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data)
          this.handleMessage(msg)
        } catch (err) {
          console.warn('[WS] Parse error:', err)
        }
      }

      this.ws.onclose = () => {
        console.log('[WS] Disconnected')
        this.stopHeartbeat() // Clear heartbeat on disconnect
        store.setConnectionStatus('disconnected')
        this.scheduleReconnect()
      }

      this.ws.onerror = (err) => {
        console.error('[WS] Error:', err)
        store.setConnectionStatus('error')
      }
    } catch (err) {
      console.error('[WS] Connection failed:', err)
      store.setConnectionStatus('error')
      this.scheduleReconnect()
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat() // Clear heartbeat
    this.ws?.close()
    this.ws = null
    store.setConnectionStatus('disconnected')
  }

  private startHeartbeat() {
    this.stopHeartbeat() // Clear any existing heartbeat
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Send ping every 30s
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    
    // Don't reconnect if auth failed
    if (this.authFailed) {
      console.log('[WS] Auth failed, not reconnecting')
      return
    }
    
    // Don't reconnect if max retries exceeded
    if (this.retryCount >= this.maxRetries) {
      console.log('[WS] Max retries exceeded, giving up')
      store.setConnectionStatus('error')
      return
    }
    
    this.retryCount++
    console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms... (attempt ${this.retryCount}/${this.maxRetries})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
    }, this.reconnectDelay)
  }

  private handleMessage(msg: WSMessage) {
    switch (msg.type) {
      case 'auth':
        if (msg.success) {
          store.setConnectionStatus('connected')
        } else {
          console.error('[WS] Auth failed')
          this.authFailed = true // Set flag to prevent reconnect
          store.setConnectionStatus('error')
          this.disconnect()
        }
        break

      case 'session.created':
        if (msg.data?.id) {
          store.addSession(msg.data as unknown as Session)
        }
        break

      case 'session.updated':
        if (msg.data?.id) {
          store.updateSession(msg.data as Partial<Session> & { id: string })
        }
        break

      case 'timeline':
        if (msg.data?.sessionId) {
          const event: TimelineEvent = {
            id: Date.now(),
            session_id: msg.data.sessionId as string,
            timestamp: Date.now(),
            event_type: (msg.data.eventType as TimelineEvent['event_type']) || 'message',
            summary: (msg.data.summary as string) || '',
            tool_name: (msg.data.tool as string) || null,
            provider_id: null,
            model_id: null
          }
          store.addTimelineEvent(event.session_id, event)
        }
        break

      case 'attention':
        if (msg.data?.sessionId) {
          store.updateSession({
            id: msg.data.sessionId as string,
            needs_attention: msg.data.needsAttention ? 1 : 0
          })
        }
        break

      case 'idle':
        if (msg.data?.sessionId) {
          store.updateSession({
            id: msg.data.sessionId as string,
            status: 'idle'
          })
        }
        break

      case 'error':
        if (msg.data?.sessionId) {
          store.updateSession({
            id: msg.data.sessionId as string,
            status: 'error'
          })
        }
        break
    }
  }
}

export const wsService = new WebSocketService()
