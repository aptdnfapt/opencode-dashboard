// Tests database schema creation and table structure
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { initSchema } from './schema'

describe('Database Schema', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
    initSchema(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates sessions table with required columns', () => {
    const info = db.prepare("PRAGMA table_info(sessions)").all()
    const columns = info.map((c: any) => c.name)

    expect(columns).toContain('id')
    expect(columns).toContain('title')
    expect(columns).toContain('hostname')
    expect(columns).toContain('status')
    expect(columns).toContain('created_at')
    expect(columns).toContain('needs_attention')
    expect(columns).toContain('token_total')
  })

  it('creates timeline_events table with session foreign key', () => {
    const info = db.prepare("PRAGMA table_info(timeline_events)").all()
    const columns = info.map((c: any) => c.name)

    expect(columns).toContain('session_id')
    expect(columns).toContain('event_type')
    expect(columns).toContain('timestamp')
    expect(columns).toContain('summary')
  })

  it('creates token_usage table', () => {
    const info = db.prepare("PRAGMA table_info(token_usage)").all()
    const columns = info.map((c: any) => c.name)

    expect(columns).toContain('tokens_in')
    expect(columns).toContain('tokens_out')
    expect(columns).toContain('model_id')
    expect(columns).toContain('cost')
  })

  it('creates instances table', () => {
    const info = db.prepare("PRAGMA table_info(instances)").all()
    const columns = info.map((c: any) => c.name)

    expect(columns).toContain('hostname')
    expect(columns).toContain('last_seen')
  })

  it('creates performance indexes', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    ).all() as { name: string }[]
    const names = indexes.map(i => i.name)

    expect(names).toContain('idx_timeline_session')
    expect(names).toContain('idx_sessions_status')
  })
})
