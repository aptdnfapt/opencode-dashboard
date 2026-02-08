# Phase 1: Parent Session Tracking

## Goal
Enable parent-child relationship tracking for sessions (main session → subagent sessions)

## Changes

### 1.1 Plugin - Send parentSessionId
**File:** `plugin/dashboard.ts:132-136`

```typescript
// BEFORE
send({
  type: "session.created",
  sessionId: session.id,
  title: session.title || "Untitled Session"
})

// AFTER
send({
  type: "session.created",
  sessionId: session.id,
  parentSessionId: session.parentID,  // ADD
  title: session.title || "Untitled Session"
})
```

### 1.2 Database Schema - Add column + index
**File:** `backend/src/db/schema.ts`

```sql
-- Add to sessions table definition
parent_session_id TEXT,

-- Add index
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_directory ON sessions(directory);
```

### 1.3 Backend Webhook - Handle parentSessionId
**File:** `backend/src/handlers/webhook.ts`

```typescript
// Add to PluginEvent interface (line ~10)
parentSessionId?: string

// Update INSERT in session.created case (line ~72)
INSERT OR REPLACE INTO sessions (id, title, hostname, directory, parent_session_id, status, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
// Add event.parentSessionId to .run() params
```

### 1.4 Frontend Store - Add field
**File:** `frontend/src/store/index.ts`

```typescript
// Add to Session interface
export interface Session {
  id: string
  title: string
  hostname: string
  directory?: string
  parent_session_id?: string  // ADD
  status: 'active' | 'idle' | 'error' | 'old' | 'stale'
  // ...
}
```

### 1.5 Backend API - Return parent_session_id
**File:** `backend/src/handlers/api.ts`

Ensure `parent_session_id` is included in session SELECT queries (should auto-include with `SELECT *`)

## Verification
```bash
# After restart, create a subagent session and check:
sqlite3 backend/data/database.db "SELECT id, title, parent_session_id FROM sessions WHERE parent_session_id IS NOT NULL"
```

## Dependencies
- None (this is the foundation)

## Blocks
- Phase 5 (UI hierarchy display)
- Phase 6 (subagent audio differentiation)
