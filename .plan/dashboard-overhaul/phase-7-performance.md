# Phase 7: Performance & Polish

## Goal
Optimize rendering, reduce unnecessary work, improve responsiveness

## Changes

### 7.1 Server-side filtering for sessions
**File:** `frontend/src/pages/sessions-page.tsx`

```typescript
// BEFORE: Fetch all, filter client-side
useEffect(() => {
  fetch('/api/sessions').then(...)
}, [])
const filtered = sessions.filter(...)

// AFTER: Pass filters to API
useEffect(() => {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.hostname) params.set('hostname', filters.hostname)
  if (filters.directory) params.set('directory', filters.directory)
  if (filters.search) params.set('search', filters.search)
  
  fetch(`/api/sessions?${params}`).then(...)
}, [filters])
```

**File:** `backend/src/handlers/api.ts` - Ensure all filters supported server-side

### 7.2 Memoize SessionCard
**File:** `frontend/src/components/sessions/session-card.tsx`

```typescript
// Wrap component
export const SessionCard = React.memo(function SessionCard({ 
  session, 
  onClick, 
  justUpdated 
}: SessionCardProps) {
  // ... component body
}, (prev, next) => {
  // Custom comparison - only re-render if these change
  return prev.session.id === next.session.id 
    && prev.session.status === next.session.status
    && prev.session.updated_at === next.session.updated_at
    && prev.justUpdated === next.justUpdated
})
```

### 7.3 Live timestamp refresh
**File:** `frontend/src/components/sessions/session-card.tsx`

```typescript
// Add refresh interval for relative time display
const [, setTick] = useState(0)

useEffect(() => {
  // Refresh every minute for "X minutes ago" display
  const timer = setInterval(() => setTick(t => t + 1), 60000)
  return () => clearInterval(timer)
}, [])
```

### 7.4 Stagger analytics API calls
**File:** `frontend/src/pages/analytics-page.tsx`

```typescript
// BEFORE: All 7 fetches at once
Promise.all([fetch1, fetch2, fetch3, fetch4, fetch5, fetch6, fetch7])

// AFTER: Critical first, then batch
useEffect(() => {
  // Critical: summary + main chart
  Promise.all([
    fetch('/api/analytics/summary-extended'),
    fetch('/api/analytics/cost-trend')
  ]).then(([summary, trend]) => {
    setSummary(summary)
    setCostTrend(trend)
    
    // Then load secondary data
    return Promise.all([
      fetch('/api/analytics/cost-by-model'),
      fetch('/api/analytics/cost-by-agent'),
      fetch('/api/analytics/file-stats'),
      fetch('/api/analytics/heatmap')
    ])
  }).then(([models, agents, files, heatmap]) => {
    setModels(models)
    setAgents(agents)
    // ...
  })
}, [])
```

### 7.5 Stable WebSocket callback
**File:** `frontend/src/App.tsx`

```typescript
// BEFORE: handleWSMessage recreated on every render
const handleWSMessage = useCallback((msg) => {
  addSession(msg.data)  // These deps cause recreation
  updateSession(msg.data)
}, [addSession, updateSession])

// AFTER: Use getState() for stable callback
const handleWSMessage = useCallback((msg: WSMessage) => {
  const { addSession, updateSession, addTimelineEvent } = useStore.getState()
  
  switch (msg.type) {
    case 'session.created':
      addSession(msg.data)
      break
    // ...
  }
}, [])  // No deps - always stable
```

### 7.6 Debounce search filter
**File:** `frontend/src/components/sessions/session-filters.tsx`

```typescript
// Add debounce for search input
const [searchInput, setSearchInput] = useState(filters.search)

useEffect(() => {
  const timer = setTimeout(() => {
    setFilters({ ...filters, search: searchInput })
  }, 300)
  return () => clearTimeout(timer)
}, [searchInput])
```

## Verification
```bash
# Check render counts in React DevTools
# Measure network waterfall in Chrome DevTools
# Test with 100+ sessions for performance
```

## Dependencies
- Phase 3 (frontend fixes)
- Phase 4 (server-side filters)
- Phase 5 (UI components)

## Blocks
- None (final phase)
