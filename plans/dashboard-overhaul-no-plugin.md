# Dashboard Overhaul — Backend + Frontend (No Plugin Changes)

> This plan covers all changes that do NOT require modifying the OpenCode plugin (`plugin/dashboard.ts`).
> Plugin-side changes (full tool commands, bing dedup at plugin level) are in a separate plan file.

---

## 1. Multiple Bing Fix (Backend Dedup)

### Problem
When user presses ESC to cancel a session in OpenCode TUI, the `cancel()` function in `packages/opencode/src/session/prompt.ts` (lines 248-260) can be called multiple times. Each call fires `SessionStatus.set(sessionID, "idle")` which publishes both `session.status` and `session.idle` bus events — even when the session is already dead. There is zero deduplication anywhere in the chain:

- OpenCode bus → no dedup
- Plugin → forwards every `session.idle` immediately via HTTP POST
- Backend → broadcasts every idle event to all WS clients
- Frontend → plays notification sound on every idle message

Result: user hears the "bing" sound multiple times for one cancel action.

### What We Want
One bing per cancel. Period.

### Decision: Fix at Backend Level
We fix this in the backend webhook handler. When a `session.idle` event arrives, check if the session is already idle in the DB. If yes, skip the broadcast.

### What We Do NOT Want
- No changes to OpenCode source code (not our repo to maintain)
- No inventing new event types
- No frontend-side dedup (symptom masking)

### Reference Files
- `backend/src/handlers/webhook.ts` — lines 119-135 (idle event handler)
- `backend/src/websocket/server.ts` — lines 38-50 (broadcast method, no dedup currently)
- OpenCode source: `packages/opencode/src/session/prompt.ts` lines 248-260 (root cause — cancel() emits on every call)
- OpenCode source: `packages/opencode/src/session/status.ts` lines 61-75 (publishes both session.status + session.idle per call)

---

## 2. Time Per Model Analytics

### Problem
We want to know how much time we spend with each model, how fast each model responds on average, broken down by project. Data already exists in DB but no queries or UI to surface it.

### What Already Exists
- `token_usage` table has: `duration_ms`, `model_id`, `provider_id`, `session_id`, `agent`, `timestamp`
- Plugin already calculates `durationMs` per LLM call (step-start to message finish) and sends it
- `sessions` table has: `parent_session_id`, `directory`
- Existing endpoint `/api/analytics/model-performance` gives average duration per model over time periods — but not total cumulative time

### What We Want
- **Main agent time only** — filter by joining `sessions` where `parent_session_id IS NULL` (sub-agents run in parallel and would skew averages)
- **Average response time per model** — "claude-opus averages 45s, sonnet averages 12s"
- **Total cumulative time per model** — "spent 8 hours with opus, 3 hours with sonnet"
- **Per session duration** — sum of main agent `duration_ms` entries for a session
- **Per project breakdown** — all above grouped by `sessions.directory`

### New Backend Endpoint(s)
Query pattern:
```sql
SELECT 
  tu.provider_id, tu.model_id,
  s.directory,
  SUM(tu.duration_ms) as total_time_ms,
  AVG(tu.duration_ms) as avg_time_ms,
  COUNT(*) as num_calls
FROM token_usage tu
JOIN sessions s ON tu.session_id = s.id
WHERE tu.duration_ms IS NOT NULL 
  AND s.parent_session_id IS NULL  -- main agent only
GROUP BY tu.provider_id, tu.model_id, s.directory
```

### Frontend Display
On the analytics page. Layout TBD during implementation — but should show tables/charts for the above metrics.

### What We Do NOT Want
- Sub-agent time mixed in with main agent (they're parallel, would inflate numbers)
- Wall clock time (time between user messages includes user idle time — useless)

### Reference Files
- `backend/src/db/schema.ts` — lines 42-60 (token_usage table)
- `backend/src/db/schema.ts` — lines 10-24 (sessions table, parent_session_id at line 16)
- `backend/src/handlers/api.ts` — lines 575-656 (existing model-performance endpoint)
- `frontend-svelte/src/routes/analytics/+page.svelte` — analytics page

---

## 3. Markdown CSS Improvements

### Problem
Session detail page uses `marked` + `DOMPurify` for rendering markdown on `message` and `user` event types. The CSS exists (`.markdown-content` in `<svelte:head>`) but is too minimal — headings have no proper sizing, paragraphs are cramped, code blocks lack contrast, no table styling.

### What We Want
Proper typography for:
- `h1` through `h4` — distinct font sizes, font weight, vertical spacing, bottom border on h1/h2
- `p` — more vertical margin (`0.5em` instead of current `0.25em`)
- `pre` / `code` — better background contrast, syntax-friendly
- `ul` / `ol` — proper indentation and list spacing
- `table` — GFM table support with borders, padding, alternating row color
- `hr` — styled separator
- `blockquote` — already decent, keep as is
- Overall more breathing room between elements

### What We Do NOT Want
- No new markdown library (marked + DOMPurify work fine)
- No inventing custom component wrappers — pure CSS fix
- Keep it dark-theme native using existing CSS variables

### Reference Files
- `frontend-svelte/src/routes/sessions/[id]/+page.svelte` — lines 146-192 (current .markdown-content styles)
- Lines 73-76 (marked config)
- Lines 79-82 (renderMarkdown function)
- Lines 334-338 (where markdown is rendered in template)

---

## 4. Session Detail Header — Floating Bar

### Problem
Current header is a big static block taking up vertical space on the session detail page (`/sessions/[id]`). Shows `Title + Status` row then a 4-column meta grid (`Hostname | Directory | Tokens | Cost`). This eats into the chat stream area. We're also adding more info (session ID, created time, model badges) which would make it even bigger.

### What We Want
Replace the static header with a **floating frosted glass bar** that sits on top of the chat stream.

**Compact state** (always visible, floating at top of page):
- Thin bar with `backdrop-blur` (frosted glass effect) — semi-transparent so chat scrolls behind it
- Shows only: `status dot · title · tokens · cost` — one line, minimal
- Subtle gradient fade at bottom edge so chat doesn't look cut off underneath

**Expanded state** (on hover):
- Bar smoothly expands downward with `transition-all` animation
- Reveals full info:
  - Session ID (mono, truncated ~12 chars, copy button)
  - Created time (formatted e.g. "Feb 12, 2:19 PM")
  - Hostname
  - Directory
  - Model badges (pill tags for each distinct model used)
  - Tokens, cost
- Mouse leaves → smoothly collapses back to compact

**Chat stream takes full page height** — scrolls underneath the floating bar. No wasted vertical space.

### New Backend Data Needed
Extend the session detail API response to include distinct models used:
```sql
SELECT DISTINCT model_id FROM token_usage WHERE session_id = ? AND model_id IS NOT NULL
```

Could be a new endpoint or added to existing `GET /api/sessions/:id` response.

### What We Do NOT Want
- No big static header block eating vertical space
- No click-to-expand (hover is faster, more fluid)
- No excessive info in compact state — just enough to know what session you're looking at
- Session ID should NOT show the full ID — truncate with copy button

### Reference Files
- `frontend-svelte/src/routes/sessions/[id]/+page.svelte` — lines 217-275 (current static header block to replace)
- `frontend-svelte/src/lib/types.ts` — lines 3-15 (Session interface, has `created_at` already)
- `frontend-svelte/src/lib/utils.ts` — formatting helpers
- `backend/src/handlers/api.ts` — lines 129-131 (session detail endpoint)

---

## 5. Per-Message Model Badge

### Problem
Currently `model_id` shows at the bottom of message events in muted gray text (lines 346-350). It's easy to miss and disconnected from the message context.

### What We Want
Move model name **next to the event type label** on assistant messages. Rendered as a small mono badge:

```
> MESSAGE  claude-opus-4                    2:19 PM
  Here's the response text in markdown...
```

### What We Do NOT Want
- No badge on user messages (user doesn't have a model)
- No badge on tool events (tool_name already shown there)
- Keep it subtle — mono text, slightly different bg, not a loud colored pill

### Reference Files
- `frontend-svelte/src/routes/sessions/[id]/+page.svelte` — lines 309-320 (event type label + tool_name area)
- Lines 346-350 (current model_id display at bottom — remove this)
- `frontend-svelte/src/lib/types.ts` — `TimelineEvent.model_id` field

---

## 6. Sub-Agent Timeline View (Tab + Live Cards)

### Problem
Sub-agent sessions exist in the data (`parent_session_id` links them to parent). Currently there's a sidebar toggle that lists sub-agents with basic info (title, tokens) and clicking navigates to their session page. But there's no way to see them all at a glance with live status in the parent session context.

### What We Want
A **tab/toggle** on the session detail page: `Chat | Sub-agents`

- **Chat tab** → current timeline view (no changes)
- **Sub-agents tab** → switches main content area to:
  - **Vertical timeline** running down the left side
  - **Sub-agent cards** hanging off to the right, positioned by their `created_at` timestamp
  - Each card looks like the **main dashboard session cards** — same component, same style:
    - Status dot with glow
    - Title
    - Model name
    - Directory
    - Live streaming message preview (latest activity)
  - **Same animations as main cards** — green glow = running, yellow glow = idle
  - **Clicking** a sub-agent card → opens full session detail view (`/sessions/[subagentId]`)

### Data
- Sub-agents identified purely by `parent_session_id` — no tool-matching needed
- Timeline ordering by `created_at` timestamp
- Sub-agent live data comes through existing WebSocket updates (already works for all sessions)
- May need to pre-load sub-agent session data when loading parent session

### What We Do NOT Want
- No trying to match which tool/message spawned the sub-agent (won't work for community tools)
- No inventing new animation styles — reuse main card green/yellow glow exactly
- No complex nested timelines — just cards on a timeline rail
- No expanding sub-agent timeline inline (clicking opens the full page instead)

### Reference Files
- `frontend-svelte/src/routes/sessions/[id]/+page.svelte` — lines 28-29 (subagents derived), lines 378-418 (current sidebar)
- `frontend-svelte/src/lib/components/SessionCard.svelte` — reuse this for sub-agent cards
- `frontend-svelte/src/lib/store.svelte.ts` — lines 39-42 (`hasActiveSubAgents` helper)
- `frontend-svelte/src/lib/types.ts` — Session interface has `parent_session_id`
- `backend/src/db/schema.ts` — line 16 (`parent_session_id`), line 93 (index on it)

---

## 7. Main Card — Blue Spinning Glow (Idle + Sub-agents Running)

### Problem
When main agent goes idle but sub-agents are still running, the main card just shows regular idle state. User can't tell at a glance that background work is happening.

### What We Want
A third visual state for main session cards on the dashboard:

| State | Animation |
|---|---|
| Main agent working | Green glow (existing) |
| Main idle + sub-agents still running | **Blue spinning glow** (new) |
| Everything idle | Yellow/amber (existing) |

### Data
`store.hasActiveSubAgents(sessionId)` already exists in the store. Condition:
- `session.status === 'idle' && store.hasActiveSubAgents(session.id)` → blue spin

### What We Do NOT Want
- No new colors for sub-agent cards themselves — they use green/yellow like everything else
- Blue spinning glow is ONLY for the main parent card on the dashboard page
- Keep the animation consistent with existing glow style, just different color

### Reference Files
- `frontend-svelte/src/lib/components/SessionCard.svelte` — current glow/animation logic
- `frontend-svelte/src/lib/store.svelte.ts` — `hasActiveSubAgents` method
- `frontend-svelte/src/lib/components/StatusDot.svelte` — status dot component

---

## High-Stakes Rules

1. **Do NOT invent new design patterns** — reuse existing card styles, glow animations, color schemes. The sub-agent cards inside the timeline view use the exact same green/yellow animations as main cards.
2. **Do NOT touch the plugin** — this plan is backend + frontend only. Plugin changes are in a separate plan.
3. **Do NOT mix sub-agent time into main agent analytics** — always filter by `parent_session_id IS NULL`.
4. **Do NOT try to match sub-agents to specific tool calls** — identify children purely by `parent_session_id`. Community tools can spawn sub-agents too.
5. **Do NOT add excessive columns to existing DB tables** — the data we need mostly exists already. New queries, not new schema (except if absolutely necessary).
6. **Keep markdown rendering library as-is** — `marked` + `DOMPurify` work fine, it's a CSS problem not a library problem.
