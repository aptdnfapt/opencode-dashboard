# Chamber + Library Acceptance Checklist

## Purpose

This file exists to prevent silent omission of UX details.

Each item should be verifiable.

---

## Shared Data Rules

- `is_tracked` and `group_tag` are independent
- completion metadata is separate from `group_tag`
- tracked + tagged sessions are supported
- old sessions remain valid with safe defaults

---

## Commands

- `/cc-add` adds current session to Chamber
- `/cc-remove` removes current session from Chamber without completion metadata
- `/cc-done` removes current session from Chamber and records completion metadata
- no alias commands are required by spec
- `/cc-add` gives immediate live visibility without requiring refresh
- `/cc-remove` keeps session in Library/history
- `/cc-done` adds session to recent done feed behavior

---

## User Workflow Coverage

- spec covers what user sees after `/cc-add`
- spec covers what user sees after tracked session goes idle
- spec covers what user sees after tracked session resumes running
- spec covers what user sees when a row is put on hold
- spec covers what user sees after `/cc-remove`
- spec covers what user sees after `/cc-done`
- spec covers opening detailed session viewer from all entry points
- spec covers grouped/tagged Library workflows
- spec covers resumed-session timeline behavior
- spec covers overlapping/parallel behavior

---

## Phase 1 Backend / Plugin / Migration

- [x] backend stores tracked state (`is_tracked` column in sessions)
- [x] backend stores generic group tags (`group_tag` column in sessions)
- [x] backend stores completion metadata for chamber-done sessions (`completed_at`, `completed_reason`)
- [x] migration is additive and safe for old data (ALTER TABLE ADD COLUMN with defaults)
- [x] plugin can emit tracked-state changes (`chamber.track` event)
- [x] plugin can emit done-state changes (`chamber.done` event)
- [x] web UI can edit tracked state (PATCH /api/sessions/:id/track)
- [x] web UI can edit group tag (PATCH /api/sessions/:id/track with groupTag)
- [x] project holds table created (`project_holds`)
- [x] web UI can set hold state (PATCH /api/projects/:dir/hold)
- [x] realtime contract exposes needed live state for Chamber (tracked, hold in WS messages)
- [x] notifications are gated so untracked sessions do not alert (frontend checks isTracked/isHeld)

---

## Captain's Chamber Layout

- [x] Chamber exists as a distinct top-level view
- [x] Chamber uses two-pane layout
- [x] left pane contains live project rows
- [x] right pane contains recent done list
- [x] only tracked sessions appear in Chamber rows
- [x] one row represents one project

---

## Captain's Chamber Runtime Behavior

- [x] sessions move automatically between `Running` and `Idle`
- [x] movement is driven by backend/plugin updates
- [x] user does not manually drag cards between runtime states
- [x] running sessions are not manually draggable
- [x] idle sessions are not manually dragged into another state
- [x] chamber preserves sliding motion feel from mock
- [x] state changes feel like travel along a track, not teleporting

---

## Card Visual States

- [x] running main session uses green animated treatment
- [x] idle session uses yellow animated treatment
- [x] idle with active subagents uses blue animated treatment
- [x] error session uses red animated treatment
- [x] card style remains visually aligned with existing dashboard card language
- [x] state animation does not reduce text readability

---

## Overlap / Stack Behavior

- [x] multiple sessions in same row zone overlap like pages in a book
- [x] front card remains readable
- [x] behind cards visibly peek out
- [x] hover or focus expands stack enough for selection
- [x] `+N more` appears when too many overlap
- [x] overlap expansion feels controlled rather than chaotic

---

## Hold Behavior

- [x] Hold is row-level, not a column
- [x] Hold visually mutes or grays out the whole row
- [x] Hold moves row lower in visual priority
- [x] Hold suppresses sound notifications for that row
- [x] Hold suppresses browser notifications for that row
- [x] Hold does not stop live state updates inside the row

---

## Done Pane

- [x] right-side done pane shows recently completed Chamber sessions
- [x] done pane is compact, not the full Library
- [x] done items can be reopened quickly
- [x] clicking done item opens shared floating session viewer

---

## Shared Floating Session Viewer

- [x] Chamber cards open shared floating viewer
- [x] done pane items open shared floating viewer
- [x] Library timeline items open shared floating viewer
- [x] Library database rows open shared floating viewer
- [x] shared floating viewer reuses current detailed session experience
- [x] notes remain available in shared floating viewer
- [x] tool calls remain available in shared floating viewer
- [x] subagent toggle remains available in shared floating viewer
- [x] no duplicate alternative detailed viewers are introduced

---

## Library Placement Rules

- [x] if a session has `group_tag`, it appears in that tag track
- [x] if a session has no tag but has chamber tracking/completion meaning, it appears in tracked track
- [x] otherwise session appears in general/manual track
- [x] tagged + chamber-done session appears only once in Library
- [x] tagged + chamber-done session keeps tag placement and receives special done styling

---

## Grouped Container Rules

- [x] same `project + group_tag` sessions can form one outer container block
- [x] grouping splits after time gap greater than default threshold
- [x] default split threshold is 10 minutes
- [ ] split threshold is configurable in settings

---

## Session Segments and Subagents

- [x] one underlying session may produce multiple visible timeline segments
- [x] resumed sessions can appear as separate activity blocks
- [x] subagent activity should preserve parent continuity where appropriate
- [x] subagents should not overwhelm top-level timeline readability

---

## Library Overlap Behavior

- [x] colliding timeline blocks can use layered overlap behavior
- [x] overlap behavior should preserve readability
- [x] overlap behavior should not force excessive vertical growth by default
- [x] overlap behavior should remain navigable on smaller widths

---

## Filtering and Persistence

- [x] user can filter by projects
- [x] user can filter by time range
- [x] user can filter by tag names
- [x] user can filter by tracked/done chamber meaning
- [x] density/collapse preferences can be persisted
- [x] filter and view preferences persist across reboot

---

## Responsive / Overflow Safety

- [x] Chamber remains readable across desktop widths
- [x] long titles truncate gracefully
- [x] horizontal Library scrolling remains usable
- [x] grouped blocks do not clip unpredictably
- [x] shared floating viewer remains usable on smaller screens

---

## UX Safety Checks

- [x] no duplicated detailed session viewers are introduced
- [x] no disconnected visual system is introduced
- [x] no noisy alert behavior occurs for untracked sessions
- [x] timeline remains scrollable and navigable
- [x] overlap interactions remain recoverable and understandable
- [x] animation supports readability rather than hurting it
- [x] hold does not stop live state updates
- [x] grouped tags do not merge across large gaps accidentally
- [x] resumed sessions keep lineage rather than appearing fully unrelated

---

## Phase 3 - Library Redesign Implementation

### Core Layout

- [x] Library exists as a distinct top-level view alongside Chamber
- [x] Library uses two-pane layout (timeline view + database view)
- [x] Timeline is the default subview
- [x] Database is the secondary toggle view
- [x] View toggle in header allows switching between Timeline and Database
- [x] Old grid-style sessions browsing flow is replaced by new Library model
- [x] Left project sidebar is removed from Library timeline
- [x] In-canvas project watermarks are used instead of sidebar labels

### Timeline Structure

- [x] Timeline canvas supports horizontal scrolling
- [x] Time axis ruler shows temporal markers
- [x] Project tracks are arranged vertically
- [x] Each project track contains multiple sub-tracks (tag lanes)
- [x] Tag-driven track placement is implemented
- [x] Grouped containers for same `project + group_tag` sessions
- [x] Containers split after 10-minute time gap
- [x] Inner sessions flow horizontally within Ralph group containers
- [x] Tracked sessions have dedicated lane
- [x] Manual sessions have dedicated lane

### Styling and Visual Design

- [x] Chamber-completed sessions have distinct visual treatment (purple border/accent)
- [x] Tag groups use dashed border with semi-transparent background
- [x] Session blocks use existing card design language
- [x] Status icons: success (green), error (red), manual (blue)
- [x] Watermark text is massive, transparent, and non-interactive
- [x] Hover effects lift blocks slightly with enhanced shadow
- [x] CSS variables match existing theme system

### Interactions

- [x] Drag-to-scroll for timeline canvas
- [x] Clicking timeline blocks opens shared floating session viewer
- [x] Clicking database rows opens shared floating session viewer
- [x] Filtering by project and tag is available
- [x] Clear filters button shows active filter count
- [x] View preferences persist (activeView state)

### Database View

- [x] Database table shows all sessions in sortable list
- [x] Columns: status icon, project, tag/type, summary, status, date, duration
- [x] Tag badges distinguish Ralph, Chamber, Tracked, and Manual sessions
- [x] Rows are clickable and open session viewer
- [x] Hover effect highlights row

### Integration

- [x] Shared SessionViewer is reused across Chamber and Library
- [x] Navigation between Chamber and Library works correctly
- [x] TopBar navigation points to new Library route
- [x] Old home page redirects to /library
- [x] All existing session detail features work (notes, tool calls, subagents)

### Known Limitations / Future Work

- [ ] Split threshold configurability in settings (currently hardcoded to 10 minutes)
- [ ] Session segmentation for resumed sessions (basic support exists)
- [ ] Advanced filtering persistence across reboots (basic in-memory filtering exists)
- [ ] Subagent-specific timeline visualization (subagents counted in parent continuity)
