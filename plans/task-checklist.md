# Dashboard Overhaul — Task Checklist

> Every feature broken down into individual items. No code — just plain English descriptions.
> Refer to `plans/dashboard-overhaul-no-plugin.md` for full context, reasoning, and file references.

---

## Task 1: Multiple Bing Fix

- [ ] When a `session.idle` event arrives at the backend, check if that session is already idle in the database before doing anything
- [ ] If session is already idle, skip the broadcast entirely — don't send anything to frontend clients
- [ ] If session is NOT already idle, proceed as normal — update DB, broadcast to frontend
- [ ] This means: one ESC cancel = one bing sound. No matter how many duplicate idle events the plugin sends

---

## Task 2: Time Per Model Analytics

### Backend
- [ ] New API endpoint that returns total time spent per model, average response time per model, and number of calls — grouped by project directory
- [ ] Only count main agent sessions — exclude sub-agents (where parent_session_id is not null) because they run in parallel and would inflate the numbers
- [ ] Data comes from the existing `token_usage` table which already has `duration_ms`, `model_id`, `provider_id` per LLM call

### Frontend (Analytics Page)
- [ ] New section on the analytics page showing time per model
- [ ] A chart or table showing average response time per model (e.g. "claude-opus averages 45s per response")
- [ ] A chart or table showing total cumulative time per model (e.g. "spent 8 hours with opus total")
- [ ] Ability to see the breakdown per project (which project used which model for how long)
- [ ] Fetch data from the new backend endpoint on page load, same pattern as existing analytics sections

---

## Task 3: Markdown CSS Improvements

- [ ] Headings h1 and h2 should have distinct large font sizes, bold weight, vertical spacing above and below, and a subtle bottom border line
- [ ] Headings h3 and h4 should have slightly larger font than body text, bold weight, proper spacing
- [ ] Paragraphs need more breathing room between them — not cramped together
- [ ] Code blocks (multi-line) need better background contrast so they visually stand out from surrounding text
- [ ] Inline code (single backtick) should have a subtle background pill, already exists but verify it looks good
- [ ] Unordered and ordered lists need proper indentation and spacing between items
- [ ] Tables (GFM markdown tables) need borders, cell padding, header row with different background, alternating row colors
- [ ] Horizontal rules need to be a visible styled separator line
- [ ] Blockquotes are already decent — keep as is
- [ ] All styles should use existing CSS variables for colors to stay consistent with dark theme
- [ ] Do not change the markdown library — keep marked + DOMPurify, this is purely a CSS fix

---

## Task 4: Floating Header Bar

### Positioning
- [ ] The bar must actually float — it stays pinned at the top of the content area while the chat stream scrolls behind it underneath
- [ ] The chat timeline should take the full available height — no vertical space wasted by a static header block
- [ ] The bar sits on top of the chat with a higher z-index so content scrolls behind it

### Frosted Glass Effect
- [ ] The bar background must be semi-transparent enough that you can actually see the chat content scrolling behind it through the glass
- [ ] Apply backdrop blur so the content behind looks blurred/frosted, not just transparent
- [ ] It should feel like looking through frosted glass — you see motion and color behind but can't read it clearly

### Compact State (default, always visible)
- [ ] One thin line showing: status dot, session title, token count, cost
- [ ] Minimal height — just enough for one row of info
- [ ] Subtle gradient fade at the bottom edge so the chat underneath doesn't look sharply cut off

### Expanded State (on hover)
- [ ] When mouse enters the bar, it smoothly expands downward with a transition animation
- [ ] Shows additional info: session ID (truncated to ~12 chars with a copy button), created time (formatted like "Feb 12, 2:19 PM"), hostname, directory
- [ ] Shows model badges — small pill tags for each distinct model used in the session
- [ ] Shows tokens and cost (same data as compact but now with labels)
- [ ] Status badge (active/idle/error) with colored background
- [ ] When mouse leaves, smoothly collapses back to compact state

### Backend Support
- [ ] The session detail API response needs to include the list of distinct models used in that session
- [ ] Query the token_usage table for distinct model_id values for that session

---

## Task 5: Per-Message Model Badge

- [ ] On assistant message events in the timeline, show the model name next to the event type label (e.g. "MESSAGE  claude-opus-4")
- [ ] The badge should be subtle — monospace text, slightly different background, not a loud colored pill
- [ ] Only show on message type events (assistant responses) — not on user messages, not on tool events
- [ ] Remove the old model_id display that currently sits at the bottom of the event card — it moves up to the header row
- [ ] Tool events already show tool_name in that spot, so model badge and tool_name don't conflict

---

## Task 6: Sub-Agent Timeline View

### Tab Toggle
- [ ] Add a tab bar on the session detail page with two tabs: "Chat" and "Sub-agents"
- [ ] Chat tab shows the current timeline view exactly as it is — no changes
- [ ] Sub-agents tab only appears if the session actually has sub-agent children
- [ ] Show the count of sub-agents on the tab label

### Sub-agents View Layout
- [ ] A vertical timeline line running down the left side of the content area
- [ ] Sub-agent cards hang off to the right of the timeline, positioned vertically by their creation time
- [ ] Each card shows: status dot with glow animation, title, model name, directory, live streaming latest message preview
- [ ] Cards should look like the main dashboard session cards — reuse the same component or same exact styling
- [ ] Same animations as main cards: green spinning glow when running, yellow blinking glow when idle — do NOT invent new animation styles

### Behavior
- [ ] Clicking a sub-agent card navigates to the full session detail page for that sub-agent (same /sessions/[id] route)
- [ ] Sub-agent live data comes through existing WebSocket updates — no new data pipeline needed
- [ ] Sub-agents are identified purely by parent_session_id — do NOT try to match them to specific tool calls or messages
- [ ] Order sub-agent cards by their created_at timestamp

---

## Task 7: Main Card Blue Spinning Glow

- [ ] On the main dashboard page, main session cards get a new visual state: when the main agent is idle BUT it has sub-agents that are still running
- [ ] This state shows a blue spinning border glow — same animation style as the existing green spinning glow, just blue color
- [ ] The condition is: session status is "idle" AND store.hasActiveSubAgents returns true for that session
- [ ] This is ONLY for the parent session card on the main dashboard — sub-agent cards themselves use regular green/yellow like everything else
- [ ] Do NOT invent new animation patterns — reuse the existing spinning border conic-gradient animation, just swap the color to blue

---

## Rules

- Do not invent new design patterns or animation styles — reuse what already exists
- Do not touch the plugin code — this plan is backend + frontend only
- Do not mix sub-agent time into main agent analytics
- Do not try to match sub-agents to specific tool calls
- Do not change the markdown library
- The floating bar must actually float — not just sit in the document flow with a backdrop-blur class slapped on it
- Sub-agent cards must look and animate exactly like main cards — green for running, yellow for idle
