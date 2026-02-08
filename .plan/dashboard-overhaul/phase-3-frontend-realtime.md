# Phase 3: Fix Frontend Real-Time Issues

## Goal
Fix WebSocket handling, state updates, and rendering bugs

## Changes

### 3.1 Remove duplicate WebSocket connection
**File:** `frontend/src/pages/session-detail-page.tsx`

```typescript
// REMOVE this line (~159):
useWebSocket(password, handleWSMessage)

// Instead, get timeline updates from global store
// The App.tsx WebSocket should handle all messages
```

**File:** `frontend/src/App.tsx` - ensure timeline events update store

### 3.2 Add timeline handler to App.tsx
**File:** `frontend/src/App.tsx` (in handleWSMessage switch)

```typescript
case 'timeline':
  // Add timeline event to store for the specific session
  addTimelineEvent(msg.data.sessionId, {
    timestamp: Date.now(),
    event_type: msg.data.eventType,
    summary: msg.data.summary,
    tool_name: msg.data.tool
  })
  break
```

### 3.3 Fix filtered sessions rendering
**File:** `frontend/src/pages/sessions-page.tsx:129`

```typescript
// BEFORE
{sessions.map((session) => ...

// AFTER
{filteredSessions.map((session) => ...
```

### 3.4 Memoize stats computation
**File:** `frontend/src/pages/sessions-page.tsx:66-67`

```typescript
// BEFORE
const activeCount = sessions.filter(s => s.status === 'active').length
const attentionCount = sessions.filter(s => s.needs_attention === 1).length

// AFTER
const { activeCount, attentionCount } = useMemo(() => ({
  activeCount: sessions.filter(s => s.status === 'active').length,
  attentionCount: sessions.filter(s => s.needs_attention === 1).length
}), [sessions])
```

### 3.5 Add stale status to config
**File:** `frontend/src/components/sessions/session-card.tsx`

```typescript
const statusConfig = {
  active: { color: 'text-emerald-500', bg: 'bg-emerald-500', label: 'Active' },
  idle: { color: 'text-amber-500', bg: 'bg-amber-500', label: 'Idle' },
  error: { color: 'text-rose-500', bg: 'bg-rose-500', label: 'Error' },
  stale: { color: 'text-gray-400', bg: 'bg-gray-400', label: 'Stale' },  // ADD
  old: { color: 'text-muted-foreground', bg: 'bg-muted-foreground', label: 'Old' },
}
```

### 3.6 Add React Error Boundary
**File:** `frontend/src/main.tsx`

```typescript
import { ErrorBoundary } from './components/error-boundary'

// Wrap App
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**New file:** `frontend/src/components/error-boundary.tsx`
- Create basic error boundary component
- Show fallback UI on crash
- Log errors to console

### 3.7 Fix WSMessage type
**File:** `frontend/src/hooks/use-websocket.ts:6`

```typescript
// BEFORE
type: 'auth' | 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle'

// AFTER
type: 'auth' | 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle' | 'error'
```

## Verification
```bash
cd frontend && bun run typecheck
cd frontend && bun test
```

## Dependencies
- Phase 2 (backend sends correct broadcasts)

## Blocks
- Phase 5 (UI components need working real-time)
