# Performance Issues Analysis

**Date:** 2026-02-18  
**Validated:** 2026-02-18

---

## Executive Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Frontend Components | 2 | 0 | 1 | 0 |
| State Management | 1 | 0 | 0 | 0 |
| Build/Bundle | 2 | 1 | 0 | 0 |
| Backend | 1 | 1 | 1 | 0 |
| **Total** | **6** | **2** | **2** | **0** |

---

## 🔴 CRITICAL ISSUES

### 1. Wrong `$derived` Pattern
**File:** `frontend-svelte/src/lib/components/SessionCard.svelte:23, 97, 104`

```svelte
// ❌ WRONG - returns a function, must call displayStatus()
let displayStatus = $derived(() => { ... })

// ✅ CORRECT - returns computed value directly
let displayStatus = $derived.by(() => { ... })
```

**Impact:** Called 3x per card render → 150+ extra function calls with 50 sessions

**Fix:** Change `$derived(() => ...)` to `$derived.by(() => ...)`

---

### 2. No Cache Headers or Compression on Static Files
**File:** `backend/src/index.ts:93`

```typescript
// Current - no caching, no compression
return new Response(file, { headers: { 'Content-Type': file.type } })
```

**Impact:** 
- No browser caching → re-downloads assets every visit
- No gzip → 622KB sent instead of 230KB

**Fix:**
```typescript
return new Response(file, {
  headers: {
    'Content-Type': file.type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Encoding': 'gzip' // if pre-compressed
  }
})
```

---

### 3. Shiki Bundle Size — 426 KB gzipped (78% of total JS)
**File:** `frontend-svelte/package.json` — shiki in dependencies

**Build output confirms:**
```
C9XAeP06.js   780 KB → 196 KB gzip  (Shiki core)
CG6Dc4jp.js   622 KB → 230 KB gzip  (Shiki grammars)
─────────────────────────────────────
Total Shiki:  1.4 MB → 426 KB gzip
```

**Impact:** Shiki alone = 78% of all JS. Kills load time on slow connections.

**Fix Options:**
1. Lazy-load only when viewing session detail page:
```typescript
// sessions/[id]/+page.svelte
let codeToHtml: typeof import('shiki').codeToHtml
onMount(async () => {
  const shiki = await import('shiki')
  codeToHtml = shiki.codeToHtml
})
```

2. Use lighter alternative: `highlight.js` (~45 KB gzip vs 426 KB)

3. Pre-highlight on backend (zero client JS)

---

### 4. 30-Second Reactivity Cascade
**File:** `frontend-svelte/src/lib/store.svelte.ts:72, 111`

```typescript
get filteredSessions() {
  void this.tick  // Forces re-eval every 30s
  // ... O(N) filter + O(N log N) sort
}
```

**Impact:** Every 30s → entire app re-renders even with no data changes

**Fix:** Make tick opt-in per component, not global dependency

```typescript
// Option 1: Separate stale check from filtering
get filteredSessions() {
  // Don't depend on tick here
  return this.sessions.filter(...).sort(...)
}

// Stale status computed separately where needed
getEffectiveStatus(session: Session) {
  void this.tick  // Only components using this re-render
  // ...
}
```

---

## 🟠 HIGH PRIORITY

### 4. N+1 Delete Pattern
**File:** `backend/src/handlers/api.ts:750-756`

```typescript
// ❌ Current - N queries per child
for (const child of children) {
  db.prepare('DELETE FROM timeline_events WHERE session_id = ?').run(child.id)
  // ... 4 more DELETEs per child
}

// ✅ Fixed - 5 queries total
const childIds = children.map(c => c.id)
if (childIds.length > 0) {
  const placeholders = childIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM timeline_events WHERE session_id IN (${placeholders})`).run(...childIds)
  db.prepare(`DELETE FROM token_usage WHERE session_id IN (${placeholders})`).run(...childIds)
  db.prepare(`DELETE FROM file_edits WHERE session_id IN (${placeholders})`).run(...childIds)
  db.prepare(`DELETE FROM notes WHERE session_id IN (${placeholders})`).run(...childIds)
  db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`).run(...childIds)
}
```

---

### 5. chart.js in Wrong Location
**File:** `frontend-svelte/package.json:38`

```json
"devDependencies": {
  "chart.js": "^4.4.7",  // ← Wrong! Runtime dep in devDeps
```

**Impact:** Production build may strip it or cause bundling issues

**Fix:**
```bash
cd frontend-svelte && bun remove chart.js && bun add chart.js
```

---

## 🟡 MEDIUM PRIORITY

### 6. Unnecessary Date Parsing in Hot Paths
**Files:** `store.svelte.ts:81,103,120`, `SessionCard.svelte:27`

```typescript
// ❌ Current - parses string every time
const idleTime = now - new Date(s.updated_at).getTime()
```

**Note:** `updated_at` is already INTEGER in SQLite schema, so it should be a number. If it's coming as string from API, parse once on fetch, not on every filter/sort.

---

### 7. Missing Composite Database Indexes
**File:** `backend/src/db/schema.ts`

Existing indexes cover basics, but these composite indexes would help:

```sql
-- For /api/analytics/host-usage (created_at + hostname)
CREATE INDEX IF NOT EXISTS idx_sessions_created_hostname 
ON sessions(created_at DESC, hostname) WHERE hostname IS NOT NULL;

-- For JOIN queries with timestamp sorting
CREATE INDEX IF NOT EXISTS idx_token_session_timestamp 
ON token_usage(session_id, timestamp DESC);
```

---

### 8. No Virtual Scrolling for Session List
**File:** `frontend-svelte/src/routes/+page.svelte:119-128`

```svelte
{#each mainSessions as session}
  <SessionCard {session} />  <!-- All cards in DOM -->
{/each}
```

**Current mitigation:** SessionCard pauses animations when off-screen via IntersectionObserver.

**But:** DOM still grows unbounded. 100 sessions = 100 cards in DOM with 700+ reactive bindings.

**Fix:** Use virtual list for large session counts:
```svelte
{#if mainSessions.length > 50}
  <VirtualList items={mainSessions} let:item>
    <SessionCard session={item} />
  </VirtualList>
{:else}
  {#each mainSessions as session}
    <SessionCard {session} />
  {/each}
{/if}
```

**Impact:** Medium — only matters with 50+ sessions

---

## Implementation Plan

### Phase 1: Quick Wins (1 hour) ✅ DONE
- [x] Fix `$derived` → `$derived.by()` in SessionCard (lines 23, 97, 104)
- [x] Move chart.js to dependencies
- [x] Add cache headers to static file response

### Phase 2: Backend (2 hours) ✅ DONE
- [x] Fix N+1 delete pattern with batch DELETE
- [ ] Add compression middleware or pre-compress assets (optional - nginx can handle)
- [ ] Add missing composite indexes (optional - current perf acceptable)

### Phase 3: Optimization ✅ DONE
- [x] Refactor tick dependency to be opt-in (removed from filteredSessions/stats)
- [x] Lazy-load shiki (dynamic import on session detail page)
- [x] Handle `updated_at` as number or string gracefully
- [x] Add virtual scrolling for 50+ sessions

---

## Removed Issues (Invalid/Not Real)

| Original Issue | Why Removed |
|----------------|-------------|
| Worker never terminated | By design — worker is reused on reconnect |
| Blob URL never revoked | One-time ~100 bytes, negligible |
| WS broadcast mutation | `Set.delete()` during `for...of` is safe per JS spec |
| CSS animations expensive | Already uses `@property` for GPU-accelerated animation |
| Timeline Map recreation | Correct pattern for Svelte 5 reactivity |
| Analytics page blocks | Uses `Promise.all` which is fine, shows skeleton |
| Font blocking | Already has `display=swap` in app.html |
