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

- Chamber exists as a distinct top-level view
- Chamber uses two-pane layout
- left pane contains live project rows
- right pane contains recent done list
- only tracked sessions appear in Chamber rows
- one row represents one project

---

## Captain's Chamber Runtime Behavior

- sessions move automatically between `Running` and `Idle`
- movement is driven by backend/plugin updates
- user does not manually drag cards between runtime states
- running sessions are not manually draggable
- idle sessions are not manually dragged into another state
- chamber preserves sliding motion feel from mock
- state changes feel like travel along a track, not teleporting

---

## Card Visual States

- running main session uses green animated treatment
- idle session uses yellow animated treatment
- idle with active subagents uses blue animated treatment
- error session uses red animated treatment
- card style remains visually aligned with existing dashboard card language
- state animation does not reduce text readability

---

## Overlap / Stack Behavior

- multiple sessions in same row zone overlap like pages in a book
- front card remains readable
- behind cards visibly peek out
- hover or focus expands stack enough for selection
- `+N more` appears when too many overlap
- overlap expansion feels controlled rather than chaotic

---

## Hold Behavior

- Hold is row-level, not a column
- Hold visually mutes or grays out the whole row
- Hold moves row lower in visual priority
- Hold suppresses sound notifications for that row
- Hold suppresses browser notifications for that row
- Hold does not stop live state updates inside the row

---

## Done Pane

- right-side done pane shows recently completed Chamber sessions
- done pane is compact, not the full Library
- done items can be reopened quickly
- clicking done item opens shared floating session viewer

---

## Shared Floating Session Viewer

- Chamber cards open shared floating viewer
- done pane items open shared floating viewer
- Library timeline items open shared floating viewer
- Library database rows open shared floating viewer
- shared floating viewer reuses current detailed session experience
- notes remain available in shared floating viewer
- tool calls remain available in shared floating viewer
- subagent toggle remains available in shared floating viewer
- no duplicate alternative detailed viewers are introduced

---

## Library Placement Rules

- if a session has `group_tag`, it appears in that tag track
- if a session has no tag but has chamber tracking/completion meaning, it appears in tracked track
- otherwise session appears in general/manual track
- tagged + chamber-done session appears only once in Library
- tagged + chamber-done session keeps tag placement and receives special done styling

---

## Grouped Container Rules

- same `project + group_tag` sessions can form one outer container block
- grouping splits after time gap greater than default threshold
- default split threshold is 10 minutes
- split threshold is configurable in settings

---

## Session Segments and Subagents

- one underlying session may produce multiple visible timeline segments
- resumed sessions can appear as separate activity blocks
- subagent activity should preserve parent continuity where appropriate
- subagents should not overwhelm top-level timeline readability

---

## Library Overlap Behavior

- colliding timeline blocks can use layered overlap behavior
- overlap behavior should preserve readability
- overlap behavior should not force excessive vertical growth by default
- overlap behavior should remain navigable on smaller widths

---

## Filtering and Persistence

- user can filter by projects
- user can filter by time range
- user can filter by tag names
- user can filter by tracked/done chamber meaning
- density/collapse preferences can be persisted
- filter and view preferences persist across reboot

---

## Responsive / Overflow Safety

- Chamber remains readable across desktop widths
- long titles truncate gracefully
- horizontal Library scrolling remains usable
- grouped blocks do not clip unpredictably
- shared floating viewer remains usable on smaller screens

---

## UX Safety Checks

- no duplicated detailed session viewers are introduced
- no disconnected visual system is introduced
- no noisy alert behavior occurs for untracked sessions
- timeline remains scrollable and navigable
- overlap interactions remain recoverable and understandable
- animation supports readability rather than hurting it
- hold does not stop live state updates
- grouped tags do not merge across large gaps accidentally
- resumed sessions keep lineage rather than appearing fully unrelated
