// Tests API endpoints for sessions and analytics
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { Database } from 'bun:sqlite'
import { initSchema } from '../db/schema'
import { createApiHandler } from './api'

describe('API Endpoints', () => {
  let db: Database
  let app: Hono

  beforeEach(() => {
    db = new Database(':memory:')
    initSchema(db)
    app = new Hono()
    createApiHandler(app, db)

    // Seed test data
    const now = Date.now()
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('s1', 'Session 1', 'vps1', '/home', 'active', now, now, 0, 1000, 0.05)
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('s2', 'Session 2', 'vps2', '/home', 'idle', now, now, 1, 500, 0.02)
  })

  afterEach(() => db.close())

  it('GET /api/sessions returns all sessions', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.length).toBe(2)
  })

  it('GET /api/sessions filters by hostname', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions?hostname=vps1'))
    const data = await res.json()

    expect(data.length).toBe(1)
    expect(data[0].hostname).toBe('vps1')
  })

  it('GET /api/sessions filters by status', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions?status=idle'))
    const data = await res.json()

    expect(data.length).toBe(1)
    expect(data[0].status).toBe('idle')
  })

  it('GET /api/sessions/:id returns session with timeline', async () => {
    // Add timeline event
    db.prepare('INSERT INTO timeline_events (session_id, timestamp, event_type, summary) VALUES (?, ?, ?, ?)')
      .run('s1', Date.now(), 'user', 'Hello')

    const res = await app.fetch(new Request('http://localhost/api/sessions/s1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.session.id).toBe('s1')
    expect(data.timeline.length).toBe(1)
  })

  it('GET /api/sessions/:id returns 404 for unknown session', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions/unknown'))
    expect(res.status).toBe(404)
  })

  it('GET /api/analytics/summary returns totals', async () => {
    const res = await app.fetch(new Request('http://localhost/api/analytics/summary'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.total_sessions).toBe(2)
  })

  it('GET /api/instances returns all instances', async () => {
    db.prepare('INSERT INTO instances VALUES (?, ?, ?)').run('vps1', Date.now(), 1)

    const res = await app.fetch(new Request('http://localhost/api/instances'))
    const data = await res.json()

    expect(data.length).toBe(1)
    expect(data[0].hostname).toBe('vps1')
  })
})
