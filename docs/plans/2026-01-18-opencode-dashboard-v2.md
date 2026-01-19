# OpenCode Dashboard Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a stunning real-time dashboard that monitors OpenCode sessions across multiple VPS instances, showing session status, timeline events, and usage analytics.

**Architecture:** Plugin (existing) sends events to backend (Bun + Hono + SQLite) via POST; backend stores data and pushes updates via WebSocket; frontend (Vite + React + square-ui) displays sessions list with real-time updates, analytics dashboard with 4 chart types, and settings page with theme switcher.

**Tech Stack:**
- Backend: Bun, Hono, SQLite (bun:sqlite), WebSocket, bun:test
- Frontend: Bun, Vite, React, TypeScript, **square-ui** (from ln-dev7/square-ui), recharts, Zustand, date-fns, Vitest, @testing-library/react

**UI Libraries:**
- **Primary:** https://github.com/ln-dev7/square-ui
  - Use dashboard-1 template components: `StatCard`, `ChartCard`, `DashboardSidebar`
  - Use base UI: `button`, `input`, `table`, `sheet`, `tooltip`, `calendar`, `dropdown-menu`
  - Use `ThemeProvider` + `ThemeToggle` for dark/light mode
  
- **Animations/Glows:** https://github.com/karthikmudunuri/eldoraui
  - Use `AnimatedBadge` for attention-grabbing "needs_attention" states with pulsing effects
  - Use `TextShimmer` for important UI elements that need to draw attention
  - Install via: `bunx shadcn@latest add @eldoraui/animated-badge @eldoraui/text-shimmer`
  
**Documentation Lookup:**
- Use `zread` CLI tool to check Eldora UI docs: `zread search-doc karthikmudunuri/eldoraui "<component-name>"`
- Example: `zread search-doc karthikmudunuri/eldoraui animated-badge` to see component usage

---

## UI Design Requirements

**THE UI MUST LOOK GOOD AS HELL.**

Design principles:
- Clean, modern, minimal aesthetic (like Vercel/Linear)
- Proper spacing (`p-4`, `p-6`, `gap-4`, `gap-6`)
- Subtle borders (`border-border`)
- Smooth transitions (`transition-colors`, `transition-all`)
- Consistent rounded corners (`rounded-xl` for cards, `rounded-lg` for buttons)
- Proper dark mode support (not an afterthought)
- Responsive: mobile-first, then tablet, then desktop
- Micro-interactions: hover states, focus rings, loading skeletons
- Status colors must pop but not be garish

Visual hierarchy:
- Headers: `text-2xl font-semibold` (use `TextShimmer` for important sections)
- Subheaders: `text-lg font-medium`
- Body: `text-sm text-muted-foreground`
- Badges: small, rounded-full, color-coded
- Attention indicators: Use `AnimatedBadge` from Eldora UI for pulsing glow effects

---

## TDD Rules (MANDATORY)

Every implementation task MUST follow:

```
RED    → Write failing test first
VERIFY → Run test, confirm it FAILS correctly
GREEN  → Write MINIMAL code to pass
VERIFY → Run test, confirm it PASSES
COMMIT → git add && git commit
```

**No exceptions. No shortcuts. Delete code written before tests.**

Test commands:
- Backend: `bun test`
- Frontend: `bun test` (uses vitest)

---

## Task 1: Backend Project Setup

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`
- Create: `backend/src/index.test.ts`
- Create: `.env.example`

**Step 1: Create backend package.json**

```json
{
  "name": "opencode-dashboard-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test",
    "test:watch": "bun test --watch"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

**Step 3: Create .env.example**

```env
BACKEND_PORT=3000
BACKEND_PASSWORD=change_this_password
API_KEY=optional_webhook_key
DATABASE_URL=./data/database.db
```

**Step 4: Install dependencies**

Run: `cd backend && bun install`
Expected: Dependencies installed, no errors

**Step 5: RED - Write failing test for API root**

Create `backend/src/index.test.ts`:

```typescript
// Tests API root endpoint returns correct response
import { describe, it, expect } from 'bun:test'
import app from './index'

describe('API Root', () => {
  it('returns 200 with API name on GET /', async () => {
    const res = await app.fetch(new Request('http://localhost/'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OpenCode Dashboard API')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await app.fetch(new Request('http://localhost/unknown'))
    expect(res.status).toBe(404)
  })
})
```

**Step 6: VERIFY RED - Run test, expect FAIL**

Run: `cd backend && bun test`
Expected: FAIL - Cannot find module './index'

**Step 7: GREEN - Create minimal index.ts**

```typescript
// backend/src/index.ts
// Main API entry point - exports Hono app for Bun server
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Enable CORS for frontend
app.use('*', cors())

// Root endpoint - health check
app.get('/', (c) => c.text('OpenCode Dashboard API'))

// 404 handler
app.notFound((c) => c.text('Not Found', 404))

export default app
```

**Step 8: VERIFY GREEN - Run test, expect PASS**

Run: `cd backend && bun test`
Expected: PASS (2 tests)

**Step 9: Commit**

```bash
git add backend/
git commit -m "feat(backend): initialize project with Hono, add root endpoint tests"
```

---

## Task 2: Database Schema

**Files:**
- Create: `backend/src/db/schema.ts`
- Create: `backend/src/db/schema.test.ts`
- Create: `backend/src/db/index.ts`

**Step 1: RED - Write failing test for schema**

Create `backend/src/db/schema.test.ts`:

```typescript
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
```

**Step 2: VERIFY RED**

Run: `cd backend && bun test src/db/schema.test.ts`
Expected: FAIL - Cannot find module './schema'

**Step 3: GREEN - Create schema.ts**

```typescript
// backend/src/db/schema.ts
// Database schema initialization - creates all tables and indexes
import type { Database } from 'bun:sqlite'

export function initSchema(db: Database): void {
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL')

  // Sessions: tracks each OpenCode session
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

  // Timeline events: user messages, tool calls, errors
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
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `)

  // Token usage: tracks per-message token consumption
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
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `)

  // Instances: VPS hostnames
  db.exec(`
    CREATE TABLE IF NOT EXISTS instances (
      hostname TEXT PRIMARY KEY,
      last_seen INTEGER NOT NULL,
      sessions_count INTEGER DEFAULT 0
    )
  `)

  // Indexes for query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_timeline_session ON timeline_events(session_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_token_session ON token_usage(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status, updated_at);
  `)
}
```

**Step 4: VERIFY GREEN**

Run: `cd backend && bun test src/db/schema.test.ts`
Expected: PASS (5 tests)

**Step 5: Create db/index.ts (singleton export)**

```typescript
// backend/src/db/index.ts
// Database singleton - initializes once on import
import { Database } from 'bun:sqlite'
import { initSchema } from './schema'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

const dbPath = process.env.DATABASE_URL || './data/database.db'

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
initSchema(db)

export default db
```

**Step 6: Commit**

```bash
git add backend/src/db/
git commit -m "feat(backend): add SQLite schema with sessions, timeline, tokens, instances"
```

---

## Task 3: Webhook Endpoint - Receive Plugin Events

**Files:**
- Create: `backend/src/handlers/webhook.ts`
- Create: `backend/src/handlers/webhook.test.ts`
- Modify: `backend/src/index.ts`

**Step 1: RED - Write failing test for webhook**

Create `backend/src/handlers/webhook.test.ts`:

```typescript
// Tests webhook endpoint receives and stores plugin events
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { Database } from 'bun:sqlite'
import { initSchema } from '../db/schema'
import { createWebhookHandler } from './webhook'

describe('Webhook Handler', () => {
  let db: Database
  let app: Hono

  beforeEach(() => {
    db = new Database(':memory:')
    initSchema(db)
    app = new Hono()
    createWebhookHandler(app, db)
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
})
```

**Step 2: VERIFY RED**

Run: `cd backend && bun test src/handlers/webhook.test.ts`
Expected: FAIL - Cannot find module './webhook'

**Step 3: GREEN - Create webhook.ts**

```typescript
// backend/src/handlers/webhook.ts
// Webhook handler - receives events from OpenCode plugin
import type { Hono } from 'hono'
import type { Database } from 'bun:sqlite'

interface PluginEvent {
  type: string
  sessionId?: string
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

export function createWebhookHandler(app: Hono, db: Database) {
  app.post('/events', async (c) => {
    const event: PluginEvent = await c.req.json()
    const now = Date.now()

    try {
      switch (event.type) {
        case 'session.created':
          db.prepare(`
            INSERT OR REPLACE INTO sessions (id, title, hostname, status, created_at, updated_at)
            VALUES (?, ?, ?, 'active', ?, ?)
          `).run(event.sessionId, event.title || 'Untitled', event.hostname, event.timestamp, event.timestamp)
          
          // Upsert instance
          db.prepare(`
            INSERT INTO instances (hostname, last_seen) VALUES (?, ?)
            ON CONFLICT(hostname) DO UPDATE SET last_seen = ?
          `).run(event.hostname, now, now)
          break

        case 'session.updated':
          db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
            .run(event.title, event.timestamp, event.sessionId)
          break

        case 'session.idle':
          db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
            .run('idle', event.timestamp, event.sessionId)
          break

        case 'timeline':
          // Insert timeline event
          db.prepare(`
            INSERT INTO timeline_events (session_id, timestamp, event_type, summary, tool_name)
            VALUES (?, ?, ?, ?, ?)
          `).run(event.sessionId, event.timestamp, event.eventType, event.summary, event.tool)

          // Update session timestamp
          db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
            .run(event.timestamp, event.sessionId)

          // Set needs_attention on permission events
          if (event.eventType === 'permission') {
            db.prepare('UPDATE sessions SET needs_attention = 1 WHERE id = ?')
              .run(event.sessionId)
          }

          // Clear needs_attention on user message
          if (event.eventType === 'user') {
            db.prepare('UPDATE sessions SET needs_attention = 0, status = ? WHERE id = ?')
              .run('active', event.sessionId)
          }
          break

        case 'tokens':
          // Insert token record
          db.prepare(`
            INSERT INTO token_usage (session_id, tokens_in, tokens_out, cost, timestamp)
            VALUES (?, ?, ?, ?, ?)
          `).run(event.sessionId, event.tokensIn, event.tokensOut, event.cost, event.timestamp)

          // Update session totals
          const totalTokens = (event.tokensIn || 0) + (event.tokensOut || 0)
          db.prepare(`
            UPDATE sessions SET token_total = token_total + ?, cost_total = cost_total + ?, updated_at = ?
            WHERE id = ?
          `).run(totalTokens, event.cost || 0, event.timestamp, event.sessionId)
          break
      }

      return c.json({ success: true })
    } catch (error) {
      console.error('Webhook error:', error)
      return c.json({ error: 'Processing failed' }, 500)
    }
  })
}
```

**Step 4: VERIFY GREEN**

Run: `cd backend && bun test src/handlers/webhook.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add backend/src/handlers/
git commit -m "feat(backend): add webhook handler for plugin events"
```

---

## Task 4: WebSocket Server for Real-time Updates

**Files:**
- Create: `backend/src/websocket/server.ts`
- Create: `backend/src/websocket/server.test.ts`
- Modify: `backend/src/handlers/webhook.ts` (add broadcast calls)

**Step 1: RED - Write failing test**

Create `backend/src/websocket/server.test.ts`:

```typescript
// Tests WebSocket broadcast functionality
import { describe, it, expect } from 'bun:test'
import { WebSocketManager } from './server'

describe('WebSocket Manager', () => {
  it('adds client to set on register', () => {
    const manager = new WebSocketManager()
    const mockWs = { send: () => {}, readyState: 1 } as any
    
    manager.register(mockWs)
    expect(manager.clientCount).toBe(1)
  })

  it('removes client on unregister', () => {
    const manager = new WebSocketManager()
    const mockWs = { send: () => {}, readyState: 1 } as any
    
    manager.register(mockWs)
    manager.unregister(mockWs)
    expect(manager.clientCount).toBe(0)
  })

  it('broadcasts message to all connected clients', () => {
    const manager = new WebSocketManager()
    const received: string[] = []
    const mockWs1 = { send: (msg: string) => received.push(msg), readyState: 1 } as any
    const mockWs2 = { send: (msg: string) => received.push(msg), readyState: 1 } as any
    
    manager.register(mockWs1)
    manager.register(mockWs2)
    manager.broadcast({ type: 'test', data: { foo: 'bar' } })
    
    expect(received.length).toBe(2)
    expect(JSON.parse(received[0])).toEqual({ type: 'test', data: { foo: 'bar' } })
  })

  it('skips clients with closed connection', () => {
    const manager = new WebSocketManager()
    const received: string[] = []
    const openWs = { send: (msg: string) => received.push(msg), readyState: 1 } as any
    const closedWs = { send: () => {}, readyState: 3 } as any // CLOSED = 3
    
    manager.register(openWs)
    manager.register(closedWs)
    manager.broadcast({ type: 'test', data: {} })
    
    expect(received.length).toBe(1)
  })
})
```

**Step 2: VERIFY RED**

Run: `cd backend && bun test src/websocket/server.test.ts`
Expected: FAIL - Cannot find module './server'

**Step 3: GREEN - Create server.ts**

```typescript
// backend/src/websocket/server.ts
// WebSocket manager - handles client connections and broadcasting

interface BroadcastMessage {
  type: 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle'
  data: Record<string, unknown>
}

export class WebSocketManager {
  private clients = new Set<WebSocket>()

  get clientCount(): number {
    return this.clients.size
  }

  register(ws: WebSocket): void {
    this.clients.add(ws)
    console.log(`WS client connected (total: ${this.clientCount})`)
  }

  unregister(ws: WebSocket): void {
    this.clients.delete(ws)
    console.log(`WS client disconnected (total: ${this.clientCount})`)
  }

  broadcast(message: BroadcastMessage): void {
    const data = JSON.stringify(message)
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN = 1
        client.send(data)
      }
    }
  }

  // Convenience methods for specific event types
  broadcastSessionCreated(session: Record<string, unknown>): void {
    this.broadcast({ type: 'session.created', data: session })
  }

  broadcastTimeline(sessionId: string, eventType: string, summary: string): void {
    this.broadcast({ type: 'timeline', data: { sessionId, eventType, summary } })
  }

  broadcastAttention(sessionId: string, needsAttention: boolean): void {
    this.broadcast({ type: 'attention', data: { sessionId, needsAttention } })
  }
}

// Singleton instance
export const wsManager = new WebSocketManager()
```

**Step 4: VERIFY GREEN**

Run: `cd backend && bun test src/websocket/server.test.ts`
Expected: PASS (4 tests)

**Step 5: Update webhook.ts to broadcast events**

Add to top of `backend/src/handlers/webhook.ts`:

```typescript
import { wsManager } from '../websocket/server'
```

Add broadcast calls after each DB operation:

```typescript
// After session.created INSERT:
wsManager.broadcastSessionCreated({ id: event.sessionId, title: event.title, hostname: event.hostname })

// After timeline INSERT:
wsManager.broadcastTimeline(event.sessionId!, event.eventType!, event.summary || '')

// After permission needs_attention UPDATE:
wsManager.broadcastAttention(event.sessionId!, true)
```

**Step 6: Commit**

```bash
git add backend/src/websocket/ backend/src/handlers/webhook.ts
git commit -m "feat(backend): add WebSocket manager with broadcast support"
```

---

## Task 5: API Endpoints for Frontend

**Files:**
- Create: `backend/src/handlers/api.ts`
- Create: `backend/src/handlers/api.test.ts`
- Modify: `backend/src/index.ts`

**Step 1: RED - Write failing tests for API**

Create `backend/src/handlers/api.test.ts`:

```typescript
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
```

**Step 2: VERIFY RED**

Run: `cd backend && bun test src/handlers/api.test.ts`
Expected: FAIL - Cannot find module './api'

**Step 3: GREEN - Create api.ts**

```typescript
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
```

**Step 4: VERIFY GREEN**

Run: `cd backend && bun test src/handlers/api.test.ts`
Expected: PASS (7 tests)

**Step 5: Update index.ts to wire everything**

```typescript
// backend/src/index.ts (updated)
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import db from './db'
import { createWebhookHandler } from './handlers/webhook'
import { createApiHandler } from './handlers/api'
import { wsManager } from './websocket/server'

const app = new Hono()

app.use('*', cors())
app.get('/', (c) => c.text('OpenCode Dashboard API'))
app.get('/health', (c) => c.json({ status: 'ok', clients: wsManager.clientCount }))
app.notFound((c) => c.text('Not Found', 404))

// Register handlers
createWebhookHandler(app, db)
createApiHandler(app, db)

const port = parseInt(process.env.BACKEND_PORT || '3000')

// Start HTTP server
export default {
  port,
  fetch: app.fetch
}

// Start WebSocket server on port+1
Bun.serve({
  port: port + 1,
  fetch(req, server) {
    if (server.upgrade(req)) return
    return new Response('Upgrade required', { status: 426 })
  },
  websocket: {
    open(ws) { wsManager.register(ws) },
    close(ws) { wsManager.unregister(ws) },
    message(ws, msg) {
      // Handle auth if needed
      const data = JSON.parse(msg.toString())
      if (data.type === 'auth') {
        const valid = !process.env.BACKEND_PASSWORD || data.password === process.env.BACKEND_PASSWORD
        ws.send(JSON.stringify({ type: 'auth', success: valid }))
        if (!valid) ws.close()
      }
    }
  }
})

console.log(`API running on http://localhost:${port}`)
console.log(`WebSocket running on ws://localhost:${port + 1}`)
```

**Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat(backend): add REST API endpoints for sessions and analytics"
```

---

## Task 6: Frontend Project Setup with square-ui

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/src/test/setup.ts`

**Step 1: Create package.json with square-ui dependencies**

```json
{
  "name": "opencode-dashboard-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:watch": "vitest --watch"
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
    "lucide-react": "^0.344.0",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "next-themes": "^0.2.1",
    "motion": "^11.0.0",
    "@eldoraui/animated-badge": "latest",
    "@eldoraui/text-shimmer": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^14.2.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0",
    "vitest": "^1.3.0",
    "jsdom": "^24.0.0"
  }
}
```

**Step 2: Create vite.config.ts**

```typescript
// Vite config with React, path aliases, and test setup
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/events': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
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
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

**Step 4: Create tailwind.config.js (square-ui compatible)**

```javascript
// Tailwind config matching square-ui design tokens
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
```

**Step 5: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 6: Create index.css (square-ui CSS variables)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --border: 240 5.9% 90%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --border: 240 3.7% 15.9%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
  }
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

**Step 7: Create src/lib/utils.ts**

```typescript
// Utility functions - class merging and date formatting
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
```

**Step 8: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenCode Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 9: Create test setup**

```typescript
// frontend/src/test/setup.ts
import '@testing-library/jest-dom'
```

**Step 10: Install and verify**

Run: `cd frontend && bun install && bun run dev`
Expected: Vite starts on http://localhost:5173

**Step 11: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): initialize with Vite, React, Tailwind, square-ui tokens"
```

---

## Task 7: Copy Base UI Components from square-ui

**Source:** https://github.com/ln-dev7/square-ui/tree/master/templates/dashboard-1/components/ui

**Files to copy:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/input.tsx`
- Create: `frontend/src/components/ui/tooltip.tsx`
- Create: `frontend/src/components/ui/dropdown-menu.tsx`
- Create: `frontend/src/components/ui/separator.tsx`
- Create: `frontend/src/components/ui/skeleton.tsx`
- Create: `frontend/src/components/ui/sheet.tsx`
- Create: `frontend/src/components/ui/table.tsx`

**Step 1: Create button.tsx (square-ui style)**

```typescript
// frontend/src/components/ui/button.tsx
// Button component with variants - from square-ui
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-background hover:bg-muted',
        secondary: 'bg-muted text-foreground hover:bg-muted/80',
        ghost: 'hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

**Step 2: Create input.tsx**

```typescript
// frontend/src/components/ui/input.tsx
// Input component - from square-ui
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
```

**Step 3: Create skeleton.tsx (for loading states)**

```typescript
// frontend/src/components/ui/skeleton.tsx
// Loading skeleton - from square-ui
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
```

**Step 4: Create separator.tsx**

```typescript
// frontend/src/components/ui/separator.tsx
// Visual separator - from square-ui
import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      className
    )}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
```

**Step 5: Create tooltip.tsx**

```typescript
// frontend/src/components/ui/tooltip.tsx
// Tooltip component - from square-ui
import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95',
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

**Step 6: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat(frontend): add base UI components from square-ui"
```

---

## Task 8: Dashboard Components (StatCard, Badge, Card)

**Files:**
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/dashboard/stat-card.tsx`
- Create: `frontend/src/components/dashboard/stat-card.test.tsx`

**Step 1: Create card.tsx**

```typescript
// frontend/src/components/ui/card.tsx
// Card container component - from square-ui pattern
import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border border-border bg-card text-card-foreground', className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardContent }
```

**Step 2: Create badge.tsx**

```typescript
// frontend/src/components/ui/badge.tsx
// Status badge with color variants
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        idle: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        attention: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse',
        old: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
)
Badge.displayName = 'Badge'

export { Badge, badgeVariants }
```

**Step 3: RED - Write failing test for StatCard**

Create `frontend/src/components/dashboard/stat-card.test.tsx`:

```typescript
// Tests StatCard renders title, value, and icon correctly
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './stat-card'

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Tokens" value="1,234,567" icon="tokens" />)
    
    expect(screen.getByText('Total Tokens')).toBeInTheDocument()
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<StatCard title="Cost" value="$12.34" icon="cost" subtitle="+5% from last week" />)
    
    expect(screen.getByText('+5% from last week')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <StatCard title="Test" value="123" icon="sessions" className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
```

**Step 4: VERIFY RED**

Run: `cd frontend && bun test` src/components/dashboard/stat-card.test.tsx`
Expected: FAIL - Cannot find module './stat-card'

**Step 5: GREEN - Create stat-card.tsx (square-ui pattern)**

```typescript
// frontend/src/components/dashboard/stat-card.tsx
// Stat card for analytics - based on square-ui StatCard
import { Coins, DollarSign, Activity, Server, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconMap: Record<string, LucideIcon> = {
  tokens: Coins,
  cost: DollarSign,
  sessions: Activity,
  instances: Server,
}

interface StatCardProps {
  title: string
  value: string | number
  icon: keyof typeof iconMap
  subtitle?: string
  className?: string
}

export function StatCard({ title, value, icon, subtitle, className }: StatCardProps) {
  const Icon = iconMap[icon]

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border border-border bg-card p-4',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-medium text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="flex size-14 items-center justify-center rounded-lg bg-muted border border-border">
          <Icon className="size-7 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
```

**Step 6: VERIFY GREEN**

Run: `cd frontend && bun test` src/components/dashboard/stat-card.test.tsx`
Expected: PASS (3 tests)

**Step 7: Commit**

```bash
git add frontend/src/components/
git commit -m "feat(frontend): add Card, Badge, StatCard components"
```

---

## Task 9: Install Eldora UI Components

**Files:**
- Modify: `frontend/package.json` (already updated with deps)
- Run: shadcn install commands

**Step 1: Initialize shadcn CLI**

```bash
cd frontend
bunx shadcn@latest init
```

**Step 2: Install Eldora UI AnimatedBadge**

```bash
bunx shadcn@latest add @eldoraui/animated-badge
```

Expected: Creates `frontend/src/components/eldoraui/animated-badge.tsx`

**Step 3: Install Eldora UI TextShimmer (optional for attention-grabbing headers)**

```bash
bunx shadcn@latest add @eldoraui/text-shimmer
```

Expected: Creates `frontend/src/components/eldoraui/text-shimmer.tsx`

**Step 4: Document lookup for Eldora UI components**

Use `zread` CLI to check component documentation:

```bash
# Check AnimatedBadge usage and examples
zread search-doc karthikmudunuri/eldoraui animated-badge

# Check TextShimmer usage and examples
zread search-doc karthikmudunuri/eldoraui text-shimmer

# View all animation components available
zread search-doc karthikmudunuri/eldoraui animation
```

**Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): install Eldora UI AnimatedBadge and TextShimmer components"
```

---

## Task 10: Zustand Store

**Files:**
- Create: `frontend/src/store/index.ts`
- Create: `frontend/src/store/index.test.ts`

**Note:** Task numbers have shifted due to Eldora UI installation (Task 9)

**Step 1: RED - Write failing test for store**

```typescript
// frontend/src/store/index.test.ts
// Tests Zustand store actions and selectors
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './index'

describe('Dashboard Store', () => {
  beforeEach(() => {
    useStore.setState({
      sessions: [],
      selectedSession: null,
      filters: { hostname: null, status: null, search: '' },
      theme: 'system'
    })
  })

  it('setSessions replaces session list', () => {
    const sessions = [{ id: 's1', title: 'Test', hostname: 'vps1', status: 'active' }]
    useStore.getState().setSessions(sessions as any)
    
    expect(useStore.getState().sessions).toHaveLength(1)
    expect(useStore.getState().sessions[0].id).toBe('s1')
  })

  it('updateSession modifies existing session', () => {
    useStore.setState({ sessions: [{ id: 's1', title: 'Old', status: 'active' }] as any })
    useStore.getState().updateSession({ id: 's1', title: 'New' } as any)
    
    expect(useStore.getState().sessions[0].title).toBe('New')
  })

  it('setFilters merges filter values', () => {
    useStore.getState().setFilters({ hostname: 'vps1' })
    useStore.getState().setFilters({ status: 'idle' })
    
    expect(useStore.getState().filters.hostname).toBe('vps1')
    expect(useStore.getState().filters.status).toBe('idle')
  })

  it('getFilteredSessions applies hostname filter', () => {
    useStore.setState({
      sessions: [
        { id: 's1', hostname: 'vps1', title: 'A', status: 'active' },
        { id: 's2', hostname: 'vps2', title: 'B', status: 'active' }
      ] as any,
      filters: { hostname: 'vps1', status: null, search: '' }
    })
    
    const filtered = useStore.getState().getFilteredSessions()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].hostname).toBe('vps1')
  })

  it('getFilteredSessions applies search filter', () => {
    useStore.setState({
      sessions: [
        { id: 's1', hostname: 'vps1', title: 'Fix bug', status: 'active' },
        { id: 's2', hostname: 'vps1', title: 'Add feature', status: 'active' }
      ] as any,
      filters: { hostname: null, status: null, search: 'bug' }
    })
    
    const filtered = useStore.getState().getFilteredSessions()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toContain('bug')
  })
})
```

**Step 2: VERIFY RED**

Run: `cd frontend && bun test` src/store/index.test.ts`
Expected: FAIL - Cannot find module './index'

**Step 3: GREEN - Create store**

```typescript
// frontend/src/store/index.ts
// Zustand store for global state management
import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  hostname: string
  directory?: string
  status: 'active' | 'idle' | 'error' | 'old'
  created_at: number
  updated_at: number
  needs_attention: number
  token_total: number
  cost_total: number
}

export interface TimelineEvent {
  id: number
  session_id: string
  timestamp: number
  event_type: string
  summary: string
  tool_name?: string
}

interface Filters {
  hostname: string | null
  status: string | null
  search: string
}

interface DashboardStore {
  // State
  sessions: Session[]
  selectedSession: Session | null
  timeline: Map<string, TimelineEvent[]>
  filters: Filters
  theme: 'light' | 'dark' | 'system'
  wsConnected: boolean

  // Actions
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (session: Partial<Session> & { id: string }) => void
  selectSession: (session: Session | null) => void
  setTimeline: (sessionId: string, events: TimelineEvent[]) => void
  setFilters: (filters: Partial<Filters>) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setWsConnected: (connected: boolean) => void
  getFilteredSessions: () => Session[]
}

export const useStore = create<DashboardStore>((set, get) => ({
  sessions: [],
  selectedSession: null,
  timeline: new Map(),
  filters: { hostname: null, status: null, search: '' },
  theme: 'system',
  wsConnected: false,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => set((s) => ({ 
    sessions: [session, ...s.sessions] 
  })),

  updateSession: (update) => set((s) => ({
    sessions: s.sessions.map((sess) =>
      sess.id === update.id ? { ...sess, ...update } : sess
    ),
  })),

  selectSession: (session) => set({ selectedSession: session }),

  setTimeline: (sessionId, events) => set((s) => {
    const timeline = new Map(s.timeline)
    timeline.set(sessionId, events)
    return { timeline }
  }),

  setFilters: (filters) => set((s) => ({
    filters: { ...s.filters, ...filters },
  })),

  setTheme: (theme) => set({ theme }),

  setWsConnected: (wsConnected) => set({ wsConnected }),

  getFilteredSessions: () => {
    const { sessions, filters } = get()
    return sessions.filter((s) => {
      if (filters.hostname && s.hostname !== filters.hostname) return false
      if (filters.status && s.status !== filters.status) return false
      if (filters.search && !s.title.toLowerCase().includes(filters.search.toLowerCase())) return false
      return true
    })
  },
}))
```

**Step 4: VERIFY GREEN**

Run: `cd frontend && bun test` src/store/index.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add frontend/src/store/
git commit -m "feat(frontend): add Zustand store with filters and selectors"
```

---

## Task 11: WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/hooks/useWebSocket.test.ts`

**Step 1: RED - Write failing test**

```typescript
// frontend/src/hooks/useWebSocket.test.ts
// Tests WebSocket hook message handling
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  readyState = 1
  send = vi.fn()
  close = vi.fn()

  constructor() {
    MockWebSocket.instances.push(this)
    setTimeout(() => this.onopen?.(), 0)
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  it('sends auth message on connect', async () => {
    const onMessage = vi.fn()
    renderHook(() => useWebSocket('test-password', onMessage))

    await new Promise((r) => setTimeout(r, 10))
    const ws = MockWebSocket.instances[0]
    
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"auth"')
    )
  })

  it('calls onMessage for non-auth messages', async () => {
    const onMessage = vi.fn()
    renderHook(() => useWebSocket('test', onMessage))

    await new Promise((r) => setTimeout(r, 10))
    const ws = MockWebSocket.instances[0]

    ws.onmessage?.({ data: JSON.stringify({ type: 'session.created', data: { id: 's1' } }) })
    
    expect(onMessage).toHaveBeenCalledWith({ type: 'session.created', data: { id: 's1' } })
  })
})
```

**Step 2: VERIFY RED**

Run: `cd frontend && bun test` src/hooks/useWebSocket.test.ts`
Expected: FAIL - Cannot find module './useWebSocket'

**Step 3: GREEN - Create useWebSocket.ts**

```typescript
// frontend/src/hooks/useWebSocket.ts
// WebSocket hook for real-time updates
import { useEffect, useRef, useCallback } from 'react'

interface WSMessage {
  type: 'auth' | 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle'
  success?: boolean
  data?: Record<string, unknown>
}

export function useWebSocket(
  password: string,
  onMessage: (msg: WSMessage) => void,
  onConnectionChange?: (connected: boolean) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = `ws://${window.location.hostname}:3001`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      onConnectionChange?.(true)
      ws.send(JSON.stringify({ type: 'auth', password }))
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.type === 'auth') {
          if (!msg.success) {
            console.error('WS auth failed')
            ws.close()
          }
        } else {
          onMessage(msg)
        }
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      onConnectionChange?.(false)
      // Reconnect after 5s
      reconnectRef.current = setTimeout(connect, 5000)
    }

    wsRef.current = ws
  }, [password, onMessage, onConnectionChange])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { reconnect: connect }
}
```

**Step 4: VERIFY GREEN**

Run: `cd frontend && bun test` src/hooks/useWebSocket.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat(frontend): add useWebSocket hook with auto-reconnect"
```

---

## Task 12: SessionCard Component

**Files:**
- Create: `frontend/src/components/sessions/session-card.tsx`
- Create: `frontend/src/components/sessions/session-card.test.tsx`

**Step 1: RED - Write failing test**

```typescript
// frontend/src/components/sessions/session-card.test.tsx
// Tests SessionCard displays session info correctly
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionCard } from './session-card'

const mockSession = {
  id: 's1',
  title: 'Fix authentication bug',
  hostname: 'vps1',
  status: 'active' as const,
  created_at: Date.now() - 3600000,
  updated_at: Date.now() - 60000,
  needs_attention: 0,
  token_total: 15000,
  cost_total: 0.45,
}

describe('SessionCard', () => {
  it('renders session title and hostname', () => {
    render(<SessionCard session={mockSession} onClick={() => {}} />)
    
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    expect(screen.getByText('vps1')).toBeInTheDocument()
  })

  it('shows status badge with correct variant', () => {
    render(<SessionCard session={mockSession} onClick={() => {}} />)
    
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows attention indicator when needs_attention is 1', () => {
    const attentionSession = { ...mockSession, needs_attention: 1 }
    render(<SessionCard session={attentionSession} onClick={() => {}} />)
    
    expect(screen.getByText('Needs Attention')).toBeInTheDocument()
  })

  it('displays token count and cost', () => {
    render(<SessionCard session={mockSession} onClick={() => {}} />)
    
    expect(screen.getByText(/15,000/)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.45/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<SessionCard session={mockSession} onClick={handleClick} />)
    
    fireEvent.click(screen.getByRole('article'))
    expect(handleClick).toHaveBeenCalled()
  })

  it('applies flash class when justUpdated is true', () => {
    const { container } = render(
      <SessionCard session={mockSession} onClick={() => {}} justUpdated />
    )
    
    expect(container.firstChild).toHaveClass('ring-2')
  })
})
```

**Step 2: VERIFY RED**

Run: `cd frontend && bun test` src/components/sessions/session-card.test.tsx`
Expected: FAIL - Cannot find module './session-card'

**Step 3: GREEN - Create session-card.tsx**

**Documentation Check Before Implementation:**
```bash
# Use zread to verify Eldora UI AnimatedBadge API
zread search-doc karthikmudunuri/eldoraui animated-badge
```
Review component props: `text`, `color`, `href`, `className`

```typescript
// frontend/src/components/sessions/session-card.tsx
// Session card - displays session info with status and metrics
import { Activity, Clock, Server, AlertTriangle, Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import AnimatedBadge from '@eldoraui/animated-badge'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session } from '@/store'

interface SessionCardProps {
  session: Session
  onClick: () => void
  justUpdated?: boolean
}

export function SessionCard({ session, onClick, justUpdated }: SessionCardProps) {
  const statusIcon = {
    active: <Activity className="size-3.5 text-green-500" />,
    idle: <Clock className="size-3.5 text-yellow-500" />,
    error: <AlertTriangle className="size-3.5 text-red-500" />,
    old: <Clock className="size-3.5 text-gray-400" />,
  }

  const needsAttention = session.needs_attention === 1

  return (
    <article
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-xl border border-border bg-card p-4 transition-all',
        'hover:border-primary/50 hover:shadow-md',
        justUpdated && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background',
        needsAttention && 'border-orange-500/50 shadow-orange-500/10 shadow-lg'
      )}
    >
      {/* Header: Title + Eldora UI AnimatedBadge for attention */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {session.title}
        </h3>
        {needsAttention && (
          <AnimatedBadge 
            text="Needs Attention"
            color="#f97316"
            className="shrink-0"
          />
        )}
      </div>

      {/* Meta: Hostname + Status + Time */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
        <div className="flex items-center gap-1.5">
          <Server className="size-3.5" />
          <span>{session.hostname}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {statusIcon[session.status]}
          <Badge variant={session.status}>{session.status}</Badge>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Clock className="size-3.5" />
          <span>{formatRelativeTime(session.updated_at)}</span>
        </div>
      </div>

      {/* Footer: Tokens + Cost */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <Coins className="size-3.5" />
          <span>{session.token_total.toLocaleString()} tokens</span>
        </div>
        <div className="ml-auto font-medium">
          ${session.cost_total.toFixed(2)}
        </div>
      </div>
    </article>
  )
}
```

**Step 4: VERIFY GREEN**

Run: `cd frontend && bun test` src/components/sessions/session-card.test.tsx`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add frontend/src/components/sessions/
git commit -m "feat(frontend): add SessionCard component with status badges"
```

---

## Task 12: SessionFilters Component

**Files:**
- Create: `frontend/src/components/sessions/session-filters.tsx`
- Create: `frontend/src/components/sessions/session-filters.test.tsx`

**Step 1: RED - Write failing test**

```typescript
// frontend/src/components/sessions/session-filters.test.tsx
// Tests filter inputs update store correctly
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionFilters } from './session-filters'
import { useStore } from '@/store'

describe('SessionFilters', () => {
  beforeEach(() => {
    useStore.setState({ filters: { hostname: null, status: null, search: '' } })
  })

  it('renders search input', () => {
    render(<SessionFilters instances={[]} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('updates search filter on input', () => {
    render(<SessionFilters instances={[]} />)
    
    const input = screen.getByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'bug fix' } })
    
    expect(useStore.getState().filters.search).toBe('bug fix')
  })

  it('renders hostname dropdown with instances', () => {
    render(<SessionFilters instances={['vps1', 'vps2']} />)
    
    expect(screen.getByText('All Instances')).toBeInTheDocument()
  })

  it('renders status dropdown', () => {
    render(<SessionFilters instances={[]} />)
    
    expect(screen.getByText('All Status')).toBeInTheDocument()
  })
})
```

**Step 2: VERIFY RED**

Run: `cd frontend && bun test` src/components/sessions/session-filters.test.tsx`
Expected: FAIL - Cannot find module './session-filters'

**Step 3: GREEN - Create session-filters.tsx**

```typescript
// frontend/src/components/sessions/session-filters.tsx
// Filter bar for sessions list
import { Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'

interface SessionFiltersProps {
  instances: string[]
}

export function SessionFilters({ instances }: SessionFiltersProps) {
  const { filters, setFilters } = useStore()

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border bg-card mb-6">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search sessions..."
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Hostname filter */}
      <select
        value={filters.hostname || ''}
        onChange={(e) => setFilters({ hostname: e.target.value || null })}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm min-w-[150px]"
      >
        <option value="">All Instances</option>
        {instances.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={filters.status || ''}
        onChange={(e) => setFilters({ status: e.target.value || null })}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm min-w-[130px]"
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="idle">Idle</option>
        <option value="error">Error</option>
        <option value="old">Old</option>
      </select>

      {/* Clear filters */}
      {(filters.hostname || filters.status || filters.search) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ hostname: null, status: null, search: '' })}
        >
          Clear
        </Button>
      )}
    </div>
  )
}
```

**Step 4: VERIFY GREEN**

Run: `cd frontend && bun test` src/components/sessions/session-filters.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add frontend/src/components/sessions/session-filters.tsx frontend/src/components/sessions/session-filters.test.tsx
git commit -m "feat(frontend): add SessionFilters with search and dropdowns"
```

---

## Task 13: SessionsPage

**Files:**
- Create: `frontend/src/pages/sessions-page.tsx`
- Create: `frontend/src/pages/sessions-page.test.tsx`

**Step 1: RED - Write failing test**

```typescript
// frontend/src/pages/sessions-page.test.tsx
// Tests SessionsPage renders sessions and handles real-time updates
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SessionsPage } from './sessions-page'
import { useStore } from '@/store'

// Mock fetch
global.fetch = vi.fn()

describe('SessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStore.setState({ sessions: [], filters: { hostname: null, status: null, search: '' } })
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 's1', title: 'Session 1', hostname: 'vps1', status: 'active', token_total: 1000, cost_total: 0.05, updated_at: Date.now(), needs_attention: 0 }
      ])
    })
  })

  it('fetches and displays sessions on mount', async () => {
    render(<SessionsPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument()
    })
  })

  it('shows empty state when no sessions', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    
    render(<SessionsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/no sessions/i)).toBeInTheDocument()
    })
  })

  it('renders filter bar', () => {
    render(<SessionsPage />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })
})
```

**Step 2: VERIFY RED**

Run: `cd frontend && bun test` src/pages/sessions-page.test.tsx`
Expected: FAIL - Cannot find module './sessions-page'

**Step 3: GREEN - Create sessions-page.tsx**

```typescript
// frontend/src/pages/sessions-page.tsx
// Main sessions list page with real-time updates
import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/store'
import { useWebSocket } from '@/hooks/useWebSocket'
import { SessionCard } from '@/components/sessions/session-card'
import { SessionFilters } from '@/components/sessions/session-filters'
import { SessionDetail } from '@/components/sessions/session-detail'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Wifi, WifiOff } from 'lucide-react'

export function SessionsPage() {
  const { setSessions, addSession, updateSession, selectSession, getFilteredSessions, wsConnected, setWsConnected } = useStore()
  const sessions = getFilteredSessions()
  const selectedSession = useStore((s) => s.selectedSession)

  const [loading, setLoading] = useState(true)
  const [instances, setInstances] = useState<string[]>([])
  const [recentUpdates, setRecentUpdates] = useState<Set<string>>(new Set())

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [sessionsRes, instancesRes] = await Promise.all([
          fetch('/api/sessions'),
          fetch('/api/instances')
        ])
        const sessionsData = await sessionsRes.json()
        const instancesData = await instancesRes.json()
        
        setSessions(sessionsData)
        setInstances(instancesData.map((i: any) => i.hostname))
      } catch (err) {
        console.error('Failed to fetch:', err)
      }
      setLoading(false)
    }
    fetchData()
  }, [setSessions])

  // Flash effect for updated sessions
  const flashSession = useCallback((id: string) => {
    setRecentUpdates((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setRecentUpdates((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 2000)
  }, [])

  // Play notification sound
  const playSound = useCallback(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==')
    audio.volume = 0.3
    audio.play().catch(() => {})
  }, [])

  // Handle WebSocket messages
  const handleWSMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'session.created':
        addSession(msg.data)
        flashSession(msg.data.id)
        break
      case 'session.updated':
        updateSession(msg.data)
        flashSession(msg.data.id)
        break
      case 'timeline':
        flashSession(msg.data.sessionId)
        break
      case 'attention':
        updateSession({ id: msg.data.sessionId, needs_attention: msg.data.needsAttention ? 1 : 0 })
        if (msg.data.needsAttention) playSound()
        break
      case 'idle':
        updateSession({ id: msg.data.sessionId, status: 'idle' })
        playSound()
        break
    }
  }, [addSession, updateSession, flashSession, playSound])

  // WebSocket connection
  const password = localStorage.getItem('dashboard_password') || ''
  useWebSocket(password, handleWSMessage, setWsConnected)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="size-6 text-primary" />
            <h1 className="text-xl font-semibold">Sessions</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {wsConnected ? (
              <><Wifi className="size-4 text-green-500" /> Connected</>
            ) : (
              <><WifiOff className="size-4 text-red-500" /> Disconnected</>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <SessionFilters instances={instances} />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Activity className="size-12 mx-auto mb-4 opacity-50" />
            <p>No sessions found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => selectSession(session)}
                justUpdated={recentUpdates.has(session.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail modal */}
      {selectedSession && <SessionDetail />}
    </div>
  )
}
```

**Step 4: VERIFY GREEN**

Run: `cd frontend && bun test` src/pages/sessions-page.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add frontend/src/pages/sessions-page.tsx frontend/src/pages/sessions-page.test.tsx
git commit -m "feat(frontend): add SessionsPage with real-time WebSocket updates"
```

---

## Task 14: SessionDetail Modal

**Files:**
- Create: `frontend/src/components/sessions/session-detail.tsx`
- Create: `frontend/src/components/sessions/session-detail.test.tsx`

**Step 1: RED - Write failing test**

```typescript
// frontend/src/components/sessions/session-detail.test.tsx
// Tests session detail modal displays timeline
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SessionDetail } from './session-detail'
import { useStore } from '@/store'

global.fetch = vi.fn()

const mockSession = {
  id: 's1', title: 'Test Session', hostname: 'vps1', status: 'active' as const,
  created_at: Date.now(), updated_at: Date.now(), needs_attention: 0,
  token_total: 5000, cost_total: 0.15
}

describe('SessionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStore.setState({ selectedSession: mockSession, timeline: new Map() })
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        session: mockSession,
        timeline: [
          { id: 1, session_id: 's1', timestamp: Date.now(), event_type: 'user', summary: 'Hello' },
          { id: 2, session_id: 's1', timestamp: Date.now(), event_type: 'tool', summary: 'Read file', tool_name: 'Read' }
        ]
      })
    })
  })

  it('renders session title', async () => {
    render(<SessionDetail />)
    expect(screen.getByText('Test Session')).toBeInTheDocument()
  })

  it('fetches and displays timeline events', async () => {
    render(<SessionDetail />)
    
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Read file')).toBeInTheDocument()
    })
  })

  it('shows event type badges', async () => {
    render(<SessionDetail />)
    
    await waitFor(() => {
      expect(screen.getByText('user')).toBeInTheDocument()
      expect(screen.getByText('tool')).toBeInTheDocument()
    })
  })

  it('displays token count and cost', () => {
    render(<SessionDetail />)
    
    expect(screen.getByText(/5,000/)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.15/)).toBeInTheDocument()
  })
})
```

**Step 2: VERIFY RED**

Run: `cd frontend && bun test` src/components/sessions/session-detail.test.tsx`
Expected: FAIL - Cannot find module './session-detail'

**Step 3: GREEN - Create session-detail.tsx**

```typescript
// frontend/src/components/sessions/session-detail.tsx
// Modal showing session timeline and details
import { useEffect, useState } from 'react'
import { X, MessageSquare, Terminal, AlertCircle, Lock, Clock, Coins } from 'lucide-react'
import { useStore, type TimelineEvent } from '@/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatRelativeTime } from '@/lib/utils'

const eventIcons: Record<string, React.ReactNode> = {
  user: <MessageSquare className="size-4 text-blue-500" />,
  assistant: <MessageSquare className="size-4 text-purple-500" />,
  tool: <Terminal className="size-4 text-green-500" />,
  error: <AlertCircle className="size-4 text-red-500" />,
  permission: <Lock className="size-4 text-orange-500" />,
}

export function SessionDetail() {
  const { selectedSession, selectSession, timeline, setTimeline } = useStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedSession) return
    if (timeline.has(selectedSession.id)) return

    async function fetchTimeline() {
      setLoading(true)
      try {
        const res = await fetch(`/api/sessions/${selectedSession!.id}`)
        const data = await res.json()
        setTimeline(selectedSession!.id, data.timeline)
      } catch (err) {
        console.error('Failed to fetch timeline:', err)
      }
      setLoading(false)
    }
    fetchTimeline()
  }, [selectedSession, timeline, setTimeline])

  if (!selectedSession) return null

  const events = timeline.get(selectedSession.id) || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => selectSession(null)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-foreground truncate">
              {selectedSession.title}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <Badge variant={selectedSession.status}>{selectedSession.status}</Badge>
              <span>{selectedSession.hostname}</span>
              <span className="flex items-center gap-1">
                <Coins className="size-3.5" />
                {selectedSession.token_total.toLocaleString()} tokens
              </span>
              <span>${selectedSession.cost_total.toFixed(2)}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => selectSession(null)}>
            <X className="size-5" />
          </Button>
        </div>

        {/* Timeline */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Timeline</h3>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No events recorded</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="mt-0.5">
                    {eventIcons[event.event_type] || <Clock className="size-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="default" className="text-xs">{event.event_type}</Badge>
                      {event.tool_name && (
                        <span className="text-xs text-muted-foreground">{event.tool_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatRelativeTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{event.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 4: VERIFY GREEN**

Run: `cd frontend && bun test` src/components/sessions/session-detail.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add frontend/src/components/sessions/session-detail.tsx frontend/src/components/sessions/session-detail.test.tsx
git commit -m "feat(frontend): add SessionDetail modal with timeline view"
```

---

## Task 15: Analytics Chart Components

**Files:**
- Create: `frontend/src/components/analytics/token-bar-chart.tsx`
- Create: `frontend/src/components/analytics/usage-line-chart.tsx`
- Create: `frontend/src/components/analytics/model-pie-chart.tsx`
- Create: `frontend/src/components/analytics/calendar-heatmap.tsx`

**Step 1: Create token-bar-chart.tsx (square-ui ChartCard pattern)**

```typescript
// frontend/src/components/analytics/token-bar-chart.tsx
// Bar chart showing token usage by model - based on square-ui ChartCard
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Coins } from 'lucide-react'

interface ModelData {
  model_id: string
  total_tokens: number
  total_cost: number
}

interface Props {
  data: ModelData[]
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export function TokenBarChart({ data }: Props) {
  // Add color to each item
  const chartData = data.map((d, i) => ({
    ...d,
    fill: COLORS[i % COLORS.length],
    // Shorten model names for display
    name: d.model_id.split('/').pop() || d.model_id
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Coins className="size-4 text-muted-foreground" />
        <h3 className="text-[15px] font-normal text-foreground tracking-tight">
          Tokens by Model
        </h3>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: number) => [value.toLocaleString(), 'Tokens']}
            />
            <Bar dataKey="total_tokens" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

**Step 2: Create usage-line-chart.tsx**

```typescript
// frontend/src/components/analytics/usage-line-chart.tsx
// Line chart showing usage over time
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

interface DailyData {
  date: string
  total_tokens: number
  total_cost: number
}

interface Props {
  data: DailyData[]
}

export function UsageLineChart({ data }: Props) {
  const chartData = data.map(d => ({
    ...d,
    displayDate: format(new Date(d.date), 'MMM d')
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="size-4 text-muted-foreground" />
        <h3 className="text-[15px] font-normal text-foreground tracking-tight">
          Usage Over Time
        </h3>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="displayDate"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: number) => [value.toLocaleString(), 'Tokens']}
            />
            <Line 
              type="monotone" 
              dataKey="total_tokens" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={{ r: 3, fill: '#3B82F6' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

**Step 3: Create model-pie-chart.tsx**

```typescript
// frontend/src/components/analytics/model-pie-chart.tsx
// Pie chart showing model distribution
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { PieChartIcon } from 'lucide-react'

interface ModelData {
  model_id: string
  total_tokens: number
}

interface Props {
  data: ModelData[]
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export function ModelPieChart({ data }: Props) {
  const chartData = data.map(d => ({
    ...d,
    name: d.model_id.split('/').pop() || d.model_id
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <PieChartIcon className="size-4 text-muted-foreground" />
        <h3 className="text-[15px] font-normal text-foreground tracking-tight">
          Model Distribution
        </h3>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="total_tokens"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: number) => [value.toLocaleString(), 'Tokens']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

**Step 4: Create calendar-heatmap.tsx (GitHub-style)**

```typescript
// frontend/src/components/analytics/calendar-heatmap.tsx
// GitHub-style contribution calendar for daily usage
import { Calendar } from 'lucide-react'
import { format, eachDayOfInterval, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DailyData {
  date: string
  total_tokens: number
}

interface Props {
  data: DailyData[]
}

export function CalendarHeatmap({ data }: Props) {
  const dataMap = new Map(data.map(d => [d.date, d.total_tokens]))
  const maxTokens = Math.max(...data.map(d => d.total_tokens), 1)

  // Last 90 days
  const endDate = new Date()
  const startDate = subDays(endDate, 90)
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  // Group by week
  const weeks: Date[][] = []
  let currentWeek: Date[] = []
  
  days.forEach((day, i) => {
    currentWeek.push(day)
    if (day.getDay() === 6 || i === days.length - 1) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })

  const getIntensity = (tokens: number): string => {
    if (tokens === 0) return 'bg-muted'
    const ratio = tokens / maxTokens
    if (ratio < 0.25) return 'bg-green-200 dark:bg-green-900'
    if (ratio < 0.5) return 'bg-green-300 dark:bg-green-700'
    if (ratio < 0.75) return 'bg-green-400 dark:bg-green-600'
    return 'bg-green-500 dark:bg-green-500'
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="size-4 text-muted-foreground" />
        <h3 className="text-[15px] font-normal text-foreground tracking-tight">
          Daily Activity (Last 90 Days)
        </h3>
      </div>

      <TooltipProvider>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const tokens = dataMap.get(dateStr) || 0
                return (
                  <Tooltip key={dateStr}>
                    <TooltipTrigger>
                      <div
                        className={cn(
                          'size-3 rounded-sm transition-colors hover:ring-1 hover:ring-primary',
                          getIntensity(tokens)
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {format(day, 'MMM d, yyyy')}: {tokens.toLocaleString()} tokens
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          ))}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-4 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="size-3 rounded-sm bg-muted" />
        <div className="size-3 rounded-sm bg-green-200 dark:bg-green-900" />
        <div className="size-3 rounded-sm bg-green-300 dark:bg-green-700" />
        <div className="size-3 rounded-sm bg-green-400 dark:bg-green-600" />
        <div className="size-3 rounded-sm bg-green-500" />
        <span>More</span>
      </div>
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add frontend/src/components/analytics/
git commit -m "feat(frontend): add analytics charts (bar, line, pie, calendar heatmap)"
```

---

## Task 16: Analytics Page

**Files:**
- Create: `frontend/src/pages/analytics-page.tsx`
- Create: `frontend/src/pages/analytics-page.test.tsx`

**Step 1: RED - Write failing test**

```typescript
// frontend/src/pages/analytics-page.test.tsx
// Tests analytics page fetches and displays data
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AnalyticsPage } from './analytics-page'

global.fetch = vi.fn()

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fetch as any).mockImplementation((url: string) => {
      if (url.includes('summary')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ total_tokens: 50000, total_cost: 1.5, total_sessions: 10 }) })
      }
      if (url.includes('models')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ model_id: 'gpt-4', total_tokens: 30000 }]) })
      }
      if (url.includes('daily')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ date: '2026-01-18', total_tokens: 5000 }]) })
      }
      if (url.includes('instances')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ hostname: 'vps1' }]) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    })
  })

  it('renders stat cards with summary data', async () => {
    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText('50,000')).toBeInTheDocument()
      expect(screen.getByText('$1.50')).toBeInTheDocument()
    })
  })

  it('renders all chart sections', async () => {
    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Tokens by Model')).toBeInTheDocument()
      expect(screen.getByText('Usage Over Time')).toBeInTheDocument()
      expect(screen.getByText('Model Distribution')).toBeInTheDocument()
      expect(screen.getByText(/Daily Activity/)).toBeInTheDocument()
    })
  })

  it('renders filter controls', () => {
    render(<AnalyticsPage />)
    
    expect(screen.getByText('All Instances')).toBeInTheDocument()
  })
})
```

**Step 2: VERIFY RED**

Run: `cd frontend && bun test` src/pages/analytics-page.test.tsx`
Expected: FAIL - Cannot find module './analytics-page'

**Step 3: GREEN - Create analytics-page.tsx**

```typescript
// frontend/src/pages/analytics-page.tsx
// Analytics dashboard with charts and filters
import { useEffect, useState } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/dashboard/stat-card'
import { TokenBarChart } from '@/components/analytics/token-bar-chart'
import { UsageLineChart } from '@/components/analytics/usage-line-chart'
import { ModelPieChart } from '@/components/analytics/model-pie-chart'
import { CalendarHeatmap } from '@/components/analytics/calendar-heatmap'
import { Skeleton } from '@/components/ui/skeleton'

interface Summary {
  total_tokens: number
  total_cost: number
  total_sessions: number
}

interface ModelData {
  model_id: string
  total_tokens: number
  total_cost: number
}

interface DailyData {
  date: string
  total_tokens: number
  total_cost: number
}

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [models, setModels] = useState<ModelData[]>([])
  const [daily, setDaily] = useState<DailyData[]>([])
  const [instances, setInstances] = useState<string[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [timeRange, setTimeRange] = useState('30d')

  async function fetchData() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedInstance) params.set('hostname', selectedInstance)

      const [summaryRes, modelsRes, dailyRes, instancesRes] = await Promise.all([
        fetch(`/api/analytics/summary?${params}`),
        fetch(`/api/analytics/models?${params}`),
        fetch(`/api/analytics/daily?${params}`),
        fetch('/api/instances')
      ])

      setSummary(await summaryRes.json())
      setModels(await modelsRes.json())
      setDaily(await dailyRes.json())
      setInstances((await instancesRes.json()).map((i: any) => i.hostname))
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [selectedInstance, timeRange])

  const topModel = models.length > 0 ? models[0].model_id.split('/').pop() : 'N/A'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="size-6 text-primary" />
            <h1 className="text-xl font-semibold">Analytics</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Instance filter */}
            <select
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">All Instances</option>
              {instances.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            {/* Time range */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[340px] rounded-xl" />)}
            </div>
          </>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Total Tokens"
                value={summary?.total_tokens?.toLocaleString() || '0'}
                icon="tokens"
              />
              <StatCard
                title="Total Cost"
                value={`$${summary?.total_cost?.toFixed(2) || '0.00'}`}
                icon="cost"
              />
              <StatCard
                title="Sessions"
                value={summary?.total_sessions?.toString() || '0'}
                icon="sessions"
              />
              <StatCard
                title="Top Model"
                value={topModel}
                icon="instances"
                subtitle={models.length > 0 ? `${((models[0].total_tokens / (summary?.total_tokens || 1)) * 100).toFixed(0)}% of usage` : undefined}
              />
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TokenBarChart data={models} />
              <UsageLineChart data={daily} />
              <ModelPieChart data={models} />
              <CalendarHeatmap data={daily} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
```

**Step 4: VERIFY GREEN**

Run: `cd frontend && bun test` src/pages/analytics-page.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add frontend/src/pages/analytics-page.tsx frontend/src/pages/analytics-page.test.tsx
git commit -m "feat(frontend): add AnalyticsPage with stat cards and 4 chart types"
```

---

## Task 17: Settings Page + Theme Provider

**Files:**
- Create: `frontend/src/components/theme-provider.tsx`
- Create: `frontend/src/components/theme-toggle.tsx`
- Create: `frontend/src/pages/settings-page.tsx`
- Create: `frontend/src/pages/settings-page.test.tsx`

**Step 1: Create theme-provider.tsx**

```typescript
// frontend/src/components/theme-provider.tsx
// Theme context provider - handles light/dark/system modes
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system'
    }
    return 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const root = document.documentElement

    const applyTheme = (t: Theme) => {
      let resolved: 'light' | 'dark' = 'light'
      
      if (t === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      } else {
        resolved = t
      }

      root.classList.remove('light', 'dark')
      root.classList.add(resolved)
      setResolvedTheme(resolved)
    }

    applyTheme(theme)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') applyTheme('system')
    }
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
```

**Step 2: Create theme-toggle.tsx (square-ui pattern)**

```typescript
// frontend/src/components/theme-toggle.tsx
// Theme toggle button - cycles through light/dark/system
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './theme-provider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const icons = {
    light: <Sun className="size-4" />,
    dark: <Moon className="size-4" />,
    system: <Monitor className="size-4" />,
  }

  const nextTheme = {
    light: 'dark' as const,
    dark: 'system' as const,
    system: 'light' as const,
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme[theme])}
      title={`Current: ${theme}. Click to change.`}
    >
      {icons[theme]}
    </Button>
  )
}
```

**Step 3: RED - Write failing test for SettingsPage**

```typescript
// frontend/src/pages/settings-page.test.tsx
// Tests settings page renders and theme selection works
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPage } from './settings-page'
import { ThemeProvider } from '@/components/theme-provider'

describe('SettingsPage', () => {
  it('renders theme selection options', () => {
    render(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    )
    
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('renders password section', () => {
    render(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    )
    
    expect(screen.getByText('Connection')).toBeInTheDocument()
  })

  it('allows clearing saved password', () => {
    localStorage.setItem('dashboard_password', 'test123')
    
    render(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    )
    
    const clearButton = screen.getByText('Clear Password')
    fireEvent.click(clearButton)
    
    expect(localStorage.getItem('dashboard_password')).toBeNull()
  })
})
```

**Step 4: VERIFY RED**

Run: `cd frontend && bun test` src/pages/settings-page.test.tsx`
Expected: FAIL - Cannot find module './settings-page'

**Step 5: GREEN - Create settings-page.tsx**

```typescript
// frontend/src/pages/settings-page.tsx
// Settings page with theme switcher and connection settings
import { Settings, Sun, Moon, Monitor, Lock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const handleClearPassword = () => {
    localStorage.removeItem('dashboard_password')
    window.location.reload()
  }

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Settings className="size-6 text-primary" />
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Choose your preferred theme. System will follow your OS setting.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    theme === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <opt.icon className={cn(
                    'size-6',
                    theme === opt.value ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <span className={cn(
                    'text-sm font-medium',
                    theme === opt.value ? 'text-primary' : 'text-foreground'
                  )}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="mt-6 p-4 rounded-xl border border-border bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">Preview ({resolvedTheme} mode):</p>
              <div className="flex items-center gap-3">
                <div className="h-8 w-24 rounded bg-primary" />
                <div className="h-8 w-16 rounded bg-muted border border-border" />
                <p className="text-sm">Sample text</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Lock className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Saved Password</p>
                  <p className="text-xs text-muted-foreground">
                    {localStorage.getItem('dashboard_password') 
                      ? 'Password is saved in browser storage'
                      : 'No password saved'}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearPassword}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Clear Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              OpenCode Dashboard v1.0.0
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time monitoring for OpenCode sessions across VPS instances.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
```

**Step 6: VERIFY GREEN**

Run: `cd frontend && bun test` src/pages/settings-page.test.tsx`
Expected: PASS (3 tests)

**Step 7: Commit**

```bash
git add frontend/src/components/theme-provider.tsx frontend/src/components/theme-toggle.tsx frontend/src/pages/settings-page.tsx frontend/src/pages/settings-page.test.tsx
git commit -m "feat(frontend): add SettingsPage with theme switcher (light/dark/system)"
```

---

## Task 18: App Router + Navigation Sidebar

**Files:**
- Create: `frontend/src/components/layout/sidebar.tsx`
- Create: `frontend/src/components/layout/password-prompt.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Create sidebar.tsx (square-ui pattern)**

```typescript
// frontend/src/components/layout/sidebar.tsx
// Navigation sidebar - based on square-ui DashboardSidebar
import { NavLink } from 'react-router-dom'
import { Activity, BarChart3, Settings, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { Separator } from '@/components/ui/separator'

const navItems = [
  { to: '/', icon: Activity, label: 'Sessions' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card hidden lg:flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Globe className="size-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">OpenCode</h1>
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Separator />

      {/* Footer */}
      <div className="p-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">v1.0.0</span>
        <ThemeToggle />
      </div>
    </aside>
  )
}

// Mobile header for small screens
export function MobileHeader() {
  return (
    <header className="lg:hidden sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          <span className="font-semibold">OpenCode</span>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                'p-2 rounded-lg transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <item.icon className="size-5" />
            </NavLink>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
```

**Step 2: Create password-prompt.tsx**

```typescript
// frontend/src/components/layout/password-prompt.tsx
// Login screen - prompts for dashboard password
import { useState } from 'react'
import { Lock, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface PasswordPromptProps {
  onAuthenticate: (password: string) => void
}

export function PasswordPrompt({ onAuthenticate }: PasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setLoading(true)
    setError('')

    // Store and proceed - WebSocket will validate
    localStorage.setItem('dashboard_password', password)
    onAuthenticate(password)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Globe className="size-8 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">OpenCode Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Enter your password to continue</p>
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connecting...' : 'Continue'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Password is stored in your browser for convenience
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Update App.tsx**

```typescript
// frontend/src/App.tsx
// Main app with routing and authentication
import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar, MobileHeader } from '@/components/layout/sidebar'
import { PasswordPrompt } from '@/components/layout/password-prompt'
import { SessionsPage } from '@/pages/sessions-page'
import { AnalyticsPage } from '@/pages/analytics-page'
import { SettingsPage } from '@/pages/settings-page'

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileHeader />
      <main className="lg:pl-64">
        {children}
      </main>
    </div>
  )
}

function App() {
  const [authenticated, setAuthenticated] = useState(false)

  // Check for saved password on mount
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_password')
    if (saved) setAuthenticated(true)
  }, [])

  if (!authenticated) {
    return (
      <ThemeProvider>
        <PasswordPrompt onAuthenticate={() => setAuthenticated(true)} />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<SessionsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
```

**Step 4: Update main.tsx**

```typescript
// frontend/src/main.tsx
// Entry point - renders App to DOM
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat(frontend): add App router, Sidebar nav, and PasswordPrompt"
```

---

## Task 19: README + Environment Files

**Files:**
- Create: `README.md`
- Update: `.env.example`
- Create: `.gitignore`

**Step 1: Create README.md**

```markdown
# OpenCode Dashboard

Real-time dashboard for monitoring OpenCode sessions across multiple VPS instances.

## Features

- **Sessions Page** - View all sessions with real-time updates via WebSocket
- **Analytics Dashboard** - Token usage charts (bar, line, pie, calendar heatmap)
- **Theme Switcher** - Light/dark/system mode support
- **Notifications** - Sound alerts for idle sessions and permission requests

## Tech Stack

**Backend:** Bun, Hono, SQLite (bun:sqlite), WebSocket
**Frontend:** Bun, Vite, React, TypeScript, square-ui, Eldora UI, recharts, Zustand

## Quick Start

### Backend

```bash
cd backend
bun install
cp ../.env.example .env  # Edit with your password
bun run dev
```

API runs on `http://localhost:3000`
WebSocket runs on `ws://localhost:3001`

### Frontend

```bash
cd frontend
bun install
bun run dev
```

Frontend runs on `http://localhost:5173`

## Environment Variables

```env
BACKEND_PORT=3000          # API port (WebSocket = port + 1)
BACKEND_PASSWORD=secret    # Dashboard login password
DATABASE_URL=./data/db.sqlite
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/events` | Receive plugin events |
| GET | `/api/sessions` | List sessions (filters: hostname, status, search) |
| GET | `/api/sessions/:id` | Session detail with timeline |
| GET | `/api/analytics/summary` | Totals: tokens, cost, sessions |
| GET | `/api/analytics/models` | Token usage by model |
| GET | `/api/analytics/daily` | Daily usage for calendar |
| GET | `/api/instances` | List VPS instances |

## Plugin Configuration

Add to your OpenCode plugin config:

```toml
[dashboard]
url = "http://your-server:3000"
hostname = "vps-name"
```

## Development

```bash
# Run all tests
cd backend && bun test
cd frontend && bun test

# Watch mode
cd backend && bun test --watch
cd frontend && bun run test:watch
```

## License

MIT

**Step 2: Create .gitignore**

```gitignore
# Bun lockfile
bun.lockb

# Dependencies (if any npm packages)
node_modules/
package-lock.json
yarn.lock
.pnpm-debug.log*

# Vite cache
.vite

# Build output
dist/

# Environment
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Database
data/
*.db
*.sqlite

# Logs
*.log
npm-debug.log*
yarn-debug.log*
bun-debug.log*

# OS
.DS_Store
Thumbs.db
```

# Build output
dist/
build/

# Database
*.db
*.sqlite
data/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
```

**Step 3: Update .env.example**

```env
# Backend Configuration
BACKEND_PORT=3000
BACKEND_PASSWORD=change_this_to_secure_password
DATABASE_URL=./data/database.db

# Optional: API key for webhook authentication
API_KEY=
```

**Step 4: Commit**

```bash
git add README.md .gitignore .env.example
git commit -m "docs: add README, gitignore, and env example"
```

---

## Task 20: Final Verification Checklist

**Run all tests:**

```bash
# Backend tests
cd backend && bun test
# Expected: All tests PASS

# Frontend tests
cd frontend && bun test
# Expected: All tests PASS
```

**Manual testing checklist:**

- [ ] Backend starts: `cd backend && bun run dev`
- [ ] Frontend starts: `cd frontend && bun run dev`
- [ ] Password prompt appears on first visit
- [ ] Sessions page loads and displays sessions
- [ ] Filters work (hostname, status, search)
- [ ] Session card click opens detail modal
- [ ] Timeline events display in modal
- [ ] WebSocket connects (green indicator)
- [ ] Real-time updates work (flash on new events)
- [ ] Sound plays on attention/idle events
- [ ] Analytics page loads with charts
- [ ] All 4 chart types render correctly
- [ ] Settings page theme switcher works
- [ ] Dark mode applies correctly
- [ ] Mobile layout works (responsive)

**Build verification:**

```bash
cd frontend && bun run build
# Expected: No TypeScript errors, build completes
```

**Final commit:**

```bash
git add .
git commit -m "feat: OpenCode Dashboard complete - sessions, analytics, real-time updates"
```

---

## Execution Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Backend setup | 2 |
| 2 | Database schema | 5 |
| 3 | Webhook handler | 4 |
| 4 | WebSocket server | 4 |
| 5 | API endpoints | 7 |
| 6 | Frontend setup | - |
| 7 | Base UI components | - |
| 8 | Dashboard components | 3 |
| 9 | Zustand store | 5 |
| 10 | WebSocket hook | 2 |
| 11 | SessionCard | 6 |
| 12 | SessionFilters | 4 |
| 13 | SessionsPage | 3 |
| 14 | SessionDetail | 4 |
| 15 | Analytics charts | - |
| 16 | AnalyticsPage | 3 |
| 17 | Settings + Theme | 3 |
| 18 | App router | - |
| 19 | Documentation | - |
| 20 | Verification | - |

**Total: 55 tests across 20 tasks**

---

## Execution Options

**Plan saved to:** `docs/plans/2026-01-18-opencode-dashboard-v2.md`

**Choose execution method:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks

2. **Parallel Session (separate)** - Open new session with `superpowers:executing-plans` skill

Which approach?
