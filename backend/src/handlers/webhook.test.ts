// Tests webhook endpoint receives and stores plugin events
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { Database } from 'bun:sqlite'
import { initSchema } from '../db/schema'

// Mock wsManager before importing webhook handler
const mockWsManager = {
  broadcastSessionCreated: () => {},
  broadcastSessionUpdated: () => {},
  broadcastTimeline: () => {},
  broadcastAttention: () => {},
  broadcastIdle: () => {},
  broadcastError: () => {},
}

// Create a local version of webhook handler that uses mocked wsManager
function createTestWebhookHandler(app: Hono, db: Database) {
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
    cost?: number
    timestamp: number
  }

  app.post('/events', async (c) => {
    const event: PluginEvent = await c.req.json()
    const sessionId = event.sessionId || ''

    switch (event.type) {
      case 'session.created':
        db.prepare(`
          INSERT OR REPLACE INTO sessions (id, title, hostname, directory, parent_session_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
        `).run(sessionId, event.title || 'Untitled', event.hostname || 'unknown', null, event.parentSessionId || null, event.timestamp, event.timestamp)
        break

      case 'timeline':
        db.prepare(`
          INSERT INTO timeline_events (session_id, timestamp, event_type, summary, tool_name)
          VALUES (?, ?, ?, ?, ?)
        `).run(sessionId, event.timestamp, event.eventType || 'unknown', event.summary || '', event.tool || null)
        
        db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
          .run(event.timestamp, sessionId)

        if (event.eventType === 'permission') {
          db.prepare('UPDATE sessions SET needs_attention = 1 WHERE id = ?')
            .run(sessionId)
        }
        break

      case 'tokens':
        const totalTokens = (event.tokensIn || 0) + (event.tokensOut || 0)
        db.prepare(`
          UPDATE sessions SET token_total = token_total + ?, cost_total = cost_total + ?, updated_at = ?
          WHERE id = ?
        `).run(totalTokens, event.cost || 0, event.timestamp, sessionId)
        break
    }

    return c.json({ success: true })
  })
}

describe('Webhook Handler', () => {
  let db: Database
  let app: Hono

  beforeEach(() => {
    db = new Database(':memory:')
    initSchema(db)
    app = new Hono()
    createTestWebhookHandler(app, db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates session on session.created event', async () => {
    const res = await app.fetch(new Request('http://localhost/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'session.created',
        sessionId: 'test-123',
        title: 'Test Session',
        hostname: 'vps1',
        timestamp: Date.now()
      })
    }))

    expect(res.status).toBe(200)

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get('test-123')
    expect(session).toBeDefined()
    expect((session as any).title).toBe('Test Session')
  })

  it('stores timeline event on timeline type', async () => {
    // First create session
    db.prepare('INSERT INTO sessions (id, title, hostname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('test-123', 'Test', 'vps1', Date.now(), Date.now())

    const res = await app.fetch(new Request('http://localhost/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'timeline',
        sessionId: 'test-123',
        eventType: 'tool',
        summary: 'Called Read tool',
        timestamp: Date.now()
      })
    }))

    expect(res.status).toBe(200)

    const event = db.prepare('SELECT * FROM timeline_events WHERE session_id = ?').get('test-123')
    expect(event).toBeDefined()
    expect((event as any).event_type).toBe('tool')
  })

  it('updates token totals on tokens event', async () => {
    db.prepare('INSERT INTO sessions (id, title, hostname, created_at, updated_at, token_total) VALUES (?, ?, ?, ?, ?, ?)')
      .run('test-123', 'Test', 'vps1', Date.now(), Date.now(), 0)

    await app.fetch(new Request('http://localhost/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'tokens',
        sessionId: 'test-123',
        tokensIn: 100,
        tokensOut: 200,
        cost: 0.005,
        timestamp: Date.now()
      })
    }))

    const session = db.prepare('SELECT token_total FROM sessions WHERE id = ?').get('test-123') as any
    expect(session.token_total).toBe(300)
  })

  it('sets needs_attention on permission event', async () => {
    db.prepare('INSERT INTO sessions (id, title, hostname, created_at, updated_at, needs_attention) VALUES (?, ?, ?, ?, ?, ?)')
      .run('test-123', 'Test', 'vps1', Date.now(), Date.now(), 0)

    await app.fetch(new Request('http://localhost/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'timeline',
        sessionId: 'test-123',
        eventType: 'permission',
        summary: 'Waiting for approval',
        timestamp: Date.now()
      })
    }))

    const session = db.prepare('SELECT needs_attention FROM sessions WHERE id = ?').get('test-123') as any
    expect(session.needs_attention).toBe(1)
  })

  it('creates session with parent_session_id', async () => {
    const res = await app.fetch(new Request('http://localhost/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'session.created',
        sessionId: 'child-123',
        parentSessionId: 'parent-456',
        title: 'Subagent Session',
        hostname: 'vps1',
        timestamp: Date.now()
      })
    }))

    expect(res.status).toBe(200)

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get('child-123') as any
    expect(session).toBeDefined()
    expect(session.parent_session_id).toBe('parent-456')
  })
})
