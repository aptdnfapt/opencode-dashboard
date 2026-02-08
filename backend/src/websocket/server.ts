// backend/src/websocket/server.ts
// WebSocket manager - handles client connections and broadcasting

interface BroadcastMessage {
  type: 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle' | 'error'
  data: Record<string, unknown>
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

  broadcastTimeline(sessionId: string, eventType: string, summary: string): void {
    this.broadcast({ type: 'timeline', data: { sessionId, eventType, summary } })
  }

  broadcastAttention(sessionId: string, needsAttention: boolean, audioUrl?: string): void {
    this.broadcast({ type: 'attention', data: { sessionId, needsAttention, audioUrl } })
  }

  broadcastIdle(sessionId: string, audioUrl?: string): void {
    this.broadcast({ type: 'idle', data: { sessionId, audioUrl } })
  }

  broadcastError(sessionId: string, error: string): void {
    this.broadcast({ type: 'error', data: { sessionId, error } })
  }
}

// Singleton instance
export const wsManager = new WebSocketManager()
