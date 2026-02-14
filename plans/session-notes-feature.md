# Session Notes — Pull-Tab Drawer on Chat Page

> Per-session notes with inline message references. Right-edge pull-tab drawer overlay on the session detail page.
> Backend DB storage, no plugin changes.

---

## 1. Pull-Tab Drawer

### Problem
There is no way to take notes while reviewing a chat session. Users want to annotate what happened, bookmark interesting messages, and leave breadcrumbs for themselves — all without leaving the chat page.

### What We Want

A pull-tab drawer anchored to the right edge of the chat page (`/sessions/[id]`).

**The handle:**
- A small vertical tab fixed to the right edge of the page, vertically centered
- Shows a `>` chevron when closed, `<` when open
- Always visible — sits on top of the chat content at the right edge
- Subtle styling that matches the theme — not loud, not invisible

**Opening and closing:**
- Click the `>` handle → panel slides out from the right edge as an overlay, ~350px wide
- Click the `<` handle → slides back flush to the right edge
- Smooth CSS transition on the slide, around 300ms
- Panel does NOT push chat content left — it floats on top with a slight left-edge shadow
- Solid or slightly translucent background so chat content underneath does not bleed through

**Inside the panel:**
- Header row with "Notes" title and a "New Note" button
- List of notes for the current session, newest first
- Each note shows its text content, created timestamp, and a delete action
- "New Note" opens an inline textarea at the top of the list — plain text input, no rich editor
- Type the note, hit Save. Cancel discards.
- Empty state when no notes exist — simple "No notes yet" message

### As a User
- "I'm reviewing a session and want to jot down what I learned — I click `>`, the notes panel slides out, I write my note and save it. Click `<` and I'm back to the chat."
- "I come back to this session tomorrow and open the notes drawer — my notes are still there because they're stored in the backend."

### What We Do NOT Want
- No sidebar that pushes the chat content — overlay only
- No modal or popup — it's a sliding drawer
- No rich text editor or markdown editor — plain textarea
- No keyboard shortcut to open (for now) — click only
- No drag-to-resize the drawer width — fixed width

### Reference Files
- `frontend-svelte/src/routes/sessions/[id]/+page.svelte` — chat page where the drawer lives
- `frontend-svelte/src/lib/components/` — new component goes here

---

## 2. Message Numbering in Chat

### Problem
Users need a way to reference specific messages in their notes. Currently there is no visible identifier on events in the timeline.

### What We Want

Every event in the chat timeline gets a visible sequential number displayed on the event card.

- Numbers are `#1`, `#2`, `#3`... based on the event's position in the timeline array (1-based index)
- Displayed as a small muted badge on the event card — top-right corner or inline with the event header
- Subtle styling — should not compete with the event content for attention
- Numbers correspond to the rendered order, not the database ID — so they always start at 1 and go up sequentially for a given session

### As a User
- "I see `#14` on a message and `#27` on another. Now I know what numbers to type in my notes to reference them."

### What We Do NOT Want
- No using the database `id` field as the display number — those are large integers that mean nothing to the user
- No hiding the number behind a hover — always visible
- No clickable behavior on the number badge itself — it's just a label

### Reference Files
- `frontend-svelte/src/routes/sessions/[id]/+page.svelte` — lines 296-359 (event rendering loop, index available from `{#each}`)
- `frontend-svelte/src/lib/types.ts` — `TimelineEvent` interface

---

## 3. Inline Message References in Notes

### Problem
Notes are more useful when they can link back to specific messages in the chat. Users want to write things like "started refactoring at #5, hit an error at #12, final solution at #27" and have those references be clickable.

### What We Want

**Writing references:**
- In the note textarea, users type `#N` naturally as plain text (where N matches the event number shown in the chat)
- No special button, no autocomplete dropdown, no modal — just type the number you see on the message

**Displaying references:**
- When a note is saved and rendered in the drawer, any `#N` pattern in the text is rendered as a clickable pill/tag
- The pill is visually distinct from surrounding text — small inline element with a subtle background

**Clicking a reference:**
- Click a `#N` pill in the notes drawer → the chat scrolls to that event and briefly highlights it
- Highlight is a temporary visual flash — border glow or background pulse, fades after ~1.5 seconds
- If the event number does not exist in the current timeline (e.g. events were deleted or number is out of range), the pill renders as plain text or with a "not found" style — no crash, no error

**Storage:**
- Note content stored as plain text with `#N` patterns left as-is
- On save, backend parses the content and extracts all `#N` numbers into a separate JSON array field for potential future querying
- Frontend does the rendering transformation from `#N` text to clickable pills at display time

### As a User
- "I type `started at #3, pivoted at #12, resolved at #25` in my note. When I view the note later, each `#N` is a clickable link. I click `#12` and the chat jumps right to that message with a quick highlight."
- "I can reference as many messages as I want in a single note — no limit. One note can tell the full story of a session."

### What We Do NOT Want
- No special insert button or message picker UI — just type the number
- No autocomplete or suggestions while typing — keep it dead simple
- No breaking if a referenced event does not exist — graceful fallback
- No storing rendered HTML in the database — store plain text, render on display

### Reference Files
- `frontend-svelte/src/routes/sessions/[id]/+page.svelte` — scroll logic and event DOM elements
- New component for rendering note content with parsed `#N` pills

---

## 4. Backend — Database & API

### What Already Exists
- `sessions` table with `id` as the primary key
- `timeline_events` table with auto-increment `id` and `session_id` foreign key
- API pattern: Hono framework, all endpoints under `/api/*`, auth via `X-API-Key` header
- Existing `GET /api/sessions/:id` returns session + timeline data

### What We Want

**New table: `notes`**
- Auto-increment integer primary key
- Session ID linking to the sessions table
- Content as plain text
- Message refs as a JSON text field — array of integers extracted from `#N` patterns in content
- Created timestamp as Unix milliseconds
- Updated timestamp as Unix milliseconds
- Index on session_id for fast lookups

**New API endpoints:**
- `GET /api/sessions/:id/notes` — returns all notes for a session, ordered newest first
- `POST /api/sessions/:id/notes` — creates a new note, body contains content text, backend extracts `#N` refs and stores them
- `PATCH /api/notes/:id` — updates note content, re-extracts `#N` refs
- `DELETE /api/notes/:id` — deletes a note

**Modification to existing endpoints:**
- `GET /api/sessions` (list) — include a `notes_count` field on each session object, derived from a count of notes per session
- `GET /api/sessions/:id` (detail) — include `notes_count` in the session object
- `DELETE /api/sessions/:id` (delete session) — cascade delete associated notes

### As a User
- "My notes survive browser refreshes, clearing cache, switching devices — they live in the backend database."

### What We Do NOT Want
- No new authentication scheme — use the same `X-API-Key` header as all other endpoints
- No pagination on notes (sessions won't have hundreds of notes — simple array response is fine)
- No WebSocket events for notes — REST only, notes are not real-time collaborative
- No full-text search on notes (for now)

### Reference Files
- `backend/src/db/schema.ts` — table definitions, add new table here
- `backend/src/handlers/api.ts` — API routes, add new endpoints here
- `backend/src/db/schema.ts` — lines 87-96 (existing indexes pattern)

---

## 5. Note Count on Session Cards

### Problem
On the main dashboard, session cards show status, title, tokens, cost — but no indication of whether a session has notes. Users want a quick visual cue.

### What We Want
- A small note icon with a count badge on the session card — only visible when `notes_count > 0`
- When a session has zero notes, nothing shows — no icon, no badge, no empty state
- Subtle styling — should not compete with status indicators or cost display
- Consistent placement across all session cards

### As a User
- "I glance at the dashboard and see a note icon with `3` on one of my sessions — I know I left notes there. Sessions without notes show nothing extra."

### What We Do NOT Want
- No showing the icon when count is zero — clean cards by default
- No click action on the badge (for now) — it's informational only
- No new API call per card — the count comes from the existing sessions list response

### Reference Files
- `frontend-svelte/src/lib/components/SessionCard.svelte` — add badge here
- `frontend-svelte/src/lib/types.ts` — add `notes_count` to Session interface

---

## Future Expansion (Not in This Implementation)

These are noted for future brainstorming — do NOT implement now:

1. **Global Notes Page** — a new page accessible from the top navigation bar that shows all notes across all sessions. Searchable, filterable by session. Lets users find notes without remembering which session they were in.

2. **Sub-Agent Session Notes** — the same pull-tab drawer on sub-agent session pages. Same behavior, same storage, scoped to the sub-agent's session ID. No special handling needed since sub-agents use the same `/sessions/[id]` route.

3. **Note Editing** — ability to edit an existing note's content after creation. Update the `#N` refs on save.

4. **Note Pinning** — pin a note to the top of the list so it does not get buried by newer notes.

5. **Note Export** — export all notes for a session as plain text or markdown.

---

## Implementation Order

1. **Backend first** — schema + migration + API endpoints + tests
2. **Frontend: drawer component** — pull-tab, slide animation, empty state
3. **Frontend: message numbering** — sequential `#N` badges on event cards
4. **Frontend: note CRUD** — create, display, delete notes in the drawer
5. **Frontend: `#N` reference parsing** — render pills, click-to-scroll, highlight
6. **Frontend: session card badge** — note count icon on dashboard cards
7. **Integration testing** — end-to-end flow

---

## High-Stakes Rules

1. **Drawer is an overlay** — it does NOT push chat content. It floats on top.
2. **Plain text only** — no rich text, no markdown rendering in notes. Just text with clickable `#N` refs.
3. **Sequential numbers, not DB IDs** — message numbers shown in chat are 1-based array indices, not database primary keys.
4. **Graceful ref failures** — if `#N` points to a nonexistent event, do not crash. Show it as plain text or a disabled pill.
5. **No plugin changes** — this is entirely backend + frontend.
6. **Reuse existing patterns** — same API auth, same DB access patterns, same component styling conventions.
