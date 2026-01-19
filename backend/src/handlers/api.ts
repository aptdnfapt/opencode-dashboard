// backend/src/handlers/api.ts
// REST API endpoints for frontend data fetching
import type { Hono, Context } from 'hono'
import type { Database } from 'bun:sqlite'

export function createApiHandler(app: Hono, db: Database) {
  // GET /api/sessions - list sessions with optional filters
  app.get('/api/sessions', (c: Context) => {
    const { hostname, status, search, date } = c.req.query()

    let sql = 'SELECT * FROM sessions WHERE 1=1'
    const params: unknown[] = []

    if (hostname) {
      sql += ' AND hostname = ?'
      params.push(hostname)
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (search) {
      sql += ' AND title LIKE ?'
      params.push(`%${search}%`)
    }
    if (date) {
      const start = new Date(date).setHours(0, 0, 0, 0)
      const end = start + 86400000
      sql += ' AND created_at >= ? AND created_at < ?'
      params.push(start, end)
    }

    sql += ' ORDER BY updated_at DESC'
    const sessions = db.prepare(sql).all(...params)
    return c.json(sessions)
  })

  // GET /api/sessions/:id - session detail with timeline
  app.get('/api/sessions/:id', (c: Context) => {
    const id = c.req.param('id')

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    const timeline = db.prepare(
      'SELECT * FROM timeline_events WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(id)

    return c.json({ session, timeline })
  })

  // GET /api/analytics/summary - totals for dashboard
  app.get('/api/analytics/summary', (c: Context) => {
    const { startDate, endDate, hostname } = c.req.query()

    let sql = `
      SELECT
        COUNT(DISTINCT id) as total_sessions,
        SUM(token_total) as total_tokens,
        SUM(cost_total) as total_cost
      FROM sessions WHERE 1=1
    `
    const params: unknown[] = []

    if (hostname) {
      sql += ' AND hostname = ?'
      params.push(hostname)
    }

    const result = db.prepare(sql).get(...params) as Record<string, number>
    return c.json(result || { total_sessions: 0, total_tokens: 0, total_cost: 0 })
  })

  // GET /api/analytics/models - token usage by model
  app.get('/api/analytics/models', (c: Context) => {
    const models = db.prepare(`
      SELECT model_id, SUM(tokens_in + tokens_out) as total_tokens, SUM(cost) as total_cost
      FROM token_usage
      GROUP BY model_id
      ORDER BY total_tokens DESC
    `).all()
    return c.json(models)
  })

  // GET /api/analytics/daily - daily usage for calendar
  app.get('/api/analytics/daily', (c: Context) => {
    const daily = db.prepare(`
      SELECT DATE(timestamp/1000, 'unixepoch') as date,
        SUM(tokens_in + tokens_out) as total_tokens,
        SUM(cost) as total_cost
      FROM token_usage
      GROUP BY date
      ORDER BY date DESC
      LIMIT 365
    `).all()
    return c.json(daily)
  })

  // GET /api/instances - list all VPS instances
  app.get('/api/instances', (c: Context) => {
    const instances = db.prepare('SELECT * FROM instances ORDER BY hostname').all()
    return c.json(instances)
  })
}
