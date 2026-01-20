# OpenCode Dashboard - Agent Guidelines

## Package Manager
**IMPORTANT: Always use `bun` instead of `npm`** for all operations.

## Commands

### Frontend (run in `/frontend`)
```bash
bun run dev          # Start dev server (http://localhost:5173)
bun run build        # Build for production (tsc + vite build)
bun run preview      # Preview production build
bun run lint         # Run ESLint
bun run typecheck    # Run TypeScript type checking (noEmit)
bun test             # Run all tests (vitest run)
bun run test:watch   # Run tests in watch mode
```

### Backend (run in `/backend`)
```bash
bun run dev          # Start dev server with watch (http://localhost:3000)
bun run start        # Start production server
bun test             # Run all tests (bun:test)
bun run test:watch   # Run tests in watch mode
```

### Running a Single Test
**Frontend (vitest):**
```bash
cd frontend && bun test path/to/file.test.ts
```

**Backend (bun test):**
```bash
cd backend && bun test path/to/file.test.ts
```

## Code Style Guidelines

### Imports
- Frontend: Use absolute imports with `@/` alias (configured in vite.config.ts)
  - Example: `import { useStore } from '@/store'`
  - Example: `import { cn } from '@/lib/utils'`
- Group imports: external deps → local modules
- Use named exports for components and utilities
- React hooks: `import { useState, useEffect } from 'react'`

### TypeScript Configuration
- **Frontend:** ES2020 target, strict mode enabled, react-jsx
- **Backend:** ES2022 target, strict mode enabled, ES2022 modules
- Always use `type` keyword for type aliases when possible
- Define interfaces near implementation or in dedicated type files
- Use `as any` sparingly - prefer proper typing

### Naming Conventions
- **Components:** PascalCase (`SessionCard`, `StatCard`, `MultiLineChart`)
- **Hooks:** camelCase with `use` prefix (`useWebSocket`, `useStore`)
- **Utilities:** camelCase (`cn`, `formatRelativeTime`)
- **Store Actions:** camelCase (`setSessions`, `addSession`, `updateSession`)
- **Constants/Config:** camelCase (`statusConfig`, `navItems`)
- **Files:** kebab-case (`session-card.tsx`, `use-websocket.ts`, `api-handler.ts`)
- **Test Files:** `.test.ts` or `.test.tsx` suffix

### Component Structure
Imports (external → local) → Type definitions → Constants/config → Component definition. Use hooks at top, then handlers, effects, then render.

### State Management
- **Global state:** Use Zustand (see `/frontend/src/store/index.ts`)
- **Component state:** React hooks (`useState`, `useRef`, `useMemo`, `useCallback`)
- **Maps for collections:** Use `Map<K, V>` for timeline and messages (not objects)
- **Immutability:** Always return new objects in state updates

### Styling (Tailwind CSS)
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Semantic color tokens: `bg-background`, `text-foreground`, `border-border`
- Status colors: `text-emerald-500`, `text-amber-500`, `text-rose-500`
- Spacing: `p-4`, `gap-3`, `mt-1` (consistent 4px grid)
- Transitions: `transition-all duration-150`, `transition-colors`

### Error Handling
- Always wrap async operations in try/catch
- Use `console.warn()` for non-critical errors
- Avoid exposing sensitive data in error messages
- For WebSocket errors, log but don't break the app

### Testing
- **Frontend:** Vitest with jsdom, Testing Library
- **Backend:** Bun's built-in test runner
- Test structure: `describe()` → `beforeEach()` → `it()`
- Reset state in `beforeEach()` (especially for Zustand store)
- Test setup: `/frontend/src/test/setup.ts`
- Use in-memory SQLite for backend tests
- Always clean up resources in `afterEach()` (e.g., db.close())

### Database
- SQLite with WAL mode enabled (see `/backend/src/db/schema.ts`)
- All tables have appropriate indexes
- Use prepared statements for queries
- Foreign keys defined where applicable
- Database file: `./data/database.db` (configurable via DATABASE_URL)

### API & WebSocket
- **Framework:** Hono (backend), native WebSocket
- **Endpoints:** Use `/api/*` prefix
- **Auth:** `X-API-Key` header for /api/* routes (except /api/tts for audio)
- **WebSocket Auth:** Send `{ type: 'auth', password: '...' }` after connecting
- **Event types:** `session.created`, `session.updated`, `timeline`, `attention`, `idle`, `error`
- **Health check:** `GET /health`

### ESLint Rules
- `@typescript-eslint/no-explicit-any`: warn (allow sparingly)
- `@typescript-eslint/no-unused-vars`: warn (ignore `^_` prefix pattern)
- `react-hooks/set-state-in-effect`: off (allow before async ops)

### File Organization
**Frontend (`/frontend/src/`):**
- `components/ui/` - Base components (button, input, etc.)
- `components/dashboard/` - Dashboard-specific components
- `components/sessions/` - Session-related components
- `components/charts/` - D3-based chart components
- `components/eldoraui/` - Animated components
- `pages/` - Route pages
- `hooks/` - Custom React hooks
- `store/` - Zustand store
- `lib/` - Utilities
- `test/` - Test setup

**Backend (`/backend/src/`):**
- `db/` - Database schema and connection
- `handlers/` - API route handlers
- `websocket/` - WebSocket server
- `services/` - External services (TTS, etc.)

### Git Workflow
- Both frontend and backend share the root `package.json` for common deps
- Run lint and typecheck before committing:
  ```bash
  cd frontend && bun run lint && bun run typecheck
  cd backend && bun run typecheck
  ```
- Keep tests passing (22 backend tests, all frontend tests)

### Performance
- Use `useCallback` and `useMemo` to prevent unnecessary re-renders
- Use `useRef` for values that don't trigger re-renders (e.g., audio queue)
- Avoid inline object/array creation in JSX (create outside render)
- For large lists, consider virtualization

### Accessibility
- Use semantic HTML elements
- Button components support keyboard navigation
- Notifications use browser Notification API (HTTPS required)
- Audio playback has opt-in via localStorage settings
