# OpenCode Dashboard

> Real-time dashboard for monitoring OpenCode AI coding sessions across multiple VPS instances.

## Tech Stack

**Backend:**
- Bun runtime
- Hono (web framework)
- bun:sqlite (database)
- WebSocket (real-time updates)
- bun:test (testing)

**Frontend:**
- Bun runtime
- Vite + React + TypeScript
- Tailwind CSS (square-ui design tokens)
- Zustand (state management)
- Lucide React (icons)

## Architecture

```
Plugin → POST /events → Backend (Bun + Hono + SQLite)
                                    ↓
                              WebSocket Broadcast
                                    ↓
Frontend (React) ← ws://localhost:3001
```

## Quick Start

```bash
# Install dependencies
cd backend && bun install
cd frontend && bun install

# Start servers
cd backend && bun run dev  # http://0.0.0.0:3000
cd frontend && bun run dev # http://0.0.0.0:5173
```

## API Endpoints

**Sessions:**
- `GET /api/sessions` - List all sessions (filters: hostname, status, search)
- `GET /api/sessions/:id` - Get session with timeline

**Analytics:**
- `GET /api/analytics/summary` - Total sessions, tokens, cost
- `GET /api/analytics/models` - Token usage by model
- `GET /api/analytics/daily` - Daily usage calendar

**Other:**
- `GET /api/instances` - List VPS instances
- `POST /events` - Webhook for plugin events
- `GET /health` - Health check

## WebSocket Events

**Send:**
```json
{ "type": "auth", "password": "your-password" }
```

**Receive:**
```json
{ "type": "session.created", "data": { "id": "...", "title": "...", "hostname": "..." } }
{ "type": "session.updated", "data": { "id": "...", "title": "..." } }
{ "type": "timeline", "data": { "sessionId": "...", "eventType": "...", "summary": "..." } }
{ "type": "attention", "data": { "sessionId": "...", "needsAttention": true } }
{ "type": "idle", "data": { "sessionId": "..." } }
```

## Testing

```bash
# Backend tests
cd backend && bun test

# Frontend tests
cd frontend && bun test
```

## Environment Variables

```env
BACKEND_PORT=3000
API_KEY=your-plugin-api-key
FRONTEND_PASSWORD=your-dashboard-password
DATABASE_URL=./data/database.db
```

## Authentication

The dashboard uses two separate passwords for different access levels:

### API_KEY (Plugin → Webhook)
- Used by the OpenCode plugin to send data to the webhook
- Validates `X-API-Key` header on `/events` endpoint
- If not set, allows localhost requests without auth (no-config mode)

### FRONTEND_PASSWORD (Dashboard UI → API)
- Used to protect the dashboard frontend
- Validates `X-API-Key` header on all `/api/*` endpoints and WebSocket connection
- Required to access the web interface

### Setting up Plugin Config

Create `~/.config/opencode/dashboard.toml`:

```toml
url = "http://localhost:3000"
apiKey = "your-api-key"
hostname = "my-vps-hostname"
```

Or per-project `.opencode/dashboard.toml` (overrides global config).

## Features

- ✅ Real-time session monitoring
- ✅ WebSocket updates (instant sync)
- ✅ Session filters (hostname, status, search)
- ✅ Attention indicators with pulse animation
- ✅ Token usage tracking
- ✅ Cost calculation
- ✅ VPS instance management
- ✅ Beautiful, polished UI (Vercel-inspired)
- ✅ Dark/light mode support
- ✅ Responsive design
- ✅ TDD throughout

## UI Components

**Base:** Button, Input, Skeleton, Separator, Tooltip, Badge, Card

**Dashboard:**
- StatCard - Analytics metrics with icons
- SessionCard - Session display with status and attention badges
- SessionFilters - Search and dropdown filters

## Status ✅

- Backend: 100% complete (22 tests passing)
- Frontend: 95% complete (dashboard live, full functionality)
- Missing: Analytics page, Settings page, Session detail modal

## License

MIT
