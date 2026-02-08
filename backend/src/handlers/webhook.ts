// backend/src/handlers/webhook.ts
// Webhook handler - receives events from OpenCode plugin
import type { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import { wsManager } from '../websocket/server'
import { generateIdleAnnouncement, isTTSReady, generateSignedUrl } from '../services/tts'

interface PluginEvent {
  type: string
  sessionId?: string
  parentSessionId?: string
  title?: string
  hostname?: string
  eventType?: string
  summary?: string
  tool?: string
  tokensIn?: number
  tokensOut?: number
  cacheRead?: number
  cacheWrite?: number
  reasoning?: number
  cost?: number
  providerId?: string
  modelId?: string
  agent?: string
  durationMs?: number
  // file.edit fields
  filePath?: string
  fileExtension?: string
  operation?: string
  linesAdded?: number
  linesRemoved?: number
  timestamp: number
}

export function createWebhookHandler(app: Hono, db: Database) {
  // Ensure session exists - auto-create if missing (for resumed old sessions)
  // Returns true if session was newly created, false if it already existed
  function ensureSession(sessionId: string, hostname?: string, timestamp?: number): boolean {
    const exists = db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(sessionId)
    if (!exists) {
      db.prepare(`
        INSERT INTO sessions (id, title, hostname, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
      `).run(sessionId, 'Resumed Session', hostname || 'unknown', timestamp || Date.now(), timestamp || Date.now())
      
      if (hostname) {
        db.prepare(`
          INSERT INTO instances (hostname, last_seen) VALUES (?, ?)
          ON CONFLICT(hostname) DO UPDATE SET last_seen = ?
        `).run(hostname, Date.now(), Date.now())
      }
      
      // Broadcast newly auto-created session
      wsManager.broadcastSessionCreated({ id: sessionId, title: 'Resumed Session', hostname: hostname || 'unknown' })
      return true
    }
    return false
  }

  app.post('/events', async (c) => {
    // Auth: Require X-API-Key if API_KEY is set, allow localhost without auth
    const providedKey = c.req.header('X-API-Key')
    const apiKey = process.env.API_KEY
    const host = c.req.header('host')
    const isLocalhost = host?.includes('localhost') || host?.includes('127.0.0.1')

    if (apiKey && !isLocalhost && providedKey !== apiKey) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const event: PluginEvent = await c.req.json()
    const now = Date.now()

    try {
      switch (event.type) {
        case 'session.created':
          db.prepare(`
            INSERT OR REPLACE INTO sessions (id, title, hostname, directory, parent_session_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
          `).run(event.sessionId, event.title || 'Untitled', event.hostname, event.instance || null, event.parentSessionId || null, event.timestamp, event.timestamp)

          // Upsert instance
          db.prepare(`
            INSERT INTO instances (hostname, last_seen) VALUES (?, ?)
            ON CONFLICT(hostname) DO UPDATE SET last_seen = ?
          `).run(event.hostname, now, now)

          wsManager.broadcastSessionCreated({ id: event.sessionId, title: event.title, hostname: event.hostname })
          break

        case 'session.updated':
          db.prepare('UPDATE sessions SET title = ?, directory = ?, updated_at = ? WHERE id = ?')
            .run(event.title, event.instance || null, event.timestamp, event.sessionId)
          wsManager.broadcastSessionUpdated({ id: event.sessionId, title: event.title })
          break

        case 'session.idle': {
          db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
            .run('idle', event.timestamp, event.sessionId)
          
          // Get session title for TTS
          const session = db.prepare('SELECT title FROM sessions WHERE id = ?').get(event.sessionId) as { title: string } | null
          let audioUrl: string | undefined

          // Generate signed TTS URL if model is ready
          if (session && isTTSReady()) {
            audioUrl = generateSignedUrl(session.title + ' is idle', 5) // 5 min expiry
          }
          
          wsManager.broadcastIdle(event.sessionId!, audioUrl)
          break
        }

        case 'session.error':
          db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
            .run('error', event.timestamp, event.sessionId)
          wsManager.broadcastError(event.sessionId!, (event as any).error || 'Unknown error')
          break

        case 'timeline':
          // Auto-create session if missing (resumed old session)
          ensureSession(event.sessionId!, event.hostname, event.timestamp)
          
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

            // Get session title for TTS
            const attentionSession = db.prepare('SELECT title FROM sessions WHERE id = ?').get(event.sessionId) as { title: string } | null
            let attentionAudioUrl: string | undefined
            if (attentionSession && isTTSReady()) {
              attentionAudioUrl = generateSignedUrl(attentionSession.title + ' needs attention', 5) // 5 min expiry
            }
            
            wsManager.broadcastAttention(event.sessionId!, true, attentionAudioUrl)
          } else {
            // Any other event clears needs_attention (permission was handled)
            const currentSession = db.prepare('SELECT needs_attention FROM sessions WHERE id = ?').get(event.sessionId) as { needs_attention: number } | null
            if (currentSession?.needs_attention === 1) {
              db.prepare('UPDATE sessions SET needs_attention = 0, status = ? WHERE id = ?')
                .run('active', event.sessionId)
              // Broadcast status change to active
              wsManager.broadcastSessionUpdated({ id: event.sessionId, status: 'active', needs_attention: 0 })
              wsManager.broadcastAttention(event.sessionId!, false)
            }
          }
          break

        case 'tokens':
          // Auto-create session if missing (resumed old session)
          ensureSession(event.sessionId!, event.hostname, event.timestamp)
          
          // Insert token record with all fields
          db.prepare(`
            INSERT INTO token_usage (
              session_id, provider_id, model_id, agent,
              tokens_in, tokens_out, tokens_cache_read, tokens_cache_write, tokens_reasoning,
              cost, duration_ms, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            event.sessionId, 
            event.providerId || null,
            event.modelId || null,
            event.agent || null,
            event.tokensIn || 0, 
            event.tokensOut || 0,
            event.cacheRead || 0,
            event.cacheWrite || 0,
            event.reasoning || 0,
            event.cost || 0,
            event.durationMs || null,
            event.timestamp
          )

          // Update session totals
          const totalTokens = (event.tokensIn || 0) + (event.tokensOut || 0)
          db.prepare(`
            UPDATE sessions SET token_total = token_total + ?, cost_total = cost_total + ?, updated_at = ?
            WHERE id = ?
          `).run(totalTokens, event.cost || 0, event.timestamp, event.sessionId)

          // Broadcast token/cost update to frontend
          const updatedSession = db.prepare('SELECT id, token_total, cost_total FROM sessions WHERE id = ?').get(event.sessionId) as { id: string, token_total: number, cost_total: number } | null
          if (updatedSession) {
            wsManager.broadcastSessionUpdated(updatedSession)
          }
          break

        case 'file.edit':
          // Auto-create session if missing
          ensureSession(event.sessionId!, event.hostname, event.timestamp)
          
          // Insert file edit record
          db.prepare(`
            INSERT INTO file_edits (session_id, file_path, file_extension, operation, lines_added, lines_removed, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            event.sessionId,
            event.filePath || '',
            event.fileExtension || null,
            event.operation || 'unknown',
            event.linesAdded || 0,
            event.linesRemoved || 0,
            event.timestamp
          )
          break
      }

      return c.json({ success: true })
    } catch (error) {
      console.error('Webhook error:', error)
      return c.json({ error: 'Processing failed' }, 500)
    }
  })
}
