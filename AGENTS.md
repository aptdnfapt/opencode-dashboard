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
bun run preview      # Preview production build
bun run check        # svelte-kit sync + svelte-check (type checking)
bun run check:watch  # Type checking in watch mode
```

### Backend (run in `/backend`)
```bash
bun run dev          # Dev server with --watch at http://localhost:3000
bun run start        # Production server
bun test             # Run all tests (bun:test)
bun run test:watch   # Tests in watch mode
```

### Running a Single Test
```bash
# Backend only (no frontend tests exist yet)
cd backend && bun test path/to/file.test.ts
```

### Pre-commit Checks
```bash
cd frontend-svelte && bun run check
cd backend && bun test
```

## Code Style

### Imports
- **Frontend:** Use `$lib/` alias for internal imports (SvelteKit convention)
  - `import { store } from '$lib/store.svelte'`
  - `import { formatRelativeTime } from '$lib/utils'`
  - `import type { Session } from '$lib/types'`
- **Backend:** Standard relative imports
- **Order:** type imports → external deps → internal modules
- Always use `import type` for type-only imports
- Prefer named exports over default exports

### TypeScript
- Strict mode enabled in both frontend and backend
- Frontend: ES2020 target, bundler module resolution
- Backend: ES2022 target, ES2022 modules
- Use `type` keyword for type aliases; define interfaces near implementation
- Avoid `as any` — prefer proper typing

### Naming Conventions
- **Components:** PascalCase files and names (`SessionCard.svelte`, `StatCard.svelte`)
- **Non-component files:** kebab-case (`store.svelte.ts`, `api.ts`, `utils.ts`)
- **Functions/variables:** camelCase (`getSessions`, `handleSearch`, `menuOpen`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_TIMELINE_EVENTS`, `STALE_THRESHOLD_MS`)
- **Types/Interfaces:** PascalCase (`Session`, `TimelineEvent`, `WSMessage`)
- **Type guards:** camelCase with `is` prefix (`isTimelineWSData()`)
- **Classes:** PascalCase (`DashboardStore`, `WebSocketService`)
- **DB tables/columns:** snake_case (`timeline_events`, `parent_session_id`)
- **Test files:** `.test.ts` suffix

### Svelte Component Structure
```svelte
<script lang="ts">
  // 1. Type imports
  import type { Session } from '$lib/types'
  // 2. Store/util imports
  import { store } from '$lib/store.svelte'
  import { formatRelativeTime } from '$lib/utils'

  // 3. Props
  interface Props { session: Session; selected?: boolean }
  let { session, selected = false }: Props = $props()

  // 4. Local state
  let menuOpen = $state(false)

  // 5. Derived values
  let displayStatus = $derived(...)

  // 6. Effects
  $effect(() => { ... })

  // 7. Event handlers
  async function handleArchive(e: MouseEvent) { ... }
</script>

<!-- Template -->
<div>...</div>
```

### State Management
- **Global:** Svelte 5 runes via `DashboardStore` class in `$lib/store.svelte.ts`
  - `$state()` for reactive state, `$derived()` for computed values
  - Singleton: `export const store = new DashboardStore()`
  - Use `Map<K, V>` for collections (timelines, messages)
  - Immutable updates: `this.sessions = this.sessions.map(...)`
- **Component:** `$state()`, `$derived()`, `$props()`, `$effect()`

### Styling (Tailwind CSS v4)
- CSS custom properties for theming: `var(--bg-primary)`, `var(--fg-primary)`, `var(--border)`
- Applied via bracket notation: `bg-[var(--bg-secondary)]`, `text-[var(--fg-primary)]`
- Status colors: `text-emerald-500` (active), `text-amber-500` (idle), `text-rose-500` (error)
- Consistent 4px grid: `p-3`, `gap-3`, `mt-1`
- Transitions: `transition-all duration-150`

### Error Handling
- Wrap all async operations in try/catch
- Use `console.warn()` for non-critical errors (WS failures, audio, notifications)
- Backend API errors: return `c.json({ error: 'message' }, statusCode)`
- Early returns for validation failures
- Never expose sensitive data in error messages
- WebSocket errors: log and continue, never crash the app

### Testing (Backend Only)
- Runner: `bun:test` — imports from `'bun:test'`
- Structure: `describe()` → `beforeEach()` → `it()`
- Use in-memory SQLite: `new Database(':memory:')`
- Seed test data in `beforeEach()`, clean up in `afterEach(() => db.close())`
- Test API routes via Hono's `app.fetch(new Request(...))`

### Database (SQLite)
- WAL mode enabled (`PRAGMA journal_mode = WAL`)
- Schema in `backend/src/db/schema.ts` — tables: sessions, timeline_events, token_usage, file_edits, instances
- Use prepared statements for all queries
- Timestamps as Unix milliseconds (`Date.now()`)
- Foreign keys where applicable; indexes on frequently queried columns

### API & WebSocket
- Framework: Hono — all endpoints under `/api/*`
- Auth: `X-API-Key` header (except `/api/tts` which uses signed URLs)
- Health check: `GET /health` (no auth)
- WebSocket on port 3001 — auth via `{ type: 'auth', password }` message
- Event types: `session.created`, `session.updated`, `timeline`, `attention`, `idle`, `error`
- Auto-reconnect with exponential backoff; heartbeat ping every 30s

## File Organization

**Frontend (`frontend-svelte/src/`):**
- `lib/components/` — Svelte components (`SessionCard`, `Heatmap`, `StatusBar`, etc.)
- `lib/store.svelte.ts` — Global state (Svelte 5 runes)
- `lib/websocket.svelte.ts` — WebSocket client
- `lib/types.ts` — Shared TypeScript types
- `lib/api.ts` — API client functions
- `lib/utils.ts` — Utilities (formatting, colors)
- `routes/` — SvelteKit pages (`+page.svelte`, `+layout.svelte`)

**Backend (`backend/src/`):**
- `db/` — Schema and connection
- `handlers/` — API route handlers
- `websocket/` — WebSocket server + manager
- `services/` — External services (TTS)

## Process Management
**NEVER** kill processes by port (`lsof -ti:3000 | xargs kill`) or broad `pkill -f` patterns.

```bash
# Start servers in background
cd /home/idc/proj/opencode-dashboard/backend && bun run dev > /tmp/backend.log 2>&1 &
echo "Backend PID: $!"

cd /home/idc/proj/opencode-dashboard/frontend-svelte && bun run dev > /tmp/frontend.log 2>&1 &
echo "Frontend PID: $!"

# Check logs
tail -20 /tmp/backend.log
tail -20 /tmp/frontend.log

# Stop by PID only
kill <pid>
```




dont auto commit 


make detail commit when user asks for it 
