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

  // GET /api/analytics/usage - model usage by period (day/week/month)
  app.get('/api/analytics/usage', (c: Context) => {
    const period = c.req.query('period') || 'day'
    const limit = parseInt(c.req.query('limit') || '30')

    let dateFormat: string
    let orderDir: string

    switch (period) {
      case 'week':
        dateFormat = "DATE('week' = 'mon', timestamp/1000, 'unixepoch', 'start of week')"
        break
      case 'month':
        dateFormat = "DATE(timestamp/1000, 'unixepoch', 'start of month')"
        break
      default:
        dateFormat = "DATE(timestamp/1000, 'unixepoch')"
    }

    // Get all models first
    const models = db.prepare(`
      SELECT DISTINCT model_id FROM token_usage WHERE model_id IS NOT NULL
    `).all() as { model_id: string }[]

    if (models.length === 0) {
      return c.json([])
    }

    // Build dynamic SQL based on models
    const modelColumns = models.map((_, i) =>
      `COALESCE(SUM(CASE WHEN model_id = ? THEN tokens_in + tokens_out ELSE 0 END), 0) as model_${i}`
    ).join(', ')

    const modelParams = models.map(m => m.model_id)

    const sql = `
      SELECT
        ${dateFormat} as period,
        SUM(tokens_in + tokens_out) as total_tokens,
        SUM(cost) as total_cost,
        ${modelColumns}
      FROM token_usage
      WHERE model_id IS NOT NULL
      GROUP BY period
      ORDER BY period ${orderDir || 'DESC'}
      LIMIT ?
    `

    const usage = db.prepare(sql).all(...modelParams, limit) as Record<string, unknown>[]

    // Return clean format with model data as object
    return c.json(usage.map(row => {
      const { period, total_tokens, total_cost, ...modelData } = row
      return {
        period,
        total_tokens,
        total_cost,
        models: Object.fromEntries(
          Object.entries(modelData).map(([key, val], i) => [models[i].model_id, val])
        )
      }
    }))
  })

  // GET /api/analytics/trend - quarterly usage trend (day by day)
  app.get('/api/analytics/trend', (c: Context) => {
    const days = parseInt(c.req.query('days') || '90')

    const trend = db.prepare(`
      SELECT DATE(timestamp/1000, 'unixepoch') as date,
        SUM(tokens_in + tokens_out) as total_tokens,
        SUM(cost) as total_cost
      FROM token_usage
      GROUP BY date
      ORDER BY date ASC
      LIMIT ?
    `).all(days)

    return c.json(trend)
  })

  // GET /api/instances - list all VPS instances
  app.get('/api/instances', (c: Context) => {
    const instances = db.prepare('SELECT * FROM instances ORDER BY hostname').all()
    return c.json(instances)
  })
}
