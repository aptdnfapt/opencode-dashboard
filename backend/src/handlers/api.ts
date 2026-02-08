// backend/src/handlers/api.ts
// REST API endpoints for frontend data fetching
import type { Hono, Context } from 'hono'
import type { Database } from 'bun:sqlite'
import { generateSpeech, isTTSReady, verifySignedUrl, generateSignedUrl } from '../services/tts'

export function createApiHandler(app: Hono, db: Database) {
  // GET /api/tts/test - get signed URL for TTS (for testing)
  app.get('/api/tts/test', (c: Context) => {
    const text = c.req.query('text')
    if (!text) {
      return c.json({ error: 'Missing text parameter' }, 400)
    }
    const signedUrl = generateSignedUrl(text, 5) // 5 min expiry
    return c.json({ signedUrl })
  })

  // GET /api/tts - generate speech audio from text (signed URL)
  app.get('/api/tts', async (c: Context) => {
    const text = c.req.query('text')
    const expiry = c.req.query('exp')
    const signature = c.req.query('sig')

    // Verify signed URL
    if (!text || !expiry || !signature || !verifySignedUrl(text, expiry, signature)) {
      return c.text('Unauthorized or expired URL', 401)
    }

    if (!isTTSReady()) {
      return c.text('TTS model not loaded yet', 503)
    }

    const audio = await generateSpeech(text)
    if (!audio) {
      return c.text('TTS generation failed', 500)
    }

    return new Response(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  })
  // GET /api/projects - list distinct directories with aggregated stats
  app.get('/api/projects', (c: Context) => {
    const projects = db.prepare(`
      SELECT 
        directory,
        COUNT(*) as session_count,
        SUM(token_total) as total_tokens,
        SUM(cost_total) as total_cost,
        MAX(updated_at) as last_activity,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
      FROM sessions 
      WHERE directory IS NOT NULL
      GROUP BY directory
      ORDER BY last_activity DESC
    `).all()
    
    return c.json(projects)
  })

  // GET /api/sessions - list sessions with optional filters
  // Sessions not updated for 60s while "active" are marked as "stale"
  app.get('/api/sessions', (c: Context) => {
    const { hostname, status, search, date, directory } = c.req.query()
    const STALE_THRESHOLD = 60 * 1000 // 1 minute
    const now = Date.now()

    let sql = 'SELECT * FROM sessions WHERE 1=1'
    const params: unknown[] = []

    if (hostname) {
      sql += ' AND hostname = ?'
      params.push(hostname)
    }
    if (directory) {
      sql += ' AND directory = ?'
      params.push(directory)
    }
    // Don't filter by status yet - we'll compute it dynamically
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
    const sessions = db.prepare(sql).all(...(params as (string | number)[])) as any[]

    // Compute effective status: active sessions not updated for 60s -> stale
    const processed = sessions.map(s => {
      let effectiveStatus = s.status
      if (s.status === 'active' && (now - s.updated_at) > STALE_THRESHOLD) {
        effectiveStatus = 'stale'
      }
      return { ...s, status: effectiveStatus }
    })

    // Now filter by status if requested
    const filtered = status 
      ? processed.filter(s => s.status === status)
      : processed

    return c.json(filtered)
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

    const result = db.prepare(sql).get(...(params as (string | number)[])) as Record<string, number>
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

  // GET /api/analytics/usage - token usage by period with model breakdown
  // Params: range=24h|7d|30d|1y (default 7d)
  app.get('/api/analytics/usage', (c: Context) => {
    const range = c.req.query('range') || '7d'
    
    // Calculate time boundaries
    const now = Date.now()
    let startTime: number
    let groupBy: string
    let periodType: 'hour' | 'day' | 'month'
    
    switch (range) {
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d %H:00', timestamp/1000, 'unixepoch')" // hourly
        periodType = 'hour'
        break
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d', timestamp/1000, 'unixepoch')" // daily
        periodType = 'day'
        break
      case '1y':
        startTime = now - 365 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m', timestamp/1000, 'unixepoch')" // monthly
        periodType = 'month'
        break
      default: // 7d
        startTime = now - 7 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d', timestamp/1000, 'unixepoch')" // daily
        periodType = 'day'
    }

    // Get usage grouped by period and model
    const rows = db.prepare(`
      SELECT 
        ${groupBy} as period,
        model_id,
        SUM(tokens_in + tokens_out) as tokens
      FROM token_usage
      WHERE timestamp >= ? AND model_id IS NOT NULL
      GROUP BY period, model_id
      ORDER BY period ASC
    `).all(startTime) as { period: string; model_id: string; tokens: number }[]

    // Pivot: group by period, nest models
    const periodMap = new Map<string, { period: string; total: number; models: Record<string, number> }>()
    
    for (const row of rows) {
      if (!periodMap.has(row.period)) {
        periodMap.set(row.period, { period: row.period, total: 0, models: {} })
      }
      const entry = periodMap.get(row.period)!
      entry.models[row.model_id] = row.tokens
      entry.total += row.tokens
    }

    // Fill gaps with empty values (use UTC to match SQLite)
    const result: { period: string; total: number; models: Record<string, number> }[] = []
    const start = new Date(startTime)
    const end = new Date(now)

    if (periodType === 'hour') {
      start.setUTCMinutes(0, 0, 0)
      for (let d = new Date(start); d <= end; d.setUTCHours(d.getUTCHours() + 1)) {
        const period = d.toISOString().slice(0, 13).replace('T', ' ') + ':00'
        const existing = periodMap.get(period)
        result.push({ period, total: existing?.total || 0, models: existing?.models || {} })
      }
    } else if (periodType === 'day') {
      start.setUTCHours(0, 0, 0, 0)
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const period = d.toISOString().slice(0, 10)
        const existing = periodMap.get(period)
        result.push({ period, total: existing?.total || 0, models: existing?.models || {} })
      }
    } else { // month
      start.setUTCDate(1)
      for (let d = new Date(start); d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const period = d.toISOString().slice(0, 7)
        const existing = periodMap.get(period)
        result.push({ period, total: existing?.total || 0, models: existing?.models || {} })
      }
    }

    return c.json(result)
  })

  // GET /api/analytics/trend - daily token usage for line chart
  app.get('/api/analytics/trend', (c: Context) => {
    const days = parseInt(c.req.query('days') || '90')
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000

    const trend = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d', timestamp/1000, 'unixepoch') as date,
        SUM(tokens_in + tokens_out) as total_tokens,
        SUM(cost) as total_cost
      FROM token_usage
      WHERE timestamp >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(startTime)

    return c.json(trend)
  })

  // GET /api/analytics/cost-trend - daily cost for smooth line chart
  app.get('/api/analytics/cost-trend', (c: Context) => {
    const days = parseInt(c.req.query('days') || '30')
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000

    const costs = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d', timestamp/1000, 'unixepoch') as date,
        SUM(cost) as cost,
        SUM(tokens_in + tokens_out) as tokens
      FROM token_usage
      WHERE timestamp >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(startTime) as { date: string; cost: number; tokens: number }[]

    // Fill missing days with 0
    const result: { date: string; cost: number; tokens: number }[] = []
    const startDate = new Date(startTime)
    const endDate = new Date()
    
    const costMap = new Map(costs.map(c => [c.date, c]))
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const existing = costMap.get(dateStr)
      result.push({
        date: dateStr,
        cost: existing?.cost || 0,
        tokens: existing?.tokens || 0
      })
    }

    return c.json(result)
  })

  // GET /api/analytics/hosts - token usage by hostname (summary)
  app.get('/api/analytics/hosts', (c: Context) => {
    const hosts = db.prepare(`
      SELECT 
        s.hostname,
        COUNT(DISTINCT s.id) as session_count,
        SUM(s.token_total) as total_tokens,
        SUM(s.cost_total) as total_cost
      FROM sessions s
      WHERE s.hostname IS NOT NULL AND s.hostname != ''
      GROUP BY s.hostname
      ORDER BY total_tokens DESC
    `).all()
    return c.json(hosts)
  })

  // GET /api/analytics/host-usage - token usage by period with host breakdown (like /usage but for hosts)
  app.get('/api/analytics/host-usage', (c: Context) => {
    const range = c.req.query('range') || '7d'
    
    const now = Date.now()
    let startTime: number
    let groupBy: string
    
    switch (range) {
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d %H:00', created_at/1000, 'unixepoch')"
        break
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d', created_at/1000, 'unixepoch')"
        break
      default:
        startTime = now - 7 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d', created_at/1000, 'unixepoch')"
    }

    const rows = db.prepare(`
      SELECT 
        ${groupBy} as period,
        hostname,
        SUM(token_total) as tokens
      FROM sessions
      WHERE created_at >= ? AND hostname IS NOT NULL AND hostname != ''
      GROUP BY period, hostname
      ORDER BY period ASC
    `).all(startTime) as { period: string; hostname: string; tokens: number }[]

    // Pivot by period
    const periodMap = new Map<string, { period: string; total: number; hosts: Record<string, number> }>()
    
    for (const row of rows) {
      if (!periodMap.has(row.period)) {
        periodMap.set(row.period, { period: row.period, total: 0, hosts: {} })
      }
      const entry = periodMap.get(row.period)!
      entry.hosts[row.hostname] = row.tokens || 0
      entry.total += row.tokens || 0
    }

    return c.json(Array.from(periodMap.values()))
  })

  // GET /api/instances - list all VPS instances
  app.get('/api/instances', (c: Context) => {
    const instances = db.prepare('SELECT * FROM instances ORDER BY hostname').all()
    return c.json(instances)
  })

  // GET /api/analytics/summary-extended - totals including input/output breakdown
  app.get('/api/analytics/summary-extended', (c: Context) => {
    const result = db.prepare(`
      SELECT
        COUNT(*) as total_requests,
        SUM(tokens_in) as total_input,
        SUM(tokens_out) as total_output,
        SUM(tokens_in + tokens_out) as total_tokens,
        SUM(cost) as total_cost
      FROM token_usage
    `).get() as Record<string, number>
    
    return c.json({
      total_requests: result?.total_requests || 0,
      total_input: result?.total_input || 0,
      total_output: result?.total_output || 0,
      total_tokens: result?.total_tokens || 0,
      total_cost: result?.total_cost || 0
    })
  })

  // GET /api/analytics/cost-by-model - cost breakdown by model (for donut chart)
  app.get('/api/analytics/cost-by-model', (c: Context) => {
    const models = db.prepare(`
      SELECT 
        model_id as label,
        SUM(cost) as value,
        SUM(tokens_in + tokens_out) as tokens,
        COUNT(*) as requests
      FROM token_usage
      WHERE model_id IS NOT NULL
      GROUP BY model_id
      ORDER BY value DESC
    `).all()
    return c.json(models)
  })

  // GET /api/analytics/cost-by-agent - cost breakdown by agent mode (for bar chart)
  app.get('/api/analytics/cost-by-agent', (c: Context) => {
    const agents = db.prepare(`
      SELECT 
        agent as label,
        SUM(cost) as value,
        SUM(tokens_in + tokens_out) as tokens,
        COUNT(*) as requests
      FROM token_usage
      WHERE agent IS NOT NULL
      GROUP BY agent
      ORDER BY value DESC
    `).all()
    return c.json(agents)
  })

  // GET /api/analytics/token-flow - input vs output tokens over time
  app.get('/api/analytics/token-flow', (c: Context) => {
    const range = c.req.query('range') || '7d'
    const now = Date.now()
    let startTime: number
    let groupBy: string
    let periodType: 'hour' | 'day' | 'month'
    
    switch (range) {
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d %H:00', timestamp/1000, 'unixepoch')"
        periodType = 'hour'
        break
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d', timestamp/1000, 'unixepoch')"
        periodType = 'day'
        break
      case '1y':
        startTime = now - 365 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m', timestamp/1000, 'unixepoch')"
        periodType = 'month'
        break
      default:
        startTime = now - 7 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d', timestamp/1000, 'unixepoch')"
        periodType = 'day'
    }

    const rows = db.prepare(`
      SELECT 
        ${groupBy} as period,
        SUM(tokens_in) as input,
        SUM(tokens_out) as output
      FROM token_usage
      WHERE timestamp >= ?
      GROUP BY period
      ORDER BY period ASC
    `).all(startTime) as { period: string; input: number; output: number }[]

    // Fill gaps with zeros (use UTC to match SQLite)
    const dataMap = new Map(rows.map(r => [r.period, r]))
    const result: { period: string; input: number; output: number }[] = []
    const start = new Date(startTime)
    const end = new Date(now)

    if (periodType === 'hour') {
      start.setUTCMinutes(0, 0, 0)
      for (let d = new Date(start); d <= end; d.setUTCHours(d.getUTCHours() + 1)) {
        const period = d.toISOString().slice(0, 13).replace('T', ' ') + ':00'
        const existing = dataMap.get(period)
        result.push({ period, input: existing?.input || 0, output: existing?.output || 0 })
      }
    } else if (periodType === 'day') {
      start.setUTCHours(0, 0, 0, 0)
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const period = d.toISOString().slice(0, 10)
        const existing = dataMap.get(period)
        result.push({ period, input: existing?.input || 0, output: existing?.output || 0 })
      }
    } else { // month
      start.setUTCDate(1)
      for (let d = new Date(start); d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const period = d.toISOString().slice(0, 7)
        const existing = dataMap.get(period)
        result.push({ period, input: existing?.input || 0, output: existing?.output || 0 })
      }
    }

    return c.json(result)
  })

  // GET /api/analytics/file-stats - lines of code by language (for bar chart)
  app.get('/api/analytics/file-stats', (c: Context) => {
    const stats = db.prepare(`
      SELECT 
        file_extension as extension,
        SUM(lines_added) as lines_added,
        SUM(lines_removed) as lines_removed,
        COUNT(*) as edit_count
      FROM file_edits
      WHERE file_extension IS NOT NULL
      GROUP BY file_extension
      ORDER BY lines_added DESC
      LIMIT 15
    `).all()
    return c.json(stats)
  })

  // GET /api/analytics/heatmap - daily token usage for GitHub-style calendar
  app.get('/api/analytics/heatmap', (c: Context) => {
    const days = parseInt(c.req.query('days') || '365')
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000

    const data = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d', timestamp/1000, 'unixepoch') as date,
        SUM(tokens_in + tokens_out) as tokens,
        SUM(cost) as cost,
        COUNT(*) as requests
      FROM token_usage
      WHERE timestamp >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(startTime)

    return c.json(data)
  })

  // GET /api/analytics/model-performance - avg duration by model over time
  app.get('/api/analytics/model-performance', (c: Context) => {
    const range = c.req.query('range') || '7d'
    const models = c.req.query('models')?.split(',') || []
    
    const now = Date.now()
    let startTime: number
    let groupBy: string
    let periodType: 'hour' | 'day'
    
    switch (range) {
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d %H:00', timestamp/1000, 'unixepoch')"
        periodType = 'hour'
        break
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d', timestamp/1000, 'unixepoch')"
        periodType = 'day'
        break
      default:
        startTime = now - 7 * 24 * 60 * 60 * 1000
        groupBy = "strftime('%Y-%m-%d', timestamp/1000, 'unixepoch')"
        periodType = 'day'
    }

    let sql = `
      SELECT 
        ${groupBy} as period,
        model_id,
        AVG(duration_ms) as avg_duration,
        COUNT(*) as requests
      FROM token_usage
      WHERE timestamp >= ? AND duration_ms IS NOT NULL AND model_id IS NOT NULL
    `
    const params: unknown[] = [startTime]

    if (models.length > 0) {
      sql += ` AND model_id IN (${models.map(() => '?').join(',')})`
      params.push(...models)
    }

    sql += ` GROUP BY period, model_id ORDER BY period ASC`

    const rows = db.prepare(sql).all(...(params as (string | number)[])) as { 
      period: string; model_id: string; avg_duration: number; requests: number 
    }[]

    // Pivot: { period, models: { model_id: avg_duration } }
    const periodMap = new Map<string, { period: string; models: Record<string, number> }>()
    
    for (const row of rows) {
      if (!periodMap.has(row.period)) {
        periodMap.set(row.period, { period: row.period, models: {} })
      }
      periodMap.get(row.period)!.models[row.model_id] = Math.round(row.avg_duration)
    }

    // Fill gaps - generate all periods in range (use UTC to match SQLite)
    const result: { period: string; models: Record<string, number> }[] = []
    const start = new Date(startTime)
    const end = new Date(now)

    if (periodType === 'hour') {
      start.setUTCMinutes(0, 0, 0)
      for (let d = new Date(start); d <= end; d.setUTCHours(d.getUTCHours() + 1)) {
        const period = d.toISOString().slice(0, 13).replace('T', ' ') + ':00'
        const existing = periodMap.get(period)
        result.push({ period, models: existing?.models || {} })
      }
    } else {
      start.setUTCHours(0, 0, 0, 0)
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const period = d.toISOString().slice(0, 10)
        const existing = periodMap.get(period)
        result.push({ period, models: existing?.models || {} })
      }
    }

    return c.json(result)
  })

  // GET /api/analytics/model-list - list of models with duration data (for filter dropdown)
  app.get('/api/analytics/model-list', (c: Context) => {
    const models = db.prepare(`
      SELECT DISTINCT model_id
      FROM token_usage
      WHERE model_id IS NOT NULL AND duration_ms IS NOT NULL
      ORDER BY model_id
    `).all() as { model_id: string }[]
    
    return c.json(models.map(m => m.model_id))
  })

  // GET /api/analytics/by-project - project-level analytics with time range
  app.get('/api/analytics/by-project', (c: Context) => {
    const range = c.req.query('range') || '7d'
    // Calculate timestamp for range (7d = 7 days ago, etc)
    const days = range === '24h' ? 1 : range === '30d' ? 30 : range === '1y' ? 365 : 7
    const since = Date.now() - (days * 24 * 60 * 60 * 1000)
    
    const projects = db.prepare(`
      SELECT 
        s.directory,
        COUNT(DISTINCT s.id) as sessions,
        COALESCE(SUM(t.tokens_in + t.tokens_out), 0) as tokens,
        COALESCE(SUM(t.cost), 0) as cost
      FROM sessions s
      LEFT JOIN token_usage t ON s.id = t.session_id AND t.timestamp >= ?
      WHERE s.directory IS NOT NULL
      GROUP BY s.directory
      ORDER BY cost DESC
    `).all(since)
    
    return c.json(projects)
  })
}
