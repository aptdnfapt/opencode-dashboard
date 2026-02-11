// backend/src/handlers/webhook.ts
// Webhook handler - receives events from OpenCode plugin
import type { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import { wsManager, type TimelineEventData } from '../websocket/server'
import { generateIdleAnnouncement, isTTSReady, generateSignedUrl } from '../services/tts'

interface PluginEvent {
  type: string
  sessionId?: string
  parentSessionId?: string
  title?: string
  hostname?: string
  instance?: string  // directory/working directory
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
      
      // Broadcast newly auto-created session (full row from DB)
      const newAutoSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
      if (newAutoSession) {
        wsManager.broadcastSessionCreated(newAutoSession as Record<string, unknown>)
      }
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

    // Validate sessionId for events that require it
    const requiresSession = ['session.created', 'session.updated', 'session.idle', 'session.error', 'timeline', 'tokens', 'file.edit']
    if (requiresSession.includes(event.type) && !event.sessionId) {
      return c.json({ error: 'Missing sessionId' }, 400)
    }
    const sessionId = event.sessionId!  // Safe after validation

    try {
      switch (event.type) {
        case 'session.created':
          db.prepare(`
            INSERT OR REPLACE INTO sessions (id, title, hostname, directory, parent_session_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
          `).run(sessionId, event.title || 'Untitled', event.hostname || 'unknown', event.instance || null, event.parentSessionId || null, event.timestamp, event.timestamp)

          // Upsert instance
          if (event.hostname) {
            db.prepare(`
              INSERT INTO instances (hostname, last_seen) VALUES (?, ?)
              ON CONFLICT(hostname) DO UPDATE SET last_seen = ?
            `).run(event.hostname, now, now)
          }

          // Broadcast full session row so frontend has all fields (status, parent_session_id, directory, etc.)
          const newSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
          if (newSession) {
            wsManager.broadcastSessionCreated(newSession as Record<string, unknown>)
          }
          break

        case 'session.updated':
          db.prepare('UPDATE sessions SET title = ?, directory = ?, updated_at = ? WHERE id = ?')
            .run(event.title || 'Untitled', event.instance || null, event.timestamp, sessionId)
          // Broadcast full session row so frontend gets all fields
          const updatedFullSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
          if (updatedFullSession) {
            wsManager.broadcastSessionUpdated(updatedFullSession as Record<string, unknown>)
          }
          break

        case 'session.idle': {
          db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
            .run('idle', event.timestamp, sessionId)
          
          // Get session title and parent_session_id for TTS
          const session = db.prepare('SELECT title, parent_session_id FROM sessions WHERE id = ?')
            .get(sessionId) as { title: string; parent_session_id: string | null } | null
          const isSubagent = !!session?.parent_session_id
          let audioUrl: string | undefined

          // Generate signed TTS URL if model is ready
          if (session && isTTSReady()) {
            const prefix = isSubagent ? 'Subagent ' : ''
            audioUrl = generateSignedUrl(prefix + session.title + ' is idle', 5) // 5 min expiry
          }
          
          wsManager.broadcastIdle(sessionId, audioUrl, isSubagent)
          break
        }

        case 'session.error': {
          db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
            .run('error', event.timestamp, sessionId)
          
          // Get session title for notification and TTS
          const session = db.prepare('SELECT title FROM sessions WHERE id = ?')
            .get(sessionId) as { title: string } | null
          const title = session?.title || 'Unknown'
          let audioUrl: string | undefined
          
          // Generate signed TTS URL if model is ready
          if (isTTSReady()) {
            audioUrl = generateSignedUrl(title + ' encountered an error', 5) // 5 min expiry
          }
          
          wsManager.broadcastError(sessionId, (event as PluginEvent & { error?: string }).error || 'Unknown error', title, audioUrl)
          break
        }

        case 'timeline': {
          // Auto-create session if missing (resumed old session)
          ensureSession(sessionId, event.hostname, event.timestamp)
          
          // Insert timeline event and get the inserted row ID
          const insertResult = db.prepare(`
            INSERT INTO timeline_events (session_id, timestamp, event_type, summary, tool_name, provider_id, model_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(sessionId, event.timestamp, event.eventType || 'unknown', event.summary || '', event.tool || null, event.providerId || null, event.modelId || null)

          // Update session timestamp
          db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
            .run(event.timestamp, sessionId)

          // Broadcast full timeline event data
          const timelineEvent: TimelineEventData = {
            id: Number(insertResult.lastInsertRowid),
            sessionId: sessionId,
            timestamp: event.timestamp,
            eventType: event.eventType || 'unknown',
            summary: event.summary || '',
            toolName: event.tool || null,
            providerId: event.providerId || null,
            modelId: event.modelId || null
          }
          wsManager.broadcastTimeline(timelineEvent)

          // Set needs_attention on permission events
          if (event.eventType === 'permission') {
            db.prepare('UPDATE sessions SET needs_attention = 1 WHERE id = ?')
              .run(sessionId)

            // Get session title and parent_session_id for TTS
            const attentionSession = db.prepare('SELECT title, parent_session_id FROM sessions WHERE id = ?')
              .get(sessionId) as { title: string; parent_session_id: string | null } | null
            const isSubagentAttention = !!attentionSession?.parent_session_id
            let attentionAudioUrl: string | undefined
            if (attentionSession && isTTSReady()) {
              const prefix = isSubagentAttention ? 'Subagent ' : ''
              attentionAudioUrl = generateSignedUrl(prefix + attentionSession.title + ' needs attention', 5) // 5 min expiry
            }
            
            wsManager.broadcastAttention(sessionId, true, attentionAudioUrl, isSubagentAttention)
          } else {
            // Any activity clears needs_attention and sets status to active
            const currentSession = db.prepare('SELECT needs_attention, status FROM sessions WHERE id = ?')
              .get(sessionId) as { needs_attention: number; status: string } | null
            
            if (currentSession) {
              const wasIdle = currentSession.status === 'idle'
              const hadAttention = currentSession.needs_attention === 1
              
              if (wasIdle || hadAttention) {
                db.prepare('UPDATE sessions SET needs_attention = 0, status = ? WHERE id = ?')
                  .run('active', sessionId)
                // Broadcast status change to active
                wsManager.broadcastSessionUpdated({ id: sessionId, status: 'active', needs_attention: 0 })
                if (hadAttention) {
                  wsManager.broadcastAttention(sessionId, false)
                }
              }
            }
          }
          break
        }

        case 'tokens':
          // Auto-create session if missing (resumed old session)
          ensureSession(sessionId, event.hostname, event.timestamp)
          
          // Insert token record with all fields
          db.prepare(`
            INSERT INTO token_usage (
              session_id, provider_id, model_id, agent,
              tokens_in, tokens_out, tokens_cache_read, tokens_cache_write, tokens_reasoning,
              cost, duration_ms, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            sessionId, 
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

          // Update session totals (cache_read counts - model still processes cached tokens)
          const totalTokens = (event.tokensIn || 0) + (event.tokensOut || 0) + (event.cacheRead || 0)
          db.prepare(`
            UPDATE sessions SET token_total = token_total + ?, cost_total = cost_total + ?, updated_at = ?
            WHERE id = ?
          `).run(totalTokens, event.cost || 0, event.timestamp, sessionId)

          // Broadcast token/cost update to frontend
          const updatedSession = db.prepare('SELECT id, token_total, cost_total FROM sessions WHERE id = ?').get(sessionId) as { id: string, token_total: number, cost_total: number } | null
          if (updatedSession) {
            wsManager.broadcastSessionUpdated(updatedSession)
          }
          break

        case 'file.edit':
          // Auto-create session if missing
          ensureSession(sessionId, event.hostname, event.timestamp)
          
          // Insert file edit record
          db.prepare(`
            INSERT INTO file_edits (session_id, file_path, file_extension, operation, lines_added, lines_removed, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            sessionId,
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
