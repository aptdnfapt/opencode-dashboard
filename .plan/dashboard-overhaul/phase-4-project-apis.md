# Phase 4: Project Grouping Backend APIs

## Goal
Add API endpoints for project-based views and filtering

## Changes

### 4.1 GET /api/projects - List projects
**File:** `backend/src/handlers/api.ts`

```typescript
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
```

### 4.2 Add directory filter to sessions
**File:** `backend/src/handlers/api.ts` (GET /api/sessions)

```typescript
// Add to query params parsing
const directory = c.req.query('directory')

// Add to WHERE clause
if (directory) {
  conditions.push('directory = ?')
  params.push(directory)
}
```

### 4.3 GET /api/analytics/by-project
**File:** `backend/src/handlers/api.ts`

```typescript
app.get('/api/analytics/by-project', (c: Context) => {
  const range = c.req.query('range') || '7d'
  const since = getTimeSince(range)
  
  const projects = db.prepare(`
    SELECT 
      s.directory,
      COUNT(DISTINCT s.id) as sessions,
      SUM(t.tokens_in + t.tokens_out) as tokens,
      SUM(t.cost) as cost
    FROM sessions s
    LEFT JOIN token_usage t ON s.id = t.session_id AND t.timestamp >= ?
    WHERE s.directory IS NOT NULL
    GROUP BY s.directory
    ORDER BY cost DESC
  `).all(since)
  
  return c.json(projects)
})
```

### 4.4 Frontend store - Add directory filter
**File:** `frontend/src/store/index.ts`

```typescript
// Update Filters interface
interface Filters {
  hostname: string
  status: string
  search: string
  directory: string  // ADD
}

// Update initial state
filters: {
  hostname: '',
  status: '',
  search: '',
  directory: ''  // ADD
}

// Update setFilters action to handle directory
```

## Verification
```bash
# Test new endpoints
curl -H "X-API-Key: $FRONTEND_PASSWORD" http://localhost:3000/api/projects
curl -H "X-API-Key: $FRONTEND_PASSWORD" "http://localhost:3000/api/sessions?directory=/home/idc/proj/foo"
curl -H "X-API-Key: $FRONTEND_PASSWORD" http://localhost:3000/api/analytics/by-project
```

## Dependencies
- Phase 1 (directory index)
- Phase 2 (real-time updates)

## Blocks
- Phase 5 (sidebar needs /api/projects)
