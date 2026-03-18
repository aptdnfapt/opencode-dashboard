# OpenCode Dashboard - Agent Guidelines

## Package Manager
**Always use `bun`** — never `npm` or `yarn`.

## Project Layout
- `frontend-svelte/` — Active frontend (Svelte 5 + SvelteKit + Tailwind v4)
- `frontend-archive/` — Archived React frontend (do NOT modify)
- `backend/` — Hono API server + WebSocket (Bun runtime)
- `plugin/` — OpenCode plugin that feeds data to the dashboard

## Commands

### Frontend (run in `/frontend-svelte`)
```bash
bun run dev          # Dev server at http://localhost:5173
bun run build        # Production build (vite build)
bun run check        # svelte-kit sync + svelte-check (type checking)
bun run lint         # ESLint — TS/Svelte code quality
bun run lint:all     # Both ESLint + Stylelint
bun run test         # Vitest — frontend unit tests
bun run test path/to/file.test.ts  # Run single test file
```

### Backend (run in `/backend`)
```bash
bun run dev          # Dev server with --watch at http://localhost:3000
bun test             # Run all tests (bun:test)
bun test path/to/file.test.ts      # Run single test file
```

### Pre-commit Checks
```bash
cd frontend-svelte && bun run check && bun run lint:all
cd backend && bun test
```

## Code Style

### Imports
- **Frontend:** Use `$lib/` alias for internal imports (`import { store } from '$lib/store.svelte'`)
- **Backend:** Standard relative imports
- **Order:** type imports → external deps → internal modules
- Always use `import type` for type-only imports

### TypeScript
- Strict mode enabled in both frontend and backend
- Use `type` keyword for type aliases; define interfaces near implementation
- Avoid `as any` — prefer proper typing

### Naming Conventions
- **Components:** PascalCase (`SessionCard.svelte`)
- **Non-component files:** kebab-case (`store.svelte.ts`, `api.ts`)
- **Functions/variables:** camelCase (`getSessions`, `handleSearch`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_TIMELINE_EVENTS`)
- **Types/Interfaces:** PascalCase (`Session`, `TimelineEvent`)
- **DB tables/columns:** snake_case (`timeline_events`, `parent_session_id`)
- **Test files:** `.test.ts` suffix

### Svelte Component Structure
```svelte
<script lang="ts">
  // 1. Type imports → Store/util imports
  import { store } from '$lib/store.svelte'
  import type { Session } from '$lib/types'

  // 2. Props
  interface Props { session: Session; selected?: boolean }
  let { session, selected = false }: Props = $props()

  // 3. Local state → Derived → Effects → Event handlers
  let menuOpen = $state(false)
  let displayStatus = $derived(...)
  $effect(() => { ... })
  async function handleArchive(e: MouseEvent) { ... }
</script>
```

### State Management
- **Global:** Svelte 5 runes via `DashboardStore` class in `$lib/store.svelte.ts`
  - Singleton: `export const store = new DashboardStore()`
  - Use `Map<K, V>` for collections; immutable updates
- **Component:** `$state()`, `$derived()`, `$props()`, `$effect()`

### Styling (Tailwind CSS v4)
- CSS custom properties: `var(--bg-primary)`, `var(--fg-primary)`, `var(--border)`
- Applied via bracket notation: `bg-[var(--bg-secondary)]`
- Status colors: `text-emerald-500` (active), `text-amber-500` (idle), `text-rose-500` (error)
- Consistent 4px grid: `p-3`, `gap-3`

### Error Handling
- Wrap all async operations in try/catch
- Use `console.warn()` for non-critical errors
- Backend API errors: `c.json({ error: 'message' }, statusCode)`
- WebSocket errors: log and continue, never crash the app

### Testing (Backend - bun:test)
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
describe('MyFeature', () => {
  beforeEach(() => { /* seed data */ })
  afterEach(() => { db.close() })
  it('should work', () => { expect(true).toBe(true) })
})
```
- Use in-memory SQLite: `new Database(':memory:')`
- Test API routes via Hono's `app.fetch(new Request(...))`

### Database (SQLite)
- WAL mode enabled; timestamps as Unix milliseconds (`Date.now()`)
- Schema in `backend/src/db/schema.ts`
- Use prepared statements for all queries

### API & WebSocket
- Framework: Hono — endpoints under `/api/*`
- Auth: `X-API-Key` header; Health check: `GET /health` (no auth)
- WebSocket on port 3001 — auth via `{ type: 'auth', password }` message

## File Organization

**Frontend (`frontend-svelte/src/`):**
- `lib/components/` — Svelte components (`SessionCard`, `StatCard`, `Heatmap`, `StatusBar`, `TimelineView`)
- `lib/store.svelte.ts` — Global state
- `lib/types.ts` — Shared TypeScript types
- `lib/api.ts` — API client functions
- `routes/` — SvelteKit pages

**Backend (`backend/src/`):**
- `db/` — Schema and connection
- `handlers/` — API route handlers
- `websocket/` — WebSocket server + manager

## Process Management
**NEVER** kill processes by port. Start servers in background, stop by PID:
```bash
cd backend && bun run dev > /tmp/backend.log 2>&1 &
echo "Backend PID: $!"
tail -20 /tmp/backend.log
kill <pid>
```

## Critical Rules

### No Auto-Commit
- **NEVER commit changes automatically** — only commit when user explicitly asks

### UI/Component Changes Require Approval
- **Do NOT create new components** without explicit user approval
- Reuse existing components from `lib/components/`
- Maintain existing theme/styling patterns — don't introduce new design patterns

### File Modification Safety — PREVENT ACCIDENTAL DELETIONS
- **Prefer targeted edits** over rewriting entire files
- If you DO overwrite a file:
  1. Run `git diff <file>` BEFORE finalizing
  2. Review EVERY changed line — ensure nothing was removed unintentionally
  3. Small UI details, edge cases, helper functions — all must be preserved
- **Triple-check rule**: one careful edit > three careless rewrites

### Git Diff Verification
```bash
git diff --stat                    # Quick overview
git diff <file>                    # Detailed diff
git diff <file> | grep "^-"        # Show only removed lines
```

### Change Consciousness Checklist
- [ ] All existing functionality preserved?
- [ ] Checked git diff for accidental removals?
- [ ] Edge cases still handled?
- [ ] Helper functions/utilities still present?
- [ ] Existing styling classes preserved?