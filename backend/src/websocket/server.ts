// backend/src/websocket/server.ts
// WebSocket manager - handles client connections and broadcasting

interface BroadcastMessage {
  type: 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle' | 'error'
  data: Record<string, unknown>
}

// Full timeline event data for broadcasting
export interface TimelineEventData {
  id: number
  sessionId: string
  timestamp: number
  eventType: string
  summary: string
  toolName: string | null
  providerId: string | null
  modelId: string | null
}

export class WebSocketManager {
  private clients = new Set<WebSocket>()

  get clientCount(): number {
    return this.clients.size
  }

  register(ws: WebSocket): void {
    this.clients.add(ws)
    console.log(`WS client connected (total: ${this.clientCount})`)
  }

  unregister(ws: WebSocket): void {
    this.clients.delete(ws)
    console.log(`WS client disconnected (total: ${this.clientCount})`)
  }

  broadcast(message: BroadcastMessage): void {
    const data = JSON.stringify(message)
    for (const client of this.clients) {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN = 1
          client.send(data)
        }
      } catch (err) {
        console.warn('Broadcast failed, removing client:', err)
        this.clients.delete(client)
      }
    }
  }

  // Convenience methods for specific event types
  broadcastSessionCreated(session: Record<string, unknown>): void {
    this.broadcast({ type: 'session.created', data: session })
  }

  broadcastSessionUpdated(session: Record<string, unknown>): void {
    this.broadcast({ type: 'session.updated', data: session })
  }

  broadcastTimeline(event: TimelineEventData): void {
    this.broadcast({ type: 'timeline', data: event as unknown as Record<string, unknown> })
  }

  broadcastAttention(sessionId: string, needsAttention: boolean, audioUrl?: string, isSubagent?: boolean, title?: string): void {
    this.broadcast({ type: 'attention', data: { sessionId, needsAttention, audioUrl, isSubagent, title } })
  }

  broadcastIdle(sessionId: string, audioUrl?: string, isSubagent?: boolean, title?: string): void {
    this.broadcast({ type: 'idle', data: { sessionId, audioUrl, isSubagent, title } })
  }

  broadcastError(sessionId: string, error: string, title?: string, audioUrl?: string, isSubagent?: boolean): void {
    this.broadcast({ type: 'error', data: { sessionId, error, title, audioUrl, isSubagent } })
  }
}

// Singleton instance
export const wsManager = new WebSocketManager()
