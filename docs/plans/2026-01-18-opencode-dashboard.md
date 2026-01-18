# OpenCode Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time dashboard that monitors OpenCode sessions across multiple VPS instances, showing session status, timeline events, and usage analytics.

**Architecture:** Plugin (existing) sends events to backend (Bun + Hono + SQLite) via POST; backend stores data and pushes updates via WebSocket; frontend (Vite + React + shadcn/ui) displays sessions list with real-time updates, analytics dashboard with 4 chart types, and settings page with theme switcher.

**Tech Stack:** Backend: Bun, Hono, SQLite, better-sqlite3, WebSocket; Frontend: Vite, React, TypeScript, shadcn/ui, recharts, Zustand, date-fns

---

## Task 1: Backend Setup - Project Initialization

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`
- Create: `.env.example`

**Step 1: Create backend package.json**

```json
{
  "name": "opencode-dashboard-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts",
    "start": "bun run src/index.ts"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "better-sqlite3": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

**Step 2: Create backend tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Step 3: Create backend entry point**

```typescript
// backend/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => c.text('OpenCode Dashboard API'))

export default {
  port: 3000,
  fetch: app.fetch
}
```

**Step 4: Create .env.example**

```env
# Backend configuration
BACKEND_PORT=3000
BACKEND_PASSWORD=your_password_here
DATABASE_URL=./database.db
```

**Step 5: Install dependencies**

Run: `cd backend && bun install`
Expected: Dependencies installed successfully

**Step 6: Test backend starts**

Run: `bun run dev`
Expected: Server running on port 3000

**Step 7: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/src/index.ts .env.example
git commit -m "feat: initialize backend project with Hono"
```

---

## Task 2: Database Schema Implementation

**Files:**
- Create: `backend/src/db.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create database schema**

```typescript
// backend/src/db.ts
import Database from 'better-sqlite3'
import { join } from 'path'

const db = new Database(join(process.cwd(), 'database.db'))

// Enable WAL for better concurrent access
db.pragma('journal_mode = WAL')

// Sessions table
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    hostname TEXT NOT NULL,
    directory TEXT,
    status TEXT DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    needs_attention INTEGER DEFAULT 0,
    token_total INTEGER DEFAULT 0,
    cost_total REAL DEFAULT 0
  )
`)

// Timeline events table
db.exec(`
  CREATE TABLE IF NOT EXISTS timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT,
    tool_name TEXT,
    provider_id TEXT,
    model_id TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
  )
`)

// Token usage table
db.exec(`
  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    message_id TEXT,
    provider_id TEXT,
    model_id TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
  )
`)

// Instances table (tracked via hostnames)
db.exec(`
  CREATE TABLE IF NOT EXISTS instances (
    hostname TEXT PRIMARY KEY,
    last_seen INTEGER NOT NULL,
    sessions_count INTEGER DEFAULT 0
  )
`)

// Indexes for performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_timeline_session ON timeline_events(session_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_token_usage_session ON token_usage(session_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status, updated_at);
`)

export default db
```

**Step 2: Update index.ts to initialize database**

```typescript
// backend/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import db from './db.js'  // Import database

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => c.text('OpenCode Dashboard API'))

// Health check endpoint
app.get('/health', (c) => c.json({ status: 'ok', database: 'connected' }))

export default {
  port: parseInt(process.env.BACKEND_PORT || '3000'),
  fetch: app.fetch
}
```

**Step 3: Test database initialization**

Run: `bun run dev`
Expected: Server starts, database.db file created

**Step 4: Verify database tables**

Run: `sqlite3 database.db ".schema"`
Expected: Output shows all 4 tables created

**Step 5: Commit**

```bash
git add backend/src/db.ts backend/src/index.ts
git commit -m "feat: add SQLite database schema (sessions, timeline, token_usage, instances)"
```

---

## Task 3: Webhook Endpoint - Receive Plugin Events

**Files:**
- Create: `backend/src/webhook.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create webhook handler**

```typescript
// backend/src/webhook.ts
import type { Hono } from 'hono'
import type { Context } from 'hono'

// Types for plugin events
interface PluginEvent {
  type: string
  sessionId?: string
  title?: string
  eventType?: string
  summary?: string
  tool?: string
  providerId?: string
  modelId?: string
  tokensIn?: number
  tokensOut?: number
  cost?: number
  messageId?: string
  instance?: string
  hostname?: string
  error?: string
  timestamp: number
}

export function setupWebhook(app: Hono) {
  // API key validation middleware
  app.use('/events', async (c, next) => {
    const apiKey = c.req.header('X-API-Key')
    const validKey = process.env.API_KEY

    if (!validKey) {
      await next()
      return
    }

    if (apiKey !== validKey) {
      return c.json({ error: 'Invalid API key' }, 401)
    }

    await next()
  })

  // Receive events from plugin
  app.post('/events', async (c: Context) => {
    const event: PluginEvent = await c.req.json()
    const { type, sessionId, timestamp } = event

    try {
      switch (type) {
        case 'session.created':
          handleSessionCreated(event as PluginEvent & { sessionId: string })
          break

        case 'session.updated':
          handleSessionUpdated(event as PluginEvent & { sessionId: string })
          break

        case 'session.idle':
          handleSessionIdle(event as PluginEvent & { sessionId: string })
          break

        case 'session.error':
          handleSessionError(event as PluginEvent & { sessionId: string })
          break

        case 'timeline':
          handleTimelineEvent(event as PluginEvent & { sessionId: string, eventType: string })
          break

        case 'tokens':
          handleTokenEvent(event as PluginEvent & { sessionId: string, tokensIn: number, tokensOut: number })
          break

        default:
          console.log('Unknown event type:', type)
      }

      return c.json({ success: true })
    } catch (error) {
      console.error('Error handling event:', error)
      return c.json({ error: 'Event processing failed' }, 500)
    }
  })
}

function handleSessionCreated(event: { sessionId: string, title: string, hostname: string, timestamp: number, instance?: string }) {
  const db = await import('./db.js').then(m => m.default)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions (id, title, hostname, status, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?)
  `)
  stmt.run(event.sessionId, event.title || 'Untitled', event.hostname, event.timestamp, event.timestamp)
  updateInstanceLastSeen(event.hostname)
}

function handleSessionUpdated(event: { sessionId: string, title: string, timestamp: number }) {
  const db = await import('./db.js').then(m => m.default)
  const stmt = db.prepare(`
    UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?
  `)
  stmt.run(event.title, event.timestamp, event.sessionId)
}

function handleSessionIdle(event: { sessionId: string, timestamp: number }) {
  const db = await import('./db.js').then(m => m.default)
  const idleTime = 30 * 60 * 1000 // 30 minutes
  const stmt1 = db.prepare(`
    UPDATE sessions SET status = 'idle', updated_at = ? WHERE id = ?
  `)
  stmt1.run(event.timestamp, event.sessionId)

  // Check if session should be marked as old (idle > 30 min)
  const now = Date.now()
  const stmt2 = db.prepare(`
    UPDATE sessions SET status = 'old' WHERE id = ? AND updated_at < ?
  `)
  stmt2.run(event.sessionId, now - idleTime)
}

function handleSessionError(event: { sessionId: string, error: string, timestamp: number }) {
  const db = await import('./db.js').then(m => m.default)
  const stmt = db.prepare(`
    UPDATE sessions SET status = 'error', updated_at = ? WHERE id = ?
  `)
  stmt.run(event.timestamp, event.sessionId)
}

function handleTimelineEvent(event: { sessionId: string, eventType: string, summary: string, tool?: string, timestamp: number, providerId?: string, modelId?: string }) {
  const db = await import('./db.js').then(m => m.default)

  // Insert timeline event
  const stmt = db.prepare(`
    INSERT INTO timeline_events (session_id, timestamp, event_type, summary, tool_name, provider_id, model_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(event.sessionId, event.timestamp, event.eventType, event.summary, event.tool, event.providerId, event.modelId)

  // Update session updated_at
  const updateStmt = db.prepare(`
    UPDATE sessions SET updated_at = ? WHERE id = ?
  `)
  updateStmt.run(event.timestamp, event.sessionId)

  // If permission event, set needs_attention
  if (event.eventType === 'permission') {
    const attentionStmt = db.prepare(`
      UPDATE sessions SET needs_attention = 1 WHERE id = ?
    `)
    attentionStmt.run(event.sessionId)
  }

  // Reset needs_attention on user message (user is back)
  if (event.eventType === 'user') {
    const attentionStmt = db.prepare(`
      UPDATE sessions SET needs_attention = 0, status = 'active' WHERE id = ?
    `)
    attentionStmt.run(event.sessionId)
  }
}

function handleTokenEvent(event: { sessionId: string, messageId: string, providerId: string, modelId: string, tokensIn: number, tokensOut: number, cost: number, timestamp: number }) {
  const db = await import('./db.js').then(m => m.default)

  // Insert token usage
  const stmt = db.prepare(`
    INSERT INTO token_usage (session_id, message_id, provider_id, model_id, tokens_in, tokens_out, cost, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(event.sessionId, event.messageId, event.providerId, event.modelId, event.tokensIn, event.tokensOut, event.cost, event.timestamp)

  // Update session totals
  const updateStmt = db.prepare(`
    UPDATE sessions
    SET token_total = token_total + ?,
        cost_total = cost_total + ?,
        updated_at = ?
    WHERE id = ?
  `)
  updateStmt.run(event.tokensIn + event.tokensOut, event.cost, event.timestamp, event.sessionId)
}

function updateInstanceLastSeen(hostname: string) {
  const db = await import('./db.js').then(m => m.default)
  const now = Date.now()

  // Check if instance exists
  const check = db.prepare('SELECT hostname FROM instances WHERE hostname = ?')
  const exists = check.get(hostname)

  if (exists) {
    const stmt = db.prepare(`
      UPDATE instances SET last_seen = ?, sessions_count = (
        SELECT COUNT(*) FROM sessions WHERE hostname = ? AND status != 'old'
      ) WHERE hostname = ?
    `)
    stmt.run(now, hostname, hostname)
  } else {
    const stmt = db.prepare(`
      INSERT INTO instances (hostname, last_seen, sessions_count)
      VALUES (?, ?, 0)
    `)
    stmt.run(hostname, now)
  }
}
```

**Step 2: Import webhook in index.ts**

```typescript
// backend/src/index.ts (add import and setup)
import { setupWebhook } from './webhook.js'

// ... existing code ...

setupWebhook(app)
```

**Step 3: Test webhook endpoint**

Run: `bun run dev` (in one terminal)

Test POST: `curl -X POST http://localhost:3000/events -H "Content-Type: application/json" -d '{"type":"session.created","sessionId":"test-123","title":"Test Session","hostname":"test-host","timestamp":1705593600000}'`

Expected: `{"success":true}`

**Step 4: Verify database has session**

Run: `sqlite3 database.db "SELECT * FROM sessions"`
Expected: Shows test session entry

**Step 5: Commit**

```bash
git add backend/src/webhook.ts backend/src/index.ts
git commit -m "feat: add webhook endpoint to receive plugin events"
```

---

## Task 4: WebSocket Server for Real-time Updates

**Files:**
- Create: `backend/src/websocket.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create WebSocket server**

```typescript
// backend/src/websocket.ts
import { Hono } from 'hono'
import type { Context } from 'hono'

interface WebSocketMessage {
  type: 'session.created' | 'session.updated' | 'timeline' | 'idle' | 'attention'
  data: any
}

const clients = new Set<WebSocket>()

export function broadcast(message: WebSocketMessage) {
  const data = JSON.stringify(message)
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}

export function setupWebSocket(app: Hono, port: number) {
  // Create WebSocket server with password authentication
  Bun.serve({
    port: port + 1, // WS on port 3001 if API on 3000
    fetch(req, server) {
      if (server.upgrade(req)) {
        return
      }
      return new Response('Upgrade failed', { status: 500 })
    },
    websocket: {
      message(ws, message) {
        // Handle incoming messages (authentication)
        try {
          const data: { type: 'auth', password: string } = JSON.parse(message.toString())

          if (data.type === 'auth') {
            const validPassword = process.env.BACKEND_PASSWORD

            if (!validPassword || data.password === validPassword) {
              ws.send(JSON.stringify({ type: 'auth', success: true }))
              clients.add(ws)
            } else {
              ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Invalid password' }))
              ws.close()
            }
          }
        } catch (error) {
          console.error('WebSocket message error:', error)
        }
      },
      open(ws) {
        console.log('WebSocket client connected')
      },
      close(ws) {
        console.log('WebSocket client disconnected')
        clients.delete(ws)
      }
    }
  })

  console.log(`WebSocket server running on port ${port + 1}`)
}
```

**Step 2: Generate broadcasting functions for all event types**

Add to `backend/src/websocket.ts`:

```typescript
export function broadcastSessionCreated(data: any) {
  broadcast({ type: 'session.created', data })
}

export function broadcastTimeline(sessionId: string, eventType: string, summary: string) {
  broadcast({ type: 'timeline', data: { sessionId, eventType, summary } })
}

export function broadcastIdle(sessionId: string) {
  broadcast({ type: 'idle', data: { sessionId } })
}

export function broadcastAttention(sessionId: boolean, needsAttention: boolean) {
  broadcast({ type: 'attention', data: { sessionId, needsAttention } })
}
```

**Step 3: Update webhook.ts to broadcast events**

Import and call broadcast functions in each handler:

```typescript
// At top of webhook.ts
import { broadcastSessionCreated, broadcastTimeline, broadcastIdle, broadcastAttention } from './websocket.js'

// In handleSessionCreated:
broadcastSessionCreated({ sessionId: event.sessionId, title: event.title, hostname: event.hostname })

// In handleTimelineEvent:
broadcastTimeline(event.sessionId, event.eventType, event.summary)

// In handleSessionIdle:
broadcastIdle(event.sessionId)

// After setting needs_attention (in handleTimelineEvent):
broadcastAttention(event.sessionId, true)
```

**Step 4: Setup WebSocket server in index.ts**

```typescript
// backend/src/index.ts (add at bottom)
import { setupWebSocket } from './websocket.js'

setupWebSocket(app, parseInt(process.env.BACKEND_PORT || '3000'))
```

**Step 5: Test WebSocket connection**

Run: `bun run dev`

Test with WebSocket client (e.g., `wscat`):
```bash
wscat -c ws://localhost:3001
# Then send: {"type":"auth","password":"your_password"}
# Expected: {"type":"auth","success":true}
```

**Step 6: Commit**

```bash
git add backend/src/websocket.ts backend/src/webhook.ts backend/src/index.ts
git commit -m "feat: add WebSocket server for real-time updates"
```

---

## Task 5: API Endpoints - Serve Data to Frontend

**Files:**
- Create: `backend/src/api.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create API endpoints**

```typescript
// backend/src/api.ts
import type { Hono } from 'hono'
import type { Context } from 'hono'
import db from './db.js'

export function setupAPI(app: Hono) {
  // Get all sessions with filters
  app.get('/api/sessions', (c: Context) => {
    const { hostname, status, date, search } = c.req.query()

    let query = 'SELECT * FROM sessions WHERE 1=1'
    const params: any[] = []

    if (hostname) {
      query += ' AND hostname = ?'
      params.push(hostname)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (date) {
      const startOfDay = new Date(date).getTime()
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000
      query += ' AND created_at >= ? AND created_at < ?'
      params.push(startOfDay, endOfDay)
    }

    if (search) {
      query += ' AND title LIKE ?'
      params.push(`%${search}%`)
    }

    query += ' ORDER BY updated_at DESC'

    const sessions = db.prepare(query).all(...params)
    return c.json(sessions)
  })

  // Get session details with timeline
  app.get('/api/sessions/:id', (c: Context) => {
    const id = c.req.param('id')

    // Get session
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)

    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    // Get timeline events
    const timeline = db.prepare(`
      SELECT * FROM timeline_events WHERE session_id = ? ORDER BY timestamp ASC
    `).all(id)

    return c.json({ session, timeline })
  })

  // Get token usage for analytics
  app.get('/api/analytics/tokens', (c: Context) => {
    const { startDate, endDate, hostname, model } = c.req.query()

    let query = 'SELECT * FROM token_usage WHERE 1=1'
    const params: any[] = []

    if (startDate) {
      const start = new Date(startDate).getTime()
      query += ' AND timestamp >= ?'
      params.push(start)
    }

    if (endDate) {
      const end = new Date(endDate).getTime()
      query += ' AND timestamp <= ?'
      params.push(end)
    }

    if (hostname) {
      query += ` AND session_id IN (SELECT id FROM sessions WHERE hostname = ?)`
      params.push(hostname)
    }

    if (model) {
      query += ' AND model_id = ?'
      params.push(model)
    }

    query += ' ORDER BY timestamp DESC'

    const usage = db.prepare(query).all(...params)
    return c.json(usage)
  })

  // Get model breakdown
  app.get('/api/analytics/models', (c: Context) => {
    const { startDate, endDate } = c.req.query()

    let query = `
      SELECT
        model_id,
        SUM(tokens_in + tokens_out) as total_tokens,
        SUM(cost) as total_cost,
        COUNT(*) as message_count
      FROM token_usage
      WHERE 1=1
    `
    const params: any[] = []

    if (startDate) {
      query += ' AND timestamp >= ?'
      params.push(new Date(startDate).getTime())
    }

    if (endDate) {
      query += ' AND timestamp <= ?'
      params.push(new Date(endDate).getTime())
    }

    query += ' GROUP BY model_id ORDER BY total_tokens DESC'

    const models = db.prepare(query).all(...params)
    return c.json(models)
  })

  // Get daily usage for calendar
  app.get('/api/analytics/daily', (c: Context) => {
    const { startDate, endDate } = c.req.query()

    // Default to last 30 days
    const end = endDate ? new Date(endDate).getTime() : Date.now()
    const start = startDate ? new Date(startDate).getTime() : end - 30 * 24 * 60 * 60 * 1000

    const query = `
      SELECT
        DATE(timestamp / 1000, 'unixepoch') as date,
        SUM(tokens_in + tokens_out) as total_tokens,
        SUM(cost) as total_cost,
        COUNT(*) as message_count
      FROM token_usage
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY DATE(timestamp / 1000, 'unixepoch')
      ORDER BY date ASC
    `

    const daily = db.prepare(query).all(start, end)
    return c.json(daily)
  })

  // Get instances
  app.get('/api/instances', (c: Context) => {
    const instances = db.prepare('SELECT * FROM instances ORDER BY hostname ASC').all()
    return c.json(instances)
  })

  // Get analytics summary
  app.get('/api/analytics/summary', (c: Context) => {
    const { startDate, endDate, hostname } = c.req.query()

    let query = `
      SELECT
        SUM(tokens_in + tokens_out) as total_tokens,
        SUM(cost) as total_cost,
        COUNT(DISTINCT session_id) as total_sessions
      FROM token_usage
      WHERE 1=1
    `
    const params: any[] = []

    if (startDate) {
      query += ' AND timestamp >= ?'
      params.push(new Date(startDate).getTime())
    }

    if (endDate) {
      query += ' AND timestamp <= ?'
      params.push(new Date(endDate).getTime())
    }

    if (hostname) {
      query += ` AND session_id IN (SELECT id FROM sessions WHERE hostname = ?)`
      params.push(hostname)
    }

    const summary = db.prepare(query).get(...params) as any
    return c.json(summary || { total_tokens: 0, total_cost: 0, total_sessions: 0 })
  })
}
```

**Step 2: Setup API in index.ts**

```typescript
// backend/src/index.ts (add import and setup)
import { setupAPI } from './api.js'

// ... after setupWebhook ...

setupAPI(app)
```

**Step 3: Test API endpoints**

Run: `bun run dev`

Test sessions: `curl http://localhost:3000/api/sessions`
Expected: `[]` (empty array, or sessions if exists)

Test analytics: `curl http://localhost:3000/api/analytics/summary`
Expected: `{"total_tokens":0,"total_cost":0,"total_sessions":0}`

**Step 4: Commit**

```bash
git add backend/src/api.ts backend/src/index.ts
git commit -m "feat: add API endpoints for sessions, analytics, and instances"
```

---

## Task 6: Frontend Setup - Vite + React + TypeScript

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Step 1: Create frontend package.json**

```json
{
  "name": "opencode-dashboard-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.22.0",
    "zustand": "^4.5.0",
    "recharts": "^2.12.0",
    "date-fns": "^3.3.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0"
  }
}
```

**Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

**Step 4: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 5: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenCode Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Step 7: Create App.tsx**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SessionsPage from './pages/SessionsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionsPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

**Step 8: Create base styles (index.css)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  background: hsl(0 0% 100%);
  foreground: hsl(240 10% 3.9%);
}

.dark {
  background: hsl(240 10% 3.9%);
  foreground: hsl(0 0% 98%);
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

**Step 9: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 10: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 11: Install dependencies**

Run: `cd frontend && npm install`
Expected: Dependencies installed successfully

**Step 12: Test frontend starts**

Run: `npm run dev`
Expected: Vite dev server on port 5173

**Step 13: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend with Vite, React, TypeScript, Tailwind"
```

---

## Task 7: Setup shadcn/ui Components

**Files:**
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/src/ui/button.tsx`
- Create: `frontend/src/ui/card.tsx`
- Create: `frontend/src/ui/select.tsx`
- Create: `frontend/src/ui/input.tsx`
- Create: `frontend/src/ui/badge.tsx`
- Create: `frontend/src/ui/dialog.tsx`
- Create: `frontend/src/ui/tabs.tsx`

**Step 1: Create utils for class merging**

```typescript
// frontend/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
```

**Step 2: Create Button component**

```typescript
// frontend/src/ui/button.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          variant === 'default' && 'bg-blue-600 text-white hover:bg-blue-700',
          variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
          variant === 'ghost' && 'hover:bg-gray-100 text-gray-900',
          variant === 'outline' && 'border border-gray-300 text-gray-900 hover:bg-gray-50',
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

**Step 3: Create Card component**

```typescript
// frontend/src/ui/card.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('bg-white dark:bg-gray-800 rounded-lg border shadow-sm', className)} {...props} />
  )
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

export const CardContent = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'
```

**Step 4: Create Input component**

```typescript
// frontend/src/ui/input.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'dark:bg-gray-700 dark:border-gray-600 dark:text-white',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
```

**Step 5: Create Badge component**

```typescript
// frontend/src/ui/badge.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'idle' | 'active' | 'error' | 'attention'
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantStyles = {
      default: 'bg-gray-100 text-gray-800',
      idle: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      attention: 'bg-orange-100 text-orange-800'
    }

    return (
      <div
        ref={ref}
        className={cn('px-2 py-1 rounded-full text-xs font-medium', variantStyles[variant], className)}
        {...props}
      />
    )
  }
)
Badge.displayName = 'Badge'
```

**Step 6: Create Dialog component**

```typescript
// frontend/src/ui/dialog.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export const Dialog = ({ open, onClose, children }: DialogProps) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        {children}
      </div>
    </div>
  )
}

export const DialogHeader = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn('p-6 border-b', className)}>{children}</div>
)
DialogHeader.displayName = 'DialogHeader'

export const DialogContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn('p-6', className)}>{children}</div>
)
DialogContent.displayName = 'DialogContent'
```

**Step 7: Create Select component**

```typescript
// frontend/src/ui/select.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
          'dark:bg-gray-700 dark:border-gray-600 dark:text-white',
          className
        )}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          ))}
      </select>
    )
  }
)
Select.displayName = 'Select'
```

**Step 8: Commit**

```bash
git add frontend/src/lib/frontend/src/ui/
git commit -m "feat: add shadcn/ui components (Button, Card, Input, Badge, Dialog, Select)"
```

---

## Task 8: WebSocket Client Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`

**Step 1: Create WebSocket hook**

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react'

interface WebSocketMessage {
  type: 'auth' | 'session.created' | 'session.updated' | 'timeline' | 'idle' | 'attention'
  success?: boolean
  error?: string
  data?: any
}

export function useWebSocket(
  password: string,
  onMessage: (message: WebSocketMessage) => void,
  connected?: (isConnected: boolean) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket('ws://localhost:3001')

    ws.onopen = () => {
      console.log('WebSocket connected')
      connected?.(true)

      // Send auth immediately
      ws.send(JSON.stringify({ type: 'auth', password }))
    }

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)

        if (message.type === 'auth') {
          if (message.success) {
            console.log('WebSocket authenticated')
          } else {
            console.error('WebSocket auth failed:', message.error)
            ws.close()
          }
        } else {
          onMessage(message)
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      connected?.(false)

      // Auto-reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 5000)
    }

    wsRef.current = ws
  }, [password, onMessage, connected])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { connect, disconnect }
}
```

**Step 2: Test hook (create temporary test file)**

```typescript
// frontend/src/test-socket.tsx (temporary, delete after testing)
import { useWebSocket } from './hooks/useWebSocket'

export default function TestSocket() {
  useWebSocket('test_password', (message) => {
    console.log('Received:', message)
  })

  return <div>WebSocket test - check console</div>
}
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/useWebSocket.ts
git commit -m "feat: add useWebSocket hook for real-time updates"
```

---

## Task 9: State Management with Zustand

**Files:**
- Create: `frontend/src/store/useStore.ts`

**Step 1: Create Zustand store**

```typescript
// frontend/src/store/useStore.ts
import { create } from 'zustand'

interface Session {
  id: string
  title: string
  hostname: string
  status: 'idle' | 'active' | 'error' | 'old'
  created_at: number
  updated_at: number
  needs_attention: boolean
  token_total: number
  cost_total: number
}

interface TimelineEvent {
  id: number
  session_id: string
  timestamp: number
  event_type: string
  summary: string
  tool_name?: string
  provider_id?: string
  model_id?: string
}

interface DashboardStore {
  sessions: Session[]
  selectedSession: Session | null
  timeline: Map<string, TimelineEvent[]>
  filters: {
    hostname: string | null
    status: string | null
    date: string | null
    search: string
  }
  theme: 'light' | 'dark' | 'system'

  // Actions
  setSessions: (sessions: Session[]) => void
  updateSession: (session: Session) => void
  addSession: (session: Session) => void
  selectSession: (session: Session | null) => void
  setTimeline: (sessionId: string, events: TimelineEvent[]) => void
  addTimelineEvent: (event: TimelineEvent) => void
  setFilters: (filters: Partial<DashboardStore['filters']>) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  // Get filtered sessions
  getFilteredSessions: () => Session[]
}

export const useStore = create<DashboardStore>((set, get) => ({
  sessions: [],
  selectedSession: null,
  timeline: new Map(),
  filters: {
    hostname: null,
    status: null,
    date: null,
    search: ''
  },
  theme: 'system',

  setSessions: (sessions) => set({ sessions }),

  updateSession: (session) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
    })),

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
    })),

  selectSession: (session) => set({ selectedSession: session }),

  setTimeline: (sessionId, events) =>
    set((state) => {
      const timeline = new Map(state.timeline)
      timeline.set(sessionId, events)
      return { timeline }
    }),

  addTimelineEvent: (event) =>
    set((state) => {
      const timeline = new Map(state.timeline)
      const events = timeline.get(event.session_id) || []
      timeline.set(event.session_id, [...events, event])
      return { timeline }
    }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  setTheme: (theme) => set({ theme }),

  getFilteredSessions: () => {
    const { sessions, filters } = get()

    return sessions.filter((session) => {
      if (filters.hostname && session.hostname !== filters.hostname) return false
      if (filters.status && session.status !== filters.status) return false
      if (filters.search && !session.title.toLowerCase().includes(filters.search.toLowerCase())) return false

      if (filters.date) {
        const sessionDate = new Date(session.created_at).toDateString()
        const filterDate = new Date(filters.date).toDateString()
        if (sessionDate !== filterDate) return false
      }

      return true
    })
  },
}))

// Selectors
export const useSessions = () => useStore((state) => state.sessions)
export const useFilteredSessions = () => useStore((state) => state.getFilteredSessions())
export const useSelectedSession = () => useStore((state) => state.selectedSession)
export const useFilters = () => useStore((state) => state.filters)
export const useTheme = () => useStore((state) => state.theme)
```

**Step 2: Commit**

```bash
git add frontend/src/store/useStore.ts
git commit -m "feat: add Zustand store for state management"
```

---

## Task 10: Sessions Page - Main Component

**Files:**
- Create: `frontend/src/pages/SessionsPage.tsx`
- Create: `frontend/src/components/SessionCard.tsx`
- Create: `frontend/src/components/SessionFilters.tsx`

**Step 1: Create SessionFilters component**

```typescript
// frontend/src/components/SessionFilters.tsx
import { useStore } from '@/store/useStore'
import { Input } from '@/ui/input'
import { Select } from '@/ui/select'
import { Search } from 'lucide-react'

export default function SessionFilters() {
  const { filters, setFilters } = useStore((state) => ({ filters: state.filters, setFilters: state.setFilters }))

  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium mb-2">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search sessions..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-10"
          />
        </div>
      </div>

      <div className="min-w-[150px]">
        <label className="block text-sm font-medium mb-2">Hostname</label>
        <Select
          value={filters.hostname || ''}
          onChange={(e) => setFilters({ hostname: e.target.value || null })}
          options={[
            { value: '', label: 'All Instances' },
            { value: 'vps1', label: 'VPS 1' },
            { value: 'vps2', label: 'VPS 2' },
          ]}
        />
      </div>

      <div className="min-w-[150px]">
        <label className="block text-sm font-medium mb-2">Status</label>
        <Select
          value={filters.status || ''}
          onChange={(e) => setFilters({ status: e.target.value || null })}
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'idle', label: 'Idle' },
            { value: 'error', label: 'Error' },
            { value: 'old', label: 'Old' },
          ]}
        />
      </div>

      <div className="min-w-[150px]">
        <label className="block text-sm font-medium mb-2">Date</label>
        <Input
          type="date"
          value={filters.date || ''}
          onChange={(e) => setFilters({ date: e.target.value || null })}
        />
      </div>
    </div>
  )
}
```

**Step 2: Create SessionCard component**

```typescript
// frontend/src/components/SessionCard.tsx
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { Session } from '@/store/useStore'
import { Activity, AlertTriangle, Clock, Server } from 'lucide-react'

interface SessionCardProps {
  session: Session
  onClick: () => void
  hasAttention?: boolean
  justUpdated?: boolean
}

export default function SessionCard({ session, onClick, hasAttention, justUpdated }: SessionCardProps) {
  const statusIcons = {
    active: <Activity className="h-4 w-4" />,
    idle: <Clock className="h-4 w-4" />,
    error: <AlertTriangle className="h-4 w-4" />,
    old: <Clock className="h-4 w-4 text-gray-400" />,
  }

  const glowClass = hasAttention
    ? 'ring-2 ring-orange-500 ring-offset-2 animate-pulse'
    : ''

  const flashClass = justUpdated
    ? 'bg-blue-50 dark:bg-blue-900/20'
    : ''

  return (
    <div
      onClick={onClick}
      className={`
        p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
        cursor-pointer hover:border-blue-500 dark:hover:border-blue-500
        transition-all ${glowClass} ${flashClass}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 dark:text-white flex-1 mr-2 line-clamp-1">
          {session.title}
        </h3>
        {hasAttention && (
          <Badge variant="attention">Needs Attention</Badge>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1">
          <Server className="h-3 w-3" />
          <span>{session.hostname}</span>
        </div>

        <div className="flex items-center gap-1">
          {statusIcons[session.status]}
          <Badge variant={session.status as any} className="ml-1">
            {session.status}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatRelativeTime(session.updated_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
        <div>Tokens: {session.token_total.toLocaleString()}</div>
        <div>Cost: ${session.cost_total.toFixed(4)}</div>
      </div>
    </div>
  )
}
```

**Step 3: Create SessionsPage component**

```typescript
// frontend/src/pages/SessionsPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useStore, useFilteredSessions, useSelectedSession } from '@/store/useStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import SessionCard from '@/components/SessionCard'
import SessionFilters from '@/components/SessionFilters'
import SessionDetail from '@/components/SessionDetail'
import { Button } from '@/ui/button'
import { Activity, BarChart3, Settings, Globe } from 'lucide-react'

export default function SessionsPage() {
  const { setSessions, addSession, updateSession, selectSession } = useStore()
  const sessions = useFilteredSessions()
  const selectedSession = useSelectedSession()

  const [password, setPassword] = useState('') // Get from localStorage or env
  const [justUpdated, setJustUpdated] = useState<Set<string>>(new Set())

  // Load password from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('opencode_dashboard_password')
    if (saved) setPassword(saved)
  }, [])

  // Fetch initial sessions
  useEffect(() => {
    async function fetchSessions() {
      const response = await fetch('/api/sessions')
      const data = await response.json()
      setSessions(data)
    }
    fetchSessions()
  }, [setSessions])

  // WebSocket connection
  useWebSocket(password, (message) => {
    switch (message.type) {
      case 'session.created':
        addSession(message.data)
        // Flash effect
        setJustUpdated(prev => new Set(prev).add(message.data.sessionId))
        setTimeout(() => {
          setJustUpdated(prev => {
            const next = new Set(prev)
            next.delete(message.data.sessionId)
            return next
          })
        }, 2000)
        break

      case 'session.updated':
        updateSession(message.data)
        break

      case 'idle':
        // Play sound
        playBeep()
        updateSession({ ...message.data, status: 'idle' })
        break

      case 'attention':
        updateSession({ ...message.data, needs_attention: message.data.needsAttention })
        if (message.data.needsAttention) {
          playBeep()
        }
        break

      case 'timeline':
        // Flash session card
        setJustUpdated(prev => new Set(prev).add(message.data.sessionId))
        setTimeout(() => {
          setJustUpdated(prev => {
            const next = new Set(prev)
            next.delete(message.data.sessionId)
            return next
          })
        }, 1000)
        break
    }
  })

  function playBeep() {
    const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU')
    audio.volume = 0.3
    audio.play().catch(() => {})
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Globe className="h-6 w-6" />
              OpenCode Dashboard
            </h1>
            <nav className="flex gap-2">
              <Button variant="default" asChild>
                <a href="/sessions">Sessions</a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="/analytics">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </a>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <SessionFilters />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onClick={() => selectSession(session)}
              hasAttention={session.needs_attention}
              justUpdated={justUpdated.has(session.id)}
            />
          ))}
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No sessions found
          </div>
        )}
      </main>

      {/* Session detail modal */}
      {selectedSession && <SessionDetail />}
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add frontend/src/pages/SessionsPage.tsx frontend/src/components/SessionCard.tsx frontend/src/components/SessionFilters.tsx
git commit -m "feat: add SessionsPage with filters and session cards"
```

---

## Task 11: Session Detail Modal

**Files:**
- Create: `frontend/src/components/SessionDetail.tsx`

**Step 1: Create SessionDetail component**

```typescript
// frontend/src/components/SessionDetail.tsx
import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { Dialog, DialogContent, DialogHeader } from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { formatRelativeTime } from '@/lib/utils'
import { X, Terminal, MessageSquare, AlertCircle, Lock, Activity } from 'lucide-react'

interface TimelineEvent {
  id: number
  session_id: string
  timestamp: number
  event_type: string
  summary: string
  tool_name?: string
}

export default function SessionDetail() {
  const { selectedSession, selectSession, timeline, setTimeline } = useStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedSession) return

    // Check if we already have timeline
    const existing = timeline.get(selectedSession.id)
    if (existing) return

    // Fetch timeline
    async function fetchTimeline() {
      setLoading(true)
      try {
        const response = await fetch(`/api/sessions/${selectedSession.id}`)
        const data = await response.json()
        setTimeline(selectedSession.id, data.timeline)
      } catch (error) {
        console.error('Failed to fetch timeline:', error)
      }
      setLoading(false)
    }

    fetchTimeline()
  }, [selectedSession, timeline, setTimeline])

  if (!selectedSession) return null

  const events = timeline.get(selectedSession.id) || []

  function getEventIcon(type: string) {
    switch (type) {
      case 'user':
        return <MessageSquare className="h-4 w-4 text-blue-500" />
      case 'tool':
        return <Terminal className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'permission':
        return <Lock className="h-4 w-4 text-orange-500" />
      case 'idle':
        return <Activity className="h-4 w-4 text-yellow-500" />
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-400" />
    }
  }

  return (
    <Dialog open={!!selectedSession} onClose={() => selectSession(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader className="flex items-center justify-between border-b pb-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold">{selectedSession.title}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <Badge>{selectedSession.hostname}</Badge>
              <Badge variant={selectedSession.status as any}>{selectedSession.status}</Badge>
              <span>{formatRelativeTime(selectedSession.updated_at)}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => selectSession(null)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {loading && <div>Loading timeline...</div>}

        {!loading && events.length === 0 && (
          <div className="text-center py-8 text-gray-500">No events recorded</div>
        )}

        {!loading && events.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 border-b pb-2">
              <div>Timeline</div>
              <div className="flex gap-4">
                <div>Tokens: {selectedSession.token_total.toLocaleString()}</div>
                <div>Cost: ${selectedSession.cost_total.toFixed(4)}</div>
              </div>
            </div>

            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="mt-0.5">{getEventIcon(event.event_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Badge variant="default" className="text-xs">
                        {event.event_type}
                      </Badge>
                      {event.tool_name && (
                        <span className="text-xs text-gray-500">{event.tool_name}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {event.summary}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {formatRelativeTime(event.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/SessionDetail.tsx
git commit -m "feat: add SessionDetail modal with timeline view"
```

---

## Task 12: Analytics Page with Charts

**Files:**
- Create: `frontend/src/pages/AnalyticsPage.tsx`
- Create: `frontend/src/components/analytics/TokenUsageChart.tsx`
- Create: `frontend/src/components/analytics/LineChart.tsx`
- Create: `frontend/src/components/analytics/PieChart.tsx`
- Create: `frontend/src/components/analytics/CalendarChart.tsx`
- Create: `frontend/src/components/analytics/StatCard.tsx`

**Step 1: Create StatCard component**

```typescript
// frontend/src/components/analytics/StatCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
}

export default function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Create Bar chart for token usage by model**

```typescript
// frontend/src/components/analytics/TokenUsageChart.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Data {
  model_id: string
  total_tokens: number
}

interface Props {
  data: Data[]
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function TokenUsageChart({ data }: Props) {
  return (
    <div className="h-80 w-full">
      <h3 className="text-lg font-semibold mb-4">Tokens by Model</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="model_id"
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fontSize: 10 }}
          />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), 'Tokens']}
          />
          <Bar dataKey="total_tokens">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Step 3: Create Line chart for usage over time**

```typescript
// frontend/src/components/analytics/LineChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

interface Data {
  date: string
  total_tokens: number
  total_cost: number
}

interface Props {
  data: Data[]
}

export default function UsageOverTimeChart({ data }: Props) {
  const chartData = data.map(d => ({
    ...d,
    formattedDate: format(new Date(d.date), 'MMM dd')
  }))

  return (
    <div className="h-80 w-full">
      <h3 className="text-lg font-semibold mb-4">Usage Over Time</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="formattedDate" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: number) => value.toLocaleString()}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="total_tokens"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Step 4: Create Pie chart for model distribution**

```typescript
// frontend/src/components/analytics/PieChart.tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Data {
  model_id: string
  total_tokens: number
}

interface Props {
  data: Data[]
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function ModelDistributionChart({ data }: Props) {
  return (
    <div className="h-80 w-full">
      <h3 className="text-lg font-semibold mb-4">Model Distribution</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total_tokens"
            nameKey="model_id"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ model_id, percent }) => `${model_id} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => value.toLocaleString()} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Step 5: Create GitHub-style calendar chart**

```typescript
// frontend/src/components/analytics/CalendarChart.tsx
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns'

interface Data {
  date: string
  total_tokens: number
}

interface Props {
  data: Data[]
}

export default function CalendarChart({ data }: Props) {
  const endDate = endOfMonth(new Date())
  const startDate = startOfMonth(subMonths(endDate, 11))

  const days = eachDayOfInterval({ start: startDate, end: endDate })
  const dataMap = new Map(data.map(d => [d.date, d.total_tokens]))

  const maxTokens = Math.max(...data.map(d => d.total_tokens), 1)

  function getColor(tokens: number): string {
    if (tokens === 0) return 'bg-gray-100 dark:bg-gray-800'
    const ratio = tokens / maxTokens
    if (ratio < 0.2) return 'bg-green-100 dark:bg-green-900'
    if (ratio < 0.4) return 'bg-green-200 dark:bg-green-800'
    if (ratio < 0.6) return 'bg-green-300 dark:bg-green-700'
    if (ratio < 0.8) return 'bg-green-400 dark:bg-green-600'
    return 'bg-green-500 dark:bg-green-500'
  }

  // Group by month
  const months: { month: string; days: Date[] }[] = []
  let currentMonth = ''

  days.forEach(day => {
    const month = format(day, 'MMM yyyy')
    if (month !== currentMonth) {
      months.push({ month, days: [] })
      currentMonth = month
    }
    months[months.length - 1].days.push(day)
  })

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Daily Usage (Last 12 Months)</h3>
      <div className="space-y-2">
        {months.map((monthBlock, mi) => (
          <div key={monthBlock.month} className="flex items-center gap-2">
            <div className="w-20 text-xs text-gray-500 dark:text-gray-400 shrink-0">
              {format(parseISO(monthBlock.month), 'MMM')}
            </div>
            <div className="flex-1 grid grid-cols-7 gap-0.5">
              {monthBlock.days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const tokens = dataMap.get(dateStr) || 0
                return (
                  <div
                    key={dateStr}
                    className={`
                      w-full aspect-square rounded-sm ${getColor(tokens)}
                      cursor-pointer
                      hover:ring-1 hover:ring-blue-500
                    `}
                    title={`${dateStr}: ${tokens.toLocaleString()} tokens`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 6: Create AnalyticsPage component**

```typescript
// frontend/src/pages/AnalyticsPage.tsx
import { useEffect, useState } from 'react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Select } from '@/ui/select'
import { Card, CardContent } from '@/ui/card'
import StatCard from '@/components/analytics/StatCard'
import TokenUsageChart from '@/components/analytics/TokenUsageChart'
import UsageOverTimeChart from '@/components/analytics/LineChart'
import ModelDistributionChart from '@/components/analytics/PieChart'
import CalendarChart from '@/components/analytics/CalendarChart'
import { BarChart3, Globe, Settings, Download, RefreshCw } from 'lucide-react'

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d')
  const [hostname, setHostname] = useState('')
  const [model, setModel] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [models, setModels] = useState<any[]>([])
  const [daily, setDaily] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [instances, setInstances] = useState<any[]>([])

  // Fetch data based on filters
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const endDate = new Date().toISOString().split('T')[0]
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        const [summaryRes, modelsRes, dailyRes, instancesRes] = await Promise.all([
          fetch(`/api/analytics/summary?startDate=${startDate}&endDate=${endDate}&hostname=${hostname}&model=${model}`),
          fetch(`/api/analytics/models?startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/analytics/daily?startDate=${startDate}&endDate=${endDate}`),
          fetch('/api/instances')
        ])

        setSummary(await summaryRes.json())
        setModels(await modelsRes.json())
        setDaily(await dailyRes.json())
        setInstances(await instancesRes.json())
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      }
      setLoading(false)
    }

    fetchData()
  }, [timeRange, hostname, model])

  // Calculate most used model
  const topModel = models.length > 0 ? models[0].model_id : 'None'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Analytics Dashboard
            </h1>
            <nav className="flex gap-2">
              <Button variant="ghost" asChild>
                <a href="/sessions">Sessions</a>
              </Button>
              <Button variant="default" asChild>
                <a href="/analytics">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </a>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[150px]">
                <label className="block text-sm font-medium mb-2">Time Range</label>
                <Select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  options={[
                    { value: '1d', label: 'Today' },
                    { value: '7d', label: 'Last 7 Days' },
                    { value: '30d', label: 'Last 30 Days' },
                    { value: '90d', label: 'Last 90 Days' },
                  ]}
                />
              </div>

              <div className="min-w-[200px]">
                <label className="block text-sm font-medium mb-2">Instance</label>
                <Select
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  options={[
                    { value: '', label: 'All Instances' },
                    ...instances.map(i => ({ value: i.hostname, label: i.hostname }))
                  ]}
                />
              </div>

              <div className="min-w-[150px]">
                <label className="block text-sm font-medium mb-2">Model</label>
                <Select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  options={[
                    { value: '', label: 'All Models' },
                    ...models.map(m => ({ value: m.model_id, label: m.model_id }))
                  ]}
                />
              </div>

              <div className="ml-auto flex items-end">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && <div>Loading...</div>}

        {!loading && summary && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Total Tokens"
                value={summary.total_tokens?.toLocaleString() || 0}
              />
              <StatCard
                title="Total Cost"
                value={`$${summary.total_cost?.toFixed(4) || '0.0000'}`}
              />
              <StatCard
                title="Sessions"
                value={summary.total_sessions || 0}
              />
              <StatCard
                title="Top Model"
                value={topModel}
                subtitle={`${models.length > 0 ? ((models[0].total_tokens / summary.total_tokens) * 100).toFixed(1) : 0}% of usage`}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardContent className="p-4">
                  <TokenUsageChart data={models} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <UsageOverTimeChart data={daily} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <ModelDistributionChart data={models} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <CalendarChart data={daily} />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
```

**Step 7: Commit**

```bash
git add frontend/src/pages/AnalyticsPage.tsx frontend/src/components/analytics/
git commit -m "feat: add AnalyticsPage with 4 chart types (bar, line, pie, calendar)"
```

---

## Task 13: Settings Page with Theme Switcher

**Files:**
- Create: `frontend/src/pages/SettingsPage.tsx`

**Step 1: Create SettingsPage component**

```typescript
// frontend/src/pages/SettingsPage.tsx
import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { Button } from '@/ui/button'
import { Select } from '@/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Globe, BarChart3, Settings } from 'lucide-react'

export default function SettingsPage() {
  const { theme, setTheme } = useStore((state) => ({ theme: state.theme, setTheme: state.setTheme }))

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isDark) root.classList.add('dark')
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const root = document.documentElement
      root.classList.toggle('dark', e.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Settings
            </h1>
            <nav className="flex gap-2">
              <Button variant="ghost" asChild>
                <a href="/sessions">Sessions</a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="/analytics">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </a>
              </Button>
              <Button variant="default" asChild>
                <a href="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </a>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Theme</label>
                <Select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                  options={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'system', label: 'System (Auto)' },
                  ]}
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">Theme Preview</h3>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-900 dark:text-white mb-2">
                    This is how your text will appear.
                  </p>
                  <Button>Button Example</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
```

**Step 2: Update vite.config.ts for path alias**

```typescript
// frontend/vite.config.ts (update)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@store': path.resolve(__dirname, './src/store'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

**Step 3: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/vite.config.ts
git commit -m "feat: add SettingsPage with theme switcher (light/dark/system)"
```

---

## Task 14: Password Authentication

**Files:**
- Create: `frontend/src/components/PasswordPrompt.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create PasswordPrompt component**

```typescript
// frontend/src/components/PasswordPrompt.tsx
import { useState, useEffect } from 'react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Card, CardContent } from '@/ui/card'
import { Lock } from 'lucide-react'

interface PasswordPromptProps {
  onAuthenticate: (password: string) => void
}

export default function PasswordPrompt({ onAuthenticate }: PasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if password is already saved
    const saved = localStorage.getItem('opencode_dashboard_password')
    if (saved) {
      onAuthenticate(saved)
    }
  }, [onAuthenticate])

  async function handleSubmit() {
    if (!password) {
      setError('Password is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Test password against backend
      const response = await fetch('/api/health', {
        headers: {
          'X-Password': password
        }
      })

      if (response.ok) {
        localStorage.setItem('opencode_dashboard_password', password)
        onAuthenticate(password)
      } else {
        setError('Invalid password')
      }
    } catch {
      // If backend check fails, still proceed (for development)
      localStorage.setItem('opencode_dashboard_password', password)
      onAuthenticate(password)
    }

    setLoading(false)
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full">
              <Lock className="h-8 w-8 text-blue-600 dark:text-blue-300" />
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">OpenCode Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your password to continue
              </p>
            </div>

            <div className="w-full space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? 'Verifying...' : 'Continue'}
            </Button>

            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
              Password is stored in your browser for convenience
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Update App.tsx to use password**

```typescript
// frontend/src/App.tsx
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PasswordPrompt from '@/components/PasswordPrompt'
import SessionsPage from '@/pages/SessionsPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import SettingsPage from '@/pages/SettingsPage'

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')

  if (!authenticated) {
    return <PasswordPrompt onAuthenticate={(pwd) => { setPassword(pwd); setAuthenticated(true) }} />
  }

  // Pass password to sessions page for WebSocket auth
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionsPage password={password} />} />
        <Route path="/sessions" element={<SessionsPage password={password} />} />
        <Route path="/analytics" element={<AnalyticsPage password={password} />} />
        <Route path="/settings" element={<SettingsPage password={password} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

**Step 3: Update page components to accept password prop**

Add password prop to each page's component signature.

**Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/PasswordPrompt.tsx frontend/src/pages/
git commit -m "feat: add password authentication on dashboard login"
```

---

## Task 15: Documentation & Deployment

**Files:**
- Create: `README.md`
- Create: `.dockerignore`
- Create: `docker-compose.yml` (optional)

**Step 1: Create comprehensive README**

```markdown
# OpenCode Dashboard

Real-time dashboard for monitoring OpenCode sessions across multiple VPS instances.

## Features

- **Sessions Page**: View all sessions across instances with real-time updates
- **Analytics Dashboard**: Token usage, costs, model distribution with 4 chart types
- **Settings**: Theme switcher (light/dark/system)
- **Real-time Updates**: WebSocket for live session monitoring
- **Sound Notifications**: Beep on session idle or permission requests

## Tech Stack

- **Backend**: Bun, Hono, SQLite, better-sqlite3, WebSocket
- **Frontend**: Vite, React, TypeScript, shadcn/ui, recharts, Zustand
- **Auth**: Simple password authentication via environment variable

## Setup

### Backend

```bash
cd backend
bun install
cp .env.example .env
# Edit .env to set BACKEND_PASSWORD
bun run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Plugin Configuration

Install the dashboard plugin in your OpenCode instances:

1. Copy `plugin/dashboard.ts` to `~/.config/opencode/plugin/dashboard.ts`
2. Configure `~/.config/opencode/dashboard.toml`:
   ```toml
   url = "http://your-backend-url:3000"
   apiKey = "your-api-key" # optional
   hostname = "vps-name"
   ```

3. Add to `~/.config/opencode/opencode.json`:
   ```json
   {
     "plugin": [
       "./plugin/dashboard"
     ]
   }
   ```

## Environment Variables

Backend (`.env`):
- `BACKEND_PORT` - API server port (default: 3000)
- `BACKEND_PASSWORD` - Dashboard password (required)
- `API_KEY` - Plugin API key (optional, for security)

## API Endpoints

- `POST /events` - Receive events from plugin
- `GET /api/sessions` - Get all sessions (supports filters)
- `GET /api/sessions/:id` - Get session with timeline
- `GET /api/analytics/tokens` - Get token usage data
- `GET /api/analytics/models` - Get model breakdown
- `GET /api/analytics/daily` - Get daily usage for calendar
- `GET /api/instances` - Get all instances
- `GET /api/analytics/summary` - Get analytics summary

## WebSocket

Connect to `ws://localhost:3001` and authenticate:
```json
{ "type": "auth", "password": "your_password" }
```

## Deployment

### Using Docker Compose

```bash
docker-compose up -d
```

### Manual Deployment

1. Build frontend: `cd frontend && npm run build`
2. Start backend: `cd backend && bun start`
3. Serve frontend from backend or nginx

## Development

- Backend: `cd backend && bun run dev`
- Frontend: `cd frontend && npm run dev`

## License

MIT
```

**Step 2: Update .env.example**

```env
# Backend
BACKEND_PORT=3000
BACKEND_PASSWORD=change_this_password
API_KEY=  # Optional: set to secure webhook endpoint

# Database
DATABASE_URL=./database.db
```

**Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "docs: add comprehensive README and deployment info"
```

---

## Final: Testing & Verification

**Manual Testing Checklist:**

1. ✅ Backend starts without errors
2. ✅ Database tables created correctly
3. ✅ Webhook endpoint receives plugin events
4. ✅ WebSocket connection authenticates
5. ✅ Sessions page lists sessions
6. ✅ Filters work (hostname, status, date, search)
7. ✅ Session detail modal shows timeline
8. ✅ Real-time updates via WebSocket
9. ✅ Sound notification plays on idle/permission
10. ✅ Analytics page loads charts
11. ✅ Analytics filters (time range, instance, model)
12. ✅ GitHub-style calendar displays correctly
13. ✅ Settings page theme switcher works
14. ✅ Password authentication required
15. ✅ Dark mode applies correctly

**Run linters (if configured):**

Backend: `bun test` (if tests exist)
Frontend: `npm run build` (to verify no TypeScript errors)

**Final commit:**

```bash
git add .
git commit -m "feat: OpenCode Dashboard complete - sessions, analytics, settings with real-time updates"
```

---

**Implementation complete! The dashboard is ready to receive events from the plugin and display them in real-time.**
