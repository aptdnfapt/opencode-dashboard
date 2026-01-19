// backend/src/handlers/webhook.ts
// Webhook handler - receives events from OpenCode plugin
import type { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import { wsManager } from '../websocket/server'

interface PluginEvent {
  type: string
  sessionId?: string
  title?: string
  hostname?: string
  eventType?: string
  summary?: string
  tool?: string
  tokensIn?: number
  tokensOut?: number
  cost?: number
  timestamp: number
}

export function createWebhookHandler(app: Hono, db: Database) {
  app.post('/events', async (c) => {
    const event: PluginEvent = await c.req.json()
    const now = Date.now()

    try {
      switch (event.type) {
        case 'session.created':
          db.prepare(`
            INSERT OR REPLACE INTO sessions (id, title, hostname, status, created_at, updated_at)
            VALUES (?, ?, ?, 'active', ?, ?)
          `).run(event.sessionId, event.title || 'Untitled', event.hostname, event.timestamp, event.timestamp)

          // Upsert instance
          db.prepare(`
            INSERT INTO instances (hostname, last_seen) VALUES (?, ?)
            ON CONFLICT(hostname) DO UPDATE SET last_seen = ?
          `).run(event.hostname, now, now)

          wsManager.broadcastSessionCreated({ id: event.sessionId, title: event.title, hostname: event.hostname })
          break

        case 'session.updated':
          db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
            .run(event.title, event.timestamp, event.sessionId)
          break

        case 'session.idle':
          db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
            .run('idle', event.timestamp, event.sessionId)
          break

        case 'timeline':
          // Insert timeline event
          db.prepare(`
            INSERT INTO timeline_events (session_id, timestamp, event_type, summary, tool_name)
            VALUES (?, ?, ?, ?, ?)
          `).run(event.sessionId, event.timestamp, event.eventType, event.summary, event.tool)

          // Update session timestamp
          db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
            .run(event.timestamp, event.sessionId)

          wsManager.broadcastTimeline(event.sessionId!, event.eventType!, event.summary || '')

          // Set needs_attention on permission events
          if (event.eventType === 'permission') {
            db.prepare('UPDATE sessions SET needs_attention = 1 WHERE id = ?')
              .run(event.sessionId)

            wsManager.broadcastAttention(event.sessionId!, true)
          }

          // Clear needs_attention on user message
          if (event.eventType === 'user') {
            db.prepare('UPDATE sessions SET needs_attention = 0, status = ? WHERE id = ?')
              .run('active', event.sessionId)
          }
          break

        case 'tokens':
          // Insert token record
          db.prepare(`
            INSERT INTO token_usage (session_id, tokens_in, tokens_out, cost, timestamp)
            VALUES (?, ?, ?, ?, ?)
          `).run(event.sessionId, event.tokensIn, event.tokensOut, event.cost, event.timestamp)

          // Update session totals
          const totalTokens = (event.tokensIn || 0) + (event.tokensOut || 0)
          db.prepare(`
            UPDATE sessions SET token_total = token_total + ?, cost_total = cost_total + ?, updated_at = ?
            WHERE id = ?
          `).run(totalTokens, event.cost || 0, event.timestamp, event.sessionId)
          break
      }

      return c.json({ success: true })
    } catch (error) {
      console.error('Webhook error:', error)
      return c.json({ error: 'Processing failed' }, 500)
    }
  })
}
