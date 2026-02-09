// WebSocket service with auto-reconnect and Svelte 5 runes

import { store } from './store.svelte'
import type { WSMessage, Session, TimelineEvent } from './types'
import {
  isTimelineWSData,
  isSessionCreatedWSData,
  isSessionUpdatedWSData,
  isAttentionWSData,
  isIdleWSData,
  isErrorWSData,
  isAuthMessage
} from './types'
import { playBing, playSubagentBing, queueAudio } from './audio'
import { showNotification } from './notifications'

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
  private intentionalDisconnect = false // Track intentional disconnects
  private connecting = false // Prevent duplicate connect() calls
  private authenticated = false // Track auth state
  private messageQueue: unknown[] = [] // Queue messages until authenticated (validated later)

  connect() {
    // Prevent race condition: already connecting or connected
    if (this.connecting) return
    if (this.ws?.readyState === WebSocket.OPEN || 
        this.ws?.readyState === WebSocket.CONNECTING) return
    
    this.connecting = true
    this.intentionalDisconnect = false // Reset on new connection attempt

    store.setConnectionStatus('connecting')
    
    try {
      this.ws = new WebSocket(getWsUrl())
      
      this.ws.onopen = () => {
        console.log('[WS] Connected')
        this.connecting = false // Connection established
        this.reconnectDelay = 1000 // Reset delay on success
        this.retryCount = 0 // Reset retry count on successful connection
        this.authFailed = false // Reset auth flag
        this.authenticated = false // Reset auth state
        this.messageQueue = [] // Clear any stale queued messages
        this.startHeartbeat() // Start heartbeat
        
        // Authenticate if password required
        const password = getPassword()
        if (password) {
          this.ws?.send(JSON.stringify({ type: 'auth', password }))
        } else {
          // No password required, mark as authenticated
          this.authenticated = true
          store.setConnectionStatus('connected')
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data)
          
          // Validate basic message structure
          if (typeof parsed !== 'object' || parsed === null) {
            console.warn('[WS] Invalid message structure')
            return
          }
          
          const msgObj = parsed as Record<string, unknown>
          if (typeof msgObj.type !== 'string') {
            console.warn('[WS] Message missing type field')
            return
          }
          
          // Auth messages always processed immediately (use type guard)
          if (isAuthMessage(parsed)) {
            this.handleAuthMessage(parsed.success)
            return
          }
          
          // Queue non-auth messages until authenticated
          if (!this.authenticated) {
            this.messageQueue.push(parsed)
            return
          }
          
          this.handleMessage(parsed)
        } catch (err) {
          console.warn('[WS] Parse error:', err)
        }
      }

      this.ws.onclose = () => {
        console.log('[WS] Disconnected')
        this.connecting = false // Reset connecting flag
        this.authenticated = false // Reset auth state
        this.stopHeartbeat() // Clear heartbeat on disconnect
        store.setConnectionStatus('disconnected')
        
        // Only reconnect if not intentional
        if (!this.intentionalDisconnect) {
          this.scheduleReconnect()
        }
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
    this.intentionalDisconnect = true // Prevent reconnect in onclose
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat() // Clear heartbeat
    this.connecting = false
    this.authenticated = false
    this.messageQueue = []
    this.ws?.close()
    this.ws = null
    store.setConnectionStatus('disconnected')
  }

  // Allow user to retry after auth failure
  resetAndReconnect() {
    this.authFailed = false
    this.retryCount = 0
    this.reconnectDelay = 1000
    this.intentionalDisconnect = false
    this.connecting = false
    this.authenticated = false
    this.messageQueue = []
    this.connect()
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

  private handleAuthMessage(success: boolean) {
    if (success) {
      this.authenticated = true
      store.setConnectionStatus('connected')
      // Process queued messages now that auth succeeded
      while (this.messageQueue.length > 0) {
        const queuedMsg = this.messageQueue.shift()
        if (queuedMsg) {
          this.handleMessage(queuedMsg)
        }
      }
    } else {
      console.error('[WS] Auth failed')
      this.authFailed = true // Set flag to prevent reconnect
      this.authenticated = false
      store.setConnectionStatus('error')
      this.disconnect()
    }
  }

  private handleMessage(msg: unknown) {
    // Validate message is object with type
    if (typeof msg !== 'object' || msg === null) return
    const msgObj = msg as Record<string, unknown>
    const msgType = msgObj.type
    const data = msgObj.data

    switch (msgType) {
      case 'session.created':
        if (isSessionCreatedWSData(data)) {
          const session: Session = {
            id: data.id,
            title: data.title || 'Untitled',
            hostname: data.hostname || 'unknown',
            directory: data.directory ?? null,
            parent_session_id: data.parent_session_id ?? null,
            status: data.status || 'active',        // new sessions are always active
            created_at: data.created_at ?? Date.now(),
            updated_at: data.updated_at ?? Date.now(),
            needs_attention: data.needs_attention ?? 0,
            token_total: data.token_total ?? 0,
            cost_total: data.cost_total ?? 0
          }
          store.addSession(session)
        }
        break

      case 'session.updated':
        if (isSessionUpdatedWSData(data)) {
          store.updateSession({
            id: data.id,
            ...(data.title !== undefined && { title: data.title }),
            ...(data.hostname !== undefined && { hostname: data.hostname }),
            ...(data.directory !== undefined && { directory: data.directory }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.updated_at !== undefined && { updated_at: data.updated_at }),
            ...(data.needs_attention !== undefined && { needs_attention: data.needs_attention }),
            ...(data.token_total !== undefined && { token_total: data.token_total }),
            ...(data.cost_total !== undefined && { cost_total: data.cost_total })
          })
        }
        break

      case 'timeline':
        if (isTimelineWSData(data)) {
          // Use REAL id/timestamp from backend
          const eventType = this.validateEventType(data.eventType)
          const event: TimelineEvent = {
            id: data.id,
            session_id: data.sessionId,
            timestamp: data.timestamp,
            event_type: eventType,
            summary: data.summary,
            tool_name: data.toolName,
            provider_id: null,
            model_id: null
          }
          store.addTimelineEvent(event.session_id, event)
        }
        break

      case 'attention':
        if (isAttentionWSData(data)) {
          store.updateSession({
            id: data.sessionId,
            needs_attention: data.needsAttention ? 1 : 0
          })
          
          // Play bing + show notification
          if (data.needsAttention) {
            playBing()
            const title = data.title ?? 'Session'
            showNotification('Attention Required', `${title} needs your attention`)
            
            // Queue TTS if audioUrl provided
            if (data.audioUrl) {
              queueAudio(data.audioUrl)
            }
          }
        }
        break

      case 'idle':
        if (isIdleWSData(data)) {
          store.updateSession({
            id: data.sessionId,
            status: 'idle'
          })
          
          // Different sound for sub-agents vs main agents
          if (data.isSubagent) {
            playSubagentBing()
          } else {
            playBing()
          }
          const title = data.title ?? 'Session'
          const label = data.isSubagent ? 'Subagent Idle' : 'Session Idle'
          showNotification(label, `${title} is now idle`)
          
          // Queue TTS if audioUrl provided
          if (data.audioUrl) {
            queueAudio(data.audioUrl)
          }
        }
        break

      case 'error':
        if (isErrorWSData(data)) {
          store.updateSession({
            id: data.sessionId,
            status: 'error'
          })
        }
        break
    }
  }

  // Validate event_type string to TimelineEvent union type
  private validateEventType(eventType: string): TimelineEvent['event_type'] {
    const validTypes: TimelineEvent['event_type'][] = ['tool', 'message', 'user', 'error', 'permission']
    if (validTypes.includes(eventType as TimelineEvent['event_type'])) {
      return eventType as TimelineEvent['event_type']
    }
    return 'message' // Default fallback
  }
}

export const wsService = new WebSocketService()
