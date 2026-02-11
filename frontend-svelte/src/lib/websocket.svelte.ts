// WebSocket service with auto-reconnect, background-resilient heartbeat,
// and visibility/network-aware reconnection (Svelte 5 runes)

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
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // Dev mode (vite on 5173) → separate WS port 3001
  // Production / Docker (any other port) → /ws on same host
  if (window.location.port === '5173') {
    return `ws://${window.location.hostname}:3001`
  }
  return `${proto}//${window.location.host}/ws`
}

function getPassword(): string {
  // Use stored password from login — no build-time fallback
  if (typeof window !== 'undefined') {
    return localStorage.getItem('dashboard_password') || ''
  }
  return ''
}

// --- Web Worker heartbeat ---
// Browsers throttle setInterval in background tabs, killing the WS connection.
// Web Workers are NOT throttled, so we run the heartbeat timer inside one.
function createHeartbeatWorker(): Worker | null {
  if (typeof window === 'undefined') return null
  try {
    // Inline worker: posts 'tick' every N ms (interval set via message)
    const blob = new Blob([`
      let id = null;
      self.onmessage = (e) => {
        if (e.data.cmd === 'start') {
          if (id) clearInterval(id);
          id = setInterval(() => self.postMessage('tick'), e.data.interval);
        } else if (e.data.cmd === 'stop') {
          if (id) { clearInterval(id); id = null; }
        }
      };
    `], { type: 'application/javascript' })
    return new Worker(URL.createObjectURL(blob))
  } catch {
    // Workers blocked (e.g. some privacy extensions) → fall back to setInterval
    return null
  }
}

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatWorker: Worker | null = null       // Web Worker for background-safe heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null  // fallback if Worker unavailable
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000   // cap at 30s (was 15s)
  private retryCount = 0
  // No maxRetries cap — we never give up, just slow down (like Discord/WhatsApp)
  private authFailed = false // Don't reconnect if auth failed
  private intentionalDisconnect = false // Track intentional disconnects
  private connecting = false // Prevent duplicate connect() calls
  private authenticated = false // Track auth state
  private messageQueue: unknown[] = [] // Queue messages until authenticated (validated later)

  // Browser event listener refs for cleanup
  private boundOnVisibilityChange: (() => void) | null = null
  private boundOnOnline: (() => void) | null = null
  private boundOnOffline: (() => void) | null = null

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
        this.startHeartbeat() // Start heartbeat (Worker-based)
        
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
    this.removeBrowserListeners() // Clean up visibility/network listeners
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

  // --- Browser event listeners (visibility + network) ---
  // Call once after first connect to wire up tab/network awareness

  setupBrowserListeners() {
    if (typeof window === 'undefined') return
    if (this.boundOnVisibilityChange) return // already set up

    // When tab becomes visible again → check WS health, reconnect if dead
    this.boundOnVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[WS] Tab visible — checking connection')
        const state = this.ws?.readyState
        // If WS is closed/closing or null → force immediate reconnect
        if (!this.ws || state === WebSocket.CLOSED || state === WebSocket.CLOSING) {
          console.log('[WS] Connection dead after background — reconnecting now')
          this.retryCount = 0          // reset backoff so it's instant
          this.reconnectDelay = 100    // near-instant first attempt
          this.connecting = false      // allow new connect()
          this.intentionalDisconnect = false
          // Cancel any pending slow reconnect timer
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
          }
          this.connect()
        } else if (state === WebSocket.OPEN) {
          // Connection alive — send immediate ping to verify it's not a zombie
          this.ws.send(JSON.stringify({ type: 'ping' }))
        }
      }
    }
    document.addEventListener('visibilitychange', this.boundOnVisibilityChange)

    // When network comes back online → reconnect if WS is dead
    this.boundOnOnline = () => {
      console.log('[WS] Network online — checking connection')
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.retryCount = 0
        this.reconnectDelay = 500
        this.connecting = false
        this.intentionalDisconnect = false
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
        this.connect()
      }
    }
    window.addEventListener('online', this.boundOnOnline)

    // When network goes offline → update status immediately
    this.boundOnOffline = () => {
      console.log('[WS] Network offline')
      store.setConnectionStatus('disconnected')
    }
    window.addEventListener('offline', this.boundOnOffline)
  }

  private removeBrowserListeners() {
    if (typeof window === 'undefined') return
    if (this.boundOnVisibilityChange) {
      document.removeEventListener('visibilitychange', this.boundOnVisibilityChange)
      this.boundOnVisibilityChange = null
    }
    if (this.boundOnOnline) {
      window.removeEventListener('online', this.boundOnOnline)
      this.boundOnOnline = null
    }
    if (this.boundOnOffline) {
      window.removeEventListener('offline', this.boundOnOffline)
      this.boundOnOffline = null
    }
  }

  // --- Heartbeat (Web Worker primary, setInterval fallback) ---

  private startHeartbeat() {
    this.stopHeartbeat() // Clear any existing

    // Try Web Worker first — not throttled in background tabs
    if (!this.heartbeatWorker) {
      this.heartbeatWorker = createHeartbeatWorker()
    }

    if (this.heartbeatWorker) {
      this.heartbeatWorker.onmessage = () => {
        // Worker ticked → send ping if WS is open
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        }
      }
      this.heartbeatWorker.postMessage({ cmd: 'start', interval: 25000 }) // 25s pings
    } else {
      // Fallback: regular setInterval (will be throttled in background, but better than nothing)
      this.heartbeatInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25000)
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatWorker) {
      this.heartbeatWorker.postMessage({ cmd: 'stop' })
      // Don't terminate — reuse on next connect
    }
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
    
    // Never give up — just slow down with exponential backoff (capped at 30s)
    // This matches how Discord/WhatsApp behave
    this.retryCount++
    console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms... (attempt ${this.retryCount})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
      // Exponential backoff capped at 30s
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

          // Play error sound + notification (like idle/attention events)
          playBing()
          const title = data.title ?? 'Session'
          showNotification('Session Error', `${title} encountered an error`)

          // Queue TTS if audioUrl provided
          if (data.audioUrl) {
            queueAudio(data.audioUrl)
          }
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
