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

    // Seed test data (11 columns: id, title, hostname, directory, parent_session_id, status, created_at, updated_at, needs_attention, token_total, cost_total)
    const now = Date.now()
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('s1', 'Session 1', 'vps1', '/home', null, 'active', now, now, 0, 1000, 0.05)
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('s2', 'Session 2', 'vps2', '/home', null, 'idle', now, now, 1, 500, 0.02)
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

  // --- Notes CRUD tests ---

  it('GET /api/sessions/:id/notes returns empty array for session with no notes', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions/s1/notes'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toEqual([])
  })

  it('GET /api/sessions/:id/notes returns 404 for unknown session', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions/unknown/notes'))
    expect(res.status).toBe(404)
  })

  it('POST /api/sessions/:id/notes creates a note and extracts #N refs', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Started at #3, pivoted at #12, resolved at #25' })
    }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.session_id).toBe('s1')
    expect(data.content).toBe('Started at #3, pivoted at #12, resolved at #25')
    expect(data.message_refs).toEqual([3, 12, 25])
    expect(data.created_at).toBeDefined()
  })

  it('POST /api/sessions/:id/notes rejects empty content', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '   ' })
    }))
    expect(res.status).toBe(400)
  })

  it('POST /api/sessions/:id/notes returns 404 for unknown session', async () => {
    const res = await app.fetch(new Request('http://localhost/api/sessions/unknown/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' })
    }))
    expect(res.status).toBe(404)
  })

  it('GET /api/sessions/:id/notes returns notes newest first', async () => {
    // Create two notes with slight delay
    await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'First note' })
    }))
    await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Second note' })
    }))

    const res = await app.fetch(new Request('http://localhost/api/sessions/s1/notes'))
    const data = await res.json()

    expect(data.length).toBe(2)
    expect(data[0].content).toBe('Second note')
    expect(data[1].content).toBe('First note')
  })

  it('PATCH /api/notes/:id updates content and re-extracts refs', async () => {
    // Create a note first
    const createRes = await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'See #1' })
    }))
    const created = await createRes.json()

    // Update it
    const res = await app.fetch(new Request(`http://localhost/api/notes/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated: see #5 and #10' })
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.content).toBe('Updated: see #5 and #10')
    expect(data.message_refs).toEqual([5, 10])
  })

  it('PATCH /api/notes/:id returns 404 for unknown note', async () => {
    const res = await app.fetch(new Request('http://localhost/api/notes/9999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'nope' })
    }))
    expect(res.status).toBe(404)
  })

  it('DELETE /api/notes/:id deletes a note', async () => {
    // Create then delete
    const createRes = await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'To be deleted' })
    }))
    const created = await createRes.json()

    const res = await app.fetch(new Request(`http://localhost/api/notes/${created.id}`, {
      method: 'DELETE'
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify it's gone
    const listRes = await app.fetch(new Request('http://localhost/api/sessions/s1/notes'))
    const list = await listRes.json()
    expect(list.length).toBe(0)
  })

  it('DELETE /api/notes/:id returns 404 for unknown note', async () => {
    const res = await app.fetch(new Request('http://localhost/api/notes/9999', {
      method: 'DELETE'
    }))
    expect(res.status).toBe(404)
  })

  it('GET /api/sessions includes notes_count per session', async () => {
    // Add 2 notes to s1
    await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'note 1' })
    }))
    await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'note 2' })
    }))

    const res = await app.fetch(new Request('http://localhost/api/sessions'))
    const data = await res.json()

    const s1 = data.find((s: any) => s.id === 's1')
    const s2 = data.find((s: any) => s.id === 's2')
    expect(s1.notes_count).toBe(2)
    expect(s2.notes_count).toBe(0)
  })

  it('GET /api/sessions/:id includes notes_count', async () => {
    await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'a note' })
    }))

    const res = await app.fetch(new Request('http://localhost/api/sessions/s1'))
    const data = await res.json()
    expect(data.session.notes_count).toBe(1)
  })

  it('DELETE /api/sessions/:id cascade deletes notes', async () => {
    // Add a note to s1
    await app.fetch(new Request('http://localhost/api/sessions/s1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'will be cascade deleted' })
    }))

    // Delete session s1
    await app.fetch(new Request('http://localhost/api/sessions/s1', { method: 'DELETE' }))

    // Verify notes are gone (s1 is gone so 404)
    const notesCount = db.prepare('SELECT COUNT(*) as cnt FROM notes WHERE session_id = ?').get('s1') as { cnt: number }
    expect(notesCount.cnt).toBe(0)
  })
})
