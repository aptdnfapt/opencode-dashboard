# Performance Fixes Plan

> Tech stack is correct (Svelte 5 + Bun + WS + SQLite). The lag comes from paint-heavy animations and a few data flow patterns. Nothing needs replacing — just optimizing.

---

## Priority 1 — Compositor-Only Animations (biggest impact)

### Problem
Animations use paint-heavy CSS properties (`conic-gradient` repaint, `box-shadow` pulse). These run on the **CPU main thread** and cause frame drops when 10+ cards animate simultaneously.

**Paint-heavy** (current, bad) → CPU repaints every frame:
- `conic-gradient(from var(--spin-angle))` on active cards
- `box-shadow` pulse on idle/attention cards

**Compositor-only** (target, good) → GPU handles, zero main thread cost:
- `transform` (rotate, translate, scale)
- `opacity`

### Fix: Spinning Border
Current → repaints gradient every frame  
Target → pre-render gradient once, rotate the whole pseudo-element

```css
/* BEFORE: repaints conic-gradient 60x/sec */
.spinning-border::before {
  background: conic-gradient(from var(--spin-angle), #10b981, transparent 40%, transparent 60%, #10b981);
  animation: spin-border 2.5s linear infinite;
}

/* AFTER: paint once, rotate via compositor */
.spinning-border::before {
  background: conic-gradient(from 0deg, #10b981, transparent 40%, transparent 60%, #10b981);
  /* transform: rotate() is compositor-only → GPU, no repaint */
  animation: spin-border 2.5s linear infinite;
  will-change: transform;
}
@keyframes spin-border {
  to { transform: rotate(360deg); }
}
```

### Fix: Box-Shadow Pulses (idle-glow, attention-ring)
Current → animates `box-shadow` (triggers paint)  
Target → use a pre-rendered shadow on a pseudo-element, animate `opacity` only

```css
/* BEFORE: repaints box-shadow every frame */
@keyframes idle-glow {
  50% { box-shadow: 0 0 8px rgba(234, 179, 8, 0.3); }
}

/* AFTER: static shadow, animate opacity (compositor-only) */
.idle-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 8px rgba(234, 179, 8, 0.3); /* painted once */
  pointer-events: none;
  will-change: opacity;
  animation: idle-glow 2s ease-in-out infinite;
}
@keyframes idle-glow {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}
```

Same approach for `attention-ring` — static shadow on `::after`, animate `opacity`.

### Fix: Add `will-change` to animated cards

```css
/* hint browser to promote to own compositor layer */
.session-card {
  will-change: transform, opacity;
}
```

> Don't overuse `will-change` — only on elements that actually animate. Too many promoted layers = memory bloat.

### Files to change
- `frontend-svelte/src/app.css` — global keyframes
- `frontend-svelte/src/lib/components/SessionCard.svelte` — spinning border, idle-glow, attention-ring

---

## Priority 2 — Fix N+1 Query on `/api/sessions`

### Problem
Initial page load runs 1 query per session to get latest model_id. 50 sessions = 51 DB queries.

```typescript
// CURRENT: runs once PER session (N+1)
const latestToken = db.prepare(
  'SELECT model_id FROM token_usage WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1'
).get(s.id)
```

### Fix
Single query with window function or LEFT JOIN subquery:

```sql
-- single query, all sessions + their latest model
SELECT s.*, sub.model_id as latest_model_id
FROM sessions s
LEFT JOIN (
  SELECT session_id, model_id,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp DESC) as rn
  FROM token_usage
) sub ON s.id = sub.session_id AND sub.rn = 1
WHERE s.status != 'deleted'
ORDER BY s.updated_at DESC
```

### Files to change
- `backend/src/handlers/` — whichever handler serves `GET /api/sessions`

---

## Priority 3 — Batch Rapid WebSocket Store Updates

### Problem
Multiple `session.updated` WS events arriving within milliseconds each trigger:
1. `this.sessions = this.sessions.map(...)` → new array allocation
2. `filteredSessions` recomputes → O(n) filter
3. `stats` recomputes → O(n) scan
4. `projectGroups` recomputes → O(n) grouping
5. All subscribed components re-render

5 events in 100ms = 5× full pipeline.

### Fix
Microtask batching — queue updates, flush once per frame:

```typescript
// in store.svelte.ts
private pendingUpdates = new Map<string, Partial<Session>>()
private flushScheduled = false

updateSession(update: Partial<Session> & { id: string }) {
  // merge into pending (latest wins per field)
  const existing = this.pendingUpdates.get(update.id) || {}
  this.pendingUpdates.set(update.id, { ...existing, ...update })

  if (!this.flushScheduled) {
    this.flushScheduled = true
    // queueMicrotask → flushes before next paint, batches all sync updates
    queueMicrotask(() => this.flushUpdates())
  }
}

private flushUpdates() {
  this.flushScheduled = false
  const updates = this.pendingUpdates
  this.pendingUpdates = new Map()

  // single array pass for ALL queued updates
  this.sessions = this.sessions.map(s => {
    const patch = updates.get(s.id)
    return patch ? { ...s, ...patch } : s
  })
}
```

Result: 5 rapid events → 1 array rebuild → 1 re-render cycle.

### Files to change
- `frontend-svelte/src/lib/store.svelte.ts` — `updateSession()` method

---

## Priority 4 — Idle-Friendly Tick for Stale Checks

### Problem
`setInterval(() => store.tick++, 30_000)` forces full re-render of `filteredSessions` + `stats` every 30s, even during animations.

### Fix
Use `requestIdleCallback` so stale checks run when browser is idle, not mid-animation:

```typescript
// BEFORE
setInterval(() => { store.tick++ }, 30_000)

// AFTER — only tick when browser has free time
function scheduleTick() {
  setTimeout(() => {
    // requestIdleCallback ensures we don't interrupt animations
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        store.tick++
        scheduleTick()
      })
    } else {
      store.tick++
      scheduleTick()
    }
  }, 30_000)
}
scheduleTick()
```

### Files to change
- `frontend-svelte/src/lib/store.svelte.ts` — tick interval setup

---

## Priority 5 — Reduce Animation Count When Not Visible

### Problem
Cards off-screen still run CSS animations → wasted GPU/CPU cycles.

### Fix
Use `IntersectionObserver` to pause animations on cards outside viewport:

```svelte
<!-- SessionCard.svelte -->
<script lang="ts">
  let cardEl: HTMLElement
  let isVisible = $state(true)

  $effect(() => {
    if (!cardEl) return
    const observer = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0 }
    )
    observer.observe(cardEl)
    return () => observer.disconnect()
  })
</script>

<div bind:this={cardEl} class:animations-paused={!isVisible}>
  ...
</div>

<style>
  .animations-paused, .animations-paused * {
    animation-play-state: paused !important;
  }
</style>
```

### Files to change
- `frontend-svelte/src/lib/components/SessionCard.svelte`

---

## Summary

| # | Fix | Impact | Effort | Root Cause |
|---|-----|--------|--------|------------|
| 1 | Compositor-only animations | High — eliminates frame drops | Medium | conic-gradient + box-shadow repaint |
| 2 | Fix N+1 query | High — faster initial load | Low | per-session model_id query |
| 3 | Batch WS store updates | Medium — fewer re-renders | Low | 1 array rebuild per WS event |
| 4 | Idle-friendly tick | Low-Medium — smoother 30s intervals | Low | setInterval during animations |
| 5 | Pause offscreen animations | Medium — less GPU work | Low | invisible cards still animating |

### Not changing
- Tech stack (Svelte 5, Bun, Hono, SQLite, raw WS) — all correct choices
- Animations themselves — keeping all of them, just making them GPU-friendly
- WebSocket architecture — already production-grade (worker heartbeat, backoff, auth queue)
- State management pattern — runes are optimal, just need batching
