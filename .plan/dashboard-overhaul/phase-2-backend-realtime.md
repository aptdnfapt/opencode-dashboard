# Phase 2: Fix Backend Real-Time Issues

## Goal
Ensure all DB changes trigger WebSocket broadcasts for real-time UI updates

## Changes

### 2.1 Broadcast auto-created sessions
**File:** `backend/src/handlers/webhook.ts:37-52`

```typescript
// BEFORE: ensureSession returns void
function ensureSession(sessionId: string, hostname?: string, timestamp?: number) {
  const exists = db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(sessionId)
  if (!exists) {
    db.prepare(`INSERT INTO sessions ...`).run(...)
  }
}

// AFTER: return boolean, broadcast if new
function ensureSession(sessionId: string, hostname?: string, timestamp?: number): boolean {
  const exists = db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(sessionId)
  if (!exists) {
    db.prepare(`INSERT INTO sessions ...`).run(...)
    wsManager.broadcastSessionCreated({ id: sessionId, title: 'Resumed Session', hostname })
    return true
  }
  return false
}
```

### 2.2 Broadcast token updates
**File:** `backend/src/handlers/webhook.ts:182-185`

```typescript
// AFTER token INSERT, add:
const updatedSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(event.sessionId)
wsManager.broadcastSessionUpdated(updatedSession)
```

### 2.3 Broadcast status changes
**File:** `backend/src/handlers/webhook.ts:147-150`

```typescript
// AFTER setting status='active':
db.prepare('UPDATE sessions SET needs_attention = 0, status = ? WHERE id = ?')
  .run('active', event.sessionId)
wsManager.broadcastSessionUpdated({ id: event.sessionId, status: 'active' })  // ADD
wsManager.broadcastAttention(event.sessionId!, false)
```

### 2.4 WebSocket JSON parse safety
**File:** `backend/src/index.ts:70-77`

```typescript
// BEFORE
message(ws, msg) {
  const data = JSON.parse(msg.toString())
  // ...
}

// AFTER
message(ws, msg) {
  try {
    const data = JSON.parse(msg.toString())
    // ...
  } catch (err) {
    console.warn('Invalid WebSocket message:', err)
  }
}
```

### 2.5 Non-blocking broadcast
**File:** `backend/src/websocket/server.ts:26-33`

```typescript
// BEFORE
broadcast(message: BroadcastMessage): void {
  const data = JSON.stringify(message)
  for (const client of this.clients) {
    if (client.readyState === 1) client.send(data)
  }
}

// AFTER
broadcast(message: BroadcastMessage): void {
  const data = JSON.stringify(message)
  for (const client of this.clients) {
    try {
      if (client.readyState === 1) client.send(data)
    } catch (err) {
      console.warn('Broadcast failed, removing client:', err)
      this.clients.delete(client)
    }
  }
}
```

### 2.6 Add missing indexes
**File:** `backend/src/db/schema.ts`

```sql
-- Add to schema init
CREATE INDEX IF NOT EXISTS idx_sessions_directory ON sessions(directory);
CREATE INDEX IF NOT EXISTS idx_token_timestamp ON token_usage(timestamp DESC);
```

## Verification
```bash
# Watch backend logs while triggering events
tail -f /tmp/backend.log | grep -E "broadcast|session"
```

## Dependencies
- Phase 1 (schema changes)

## Blocks
- Phase 3 (frontend expects these broadcasts)
