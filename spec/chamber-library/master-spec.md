# Chamber + Library Master Spec

## Purpose

This file is the single source of truth for the new live workflow and library workflow.

It defines:
- what the user sees
- how the UI behaves
- what each state means
- what should never happen
- how Captain's Chamber and Library relate to each other

This file is product and UX focused.
It is not an implementation guide.

It should give a new coding agent enough context to:
- understand the user-facing goal
- understand what the user sees after each action
- understand what interactions are allowed and forbidden
- understand the intended motion and visual language
- avoid building duplicate or conflicting UI

---

## Core Problem

The dashboard currently shows too many sessions in one flat historical view.
That creates alert fatigue and makes active human-in-the-loop work hard to distinguish from background automation and general history.

The redesign splits the dashboard into two product areas:

- `Captain's Chamber` --> live operational view for explicitly tracked sessions
- `Library` --> historical archive and exploration view for all sessions

---

## Core Terms

### Session

An OpenCode session. This may be:
- a main session started by the user
- a resumed older session
- a subagent session started by another session

### Tracked Session

A session that has been explicitly added to Captain's Chamber.

Tracked state is controlled by:
- `/cc-add`
- `/cc-remove`
- `/cc-done`
- web UI controls

### Group Tag

A user-defined label that groups sessions together in the Library timeline.

Examples:
- `Ralph`
- `MVP`
- `security-audit`
- any other user-defined tag

`group_tag` is generic metadata only.
It is not a system-owned workflow type.

### Done via Chamber

A tracked session that left Captain's Chamber through `/cc-done`.

This is represented by dedicated completion metadata, not by overloading `group_tag`.

### Hold

A row-level quiet mode for a project inside Captain's Chamber.

Hold does not remove sessions.
Hold mutes alerts and visually deprioritizes that project row.

### Activity Segment

A visible time block in the Library timeline.

One underlying session may create multiple visible segments if it is resumed after a gap.

---

## Data Meaning Rules

### `is_tracked`

Controls whether a session appears in Captain's Chamber.

It does not decide Library grouping.

### `group_tag`

Controls grouping and track placement in the Library timeline.

It does not decide Captain's Chamber inclusion.

### Completion Metadata

Completion metadata records that a tracked session was completed through Chamber flow.

Examples:
- `completed_at`
- `completed_reason='cc_done'`

This affects Library styling and filtering.
It does not replace `group_tag`.

### Independence Rule

`is_tracked` and `group_tag` are independent.

Valid combinations include:
- tracked + no tag
- untracked + tagged
- tracked + tagged
- neither tracked nor tagged

---

## Command Rules

Only these commands exist for Chamber workflow:

- `/cc-add`
- `/cc-remove`
- `/cc-done`

No aliases are part of the spec.

### `/cc-add`

Adds current session to Captain's Chamber.

Effect:
- tracked state becomes true
- session appears in Chamber under its project row
- session becomes eligible for Chamber notifications
- user should get immediate visual confirmation that tracking was enabled
- session should not wait for a full page refresh to appear

### `/cc-remove`

Removes current session from Captain's Chamber without marking it complete.

Effect:
- tracked state becomes false
- session disappears from Chamber
- no completion metadata is recorded
- session remains available in Library/history
- this should feel like removing from live tracking, not deleting history

### `/cc-done`

Marks current tracked session as completed through Chamber workflow.

Effect:
- tracked state becomes false
- session disappears from Chamber
- completion metadata is recorded
- session remains available in Library
- session should also appear in Chamber's recent done area
- Library should later reflect that this session was completed through Chamber flow

---

## User Workflows

This section describes what the user does and what they should see.

## Workflow 1 - Add a live session to Chamber

The user is working in OpenCode and decides a session should be actively monitored.

The user runs `/cc-add`.

What should happen:
- the session is marked tracked
- the Chamber updates without requiring a manual refresh
- the session appears in the correct project row
- the session appears in the correct live zone based on current runtime state
- future idle/attention notifications are now allowed for that session unless the row is on hold

What should not happen:
- the session should not be duplicated in the Chamber
- the user should not lose Library access to the session
- the session should not suddenly inherit a group tag unless the user explicitly sets one

## Workflow 2 - Session goes idle while tracked

The user has already added the session to Chamber.
The agent finishes its current work and becomes idle.

What should happen:
- Chamber receives the live state update
- the card visually transitions from `Running` to `Idle`
- the idle visual treatment appears
- sound/browser notification may fire if the row is not on hold

What should not happen:
- the user should not need to drag anything manually
- the card should not jump to another project row
- the card should not disappear just because it became idle

## Workflow 3 - Session resumes after user replies

The tracked session was idle.
The user responds in terminal and the session becomes active again.

What should happen:
- Chamber receives the live running update
- the card visually transitions back into `Running`
- running visual treatment replaces idle treatment

## Workflow 4 - Put a project on hold

The user is busy and wants a project to stop interrupting them.

The user marks the project row as hold from the web UI.

What should happen:
- the entire row becomes visually muted
- the row moves lower in the Chamber ordering
- notifications for that row are silenced
- sessions inside the row still keep updating live

What should not happen:
- the row should not disappear
- session state updates should not stop
- Library placement should not change because of hold

## Workflow 5 - Remove a tracked session without completion

The user decides they no longer want a session in Chamber, but the work is not being marked complete.

The user runs `/cc-remove` or performs the equivalent from the web UI.

What should happen:
- the session leaves Chamber
- no completion metadata is written
- session stays available in Library

## Workflow 6 - Complete tracked work

The user decides the tracked task is done.

The user runs `/cc-done` or performs the equivalent from the web UI.

What should happen:
- the session leaves Chamber
- completion metadata is recorded
- the session appears in the recent done list in Chamber
- the session later appears in Library with done-through-Chamber styling

## Workflow 7 - Open detailed session view

The user clicks a Chamber card, a done list item, a Library timeline item, or a Library database item.

What should happen:
- a shared floating session viewer opens
- the viewer shows the detailed session content
- the viewer reuses the current detailed session experience already present in the app

What should not happen:
- navigation should not send the user into a totally different and inconsistent detail system
- the app should not maintain separate detail viewers for each module

## Workflow 8 - Grouped timeline history

The user opens Library and looks at a project with tagged work.

What should happen:
- sessions with the same `group_tag` appear in that tag track
- temporally close sessions can share one outer grouped block
- if gap exceeds configured threshold, a new grouped block begins
- if a tagged session was Chamber-done, it still stays in that tag track but gets distinct styling

## Workflow 9 - Resumed session in Library

The user resumes an older session much later.

What should happen:
- the same underlying session may appear as a new visible activity segment
- the UI should make clear this is continued work, not an unrelated new session

## Workflow 10 - Parallel / overlapping work

The user has overlapping sessions in time.

What should happen:
- Chamber uses stacked overlap cards inside the row zone
- Library uses layered overlap behavior in the relevant track
- overlaps remain selectable and understandable

---

## Interaction Rules

This section defines what the user can click, hover, or change.

## Chamber interactions

### Chamber card click

Clicking a live Chamber card opens the shared floating session viewer.

### Chamber stack hover/focus

Hovering or focusing an overlapped stack should expand it enough to expose card choice.

The expansion should be controlled and readable.
It should not explode into a chaotic layout.

### Chamber row hold control

The hold control should be discoverable but not visually loud.

It should clearly communicate whether the row is currently quiet/muted.

### Chamber done item click

Clicking a done item opens the same shared floating session viewer.

## Library interactions

### Timeline block click

Clicking a timeline block opens the shared floating session viewer.

### Overlap hover/focus

Hover or focus should help separate overlapping blocks enough for selection.

### Database row click

Clicking a database row opens the same shared floating session viewer.

## Shared viewer interactions

The shared viewer must preserve access to:
- notes
- conversation flow
- tool calls
- subagent view/toggle

---

## Motion and Animation Language

This section defines the intended feel of animation.

The motion should feel deliberate, smooth, and readable.
It should not feel playful, bouncy, or noisy.

The visual language should stay close to a professional terminal-inspired dashboard.

## Chamber motion

### Running <-> Idle movement

Cards should slide horizontally between the two live zones.

The motion should feel like the card is traveling along one track, not teleporting.

### Overlap stack expansion

Hover/focus expansion of stacked cards should feel like pages fanning enough to inspect, not like scattered cards jumping around.

### Enter and exit motion

- newly tracked session should enter cleanly into its row
- removed/done sessions should leave cleanly
- hold state changes should reprioritize row placement smoothly

## State animation language

### Running

Running should use a green animated border/glow treatment.

The effect should feel active and continuous.
It should read as live ongoing work.

### Idle

Idle should use a yellow glow/blink treatment.

The effect should feel like waiting for attention, not like an error.

### Idle with active subagents

This state should use blue animated treatment.

The blue state communicates that the main session is not actively producing output right now, but work is still progressing through subagents.

### Error

Error should use red animated treatment.

The error style should be clearly distinct from idle.

## Animation quality rules

- motion should be smooth
- motion should remain readable under frequent updates
- state effects should not overwhelm text readability
- overlapping animation should not make hover selection frustrating
- timeline animations should use the same visual logic family as Chamber where applicable

This spec does not lock exact milliseconds or exact easing curves.
It locks the motion intent and visual semantics.

---

## Chamber Detailed UI Rules

## Left Pane

The left pane is the live operational surface.

It must clearly show:
- project rows
- running zone
- idle zone
- active tracked cards
- muted/held rows

## Right Pane

The right pane is the recent done feed.

It should be visually lighter than the live board and should not compete with it.

It is a quick-access summary area, not a second complex dashboard.

## Empty states

If there are no tracked sessions:
- Chamber should still feel intentional, not broken
- the done feed may still show recent completed items if present

If there are no done items:
- the right pane should present a clean empty state rather than wasted noisy chrome

---

## Library Detailed UI Rules

## Timeline track logic

Tracks should be understandable by meaning.

The user should be able to tell whether they are looking at:
- tagged grouped work
- tracked/done work
- general history

## Timeline density

The timeline should not rely on unlimited vertical growth to solve collisions.

Overlap and layering are preferred before large uncontrolled vertical expansion.

## Timeline readability

The user should be able to inspect overlaps and grouped blocks without losing track of project context.

## Database role

The database remains the denser inspection surface.
The timeline does not need to show every detail fully expanded at all times.

---

## Responsive and Overflow Rules

The design must remain usable across desktop sizes and should not collapse into broken overflow behavior.

### Chamber

- left live board and right done pane should remain readable
- stacks should not become impossible to target
- long titles and metadata should truncate gracefully
- row hold state should remain visually obvious

### Library timeline

- horizontal scrolling must remain reliable
- large canvases must remain navigable
- overlaps must remain recoverable on smaller widths
- grouped blocks should not create broken clipping behavior

### Shared floating viewer

- viewer must remain usable on smaller screens
- core content should remain accessible without layout breakage

---

## Reuse Constraints

The implementation should actively reuse current app behavior and design where appropriate.

### Required reuse areas

- current session detail view logic
- current notes logic
- current subagent viewing logic
- current general dark theme and design system
- current session card language as a base

### Do not duplicate

- do not build separate detailed viewers for Chamber vs Library
- do not invent a separate unrelated card design system
- do not split detail behavior across multiple inconsistent implementations

---

## Must Not Happen

This section exists to prevent bad UX outcomes.

- Chamber should not become a cluttered historical archive
- Library should not duplicate sessions across multiple tracks unnecessarily
- untracked sessions should not produce Chamber notifications
- hold should not silently stop session updates
- card overlap should not hide sessions in an unrecoverable way
- grouped tags should not merge across huge time gaps by accident
- resumed sessions should not look like unrelated new work without lineage
- floating viewer should not diverge into multiple incompatible variants
- animation should not obscure text or break targeting
- timeline should not become effectively unusable because of overflow or poor collision handling

---

## Captain's Chamber

## Purpose

Captain's Chamber is the live operational board.

It exists to answer one question quickly:
which tracked work needs my attention right now?

It should feel immediate, focused, and quiet enough to scan fast.

## Layout

The Chamber view is split into two panes.

### Left Pane

The main live Chamber board.

This contains:
- one row per project
- only tracked sessions
- two live state zones inside each row: `Running` and `Idle`

### Right Pane

A recent done list for sessions completed through Chamber.

This is not the full Library.
It is a compact recent-finished feed for quick access.

---

## Chamber Row Model

Each row represents one project.

All tracked sessions for that project live inside that row.

If multiple tracked sessions exist at once for the same project, they share the row.

The row itself can also enter `Hold` mode.

---

## Chamber States

### Session Runtime States

Sessions inside Chamber can be visually represented as:
- `Running`
- `Idle`
- `Error`
- `Idle with active subagents`

### Row State

Project row can be:
- normal
- hold

### Done State

Done is not a live column.
It is an exit from Chamber.

---

## Chamber Motion Rules

The motion language from the mock should be preserved.

That means cards should visually slide between `Running` and `Idle`.

Important rule:
the motion is system-driven, not user-driven.

The user is not manually dragging cards between states.

### Required motion behavior

- when backend reports a tracked session as running/active, card appears or moves into `Running`
- when backend reports a tracked session as idle, card slides into `Idle`
- when tracked session becomes active again, card slides back into `Running`
- when tracked session errors, card keeps its place but receives error visual treatment
- when session leaves Chamber via remove/done, card exits the live board cleanly

### Forbidden behavior

- user cannot drag a running card
- user cannot manually move a card into idle
- user cannot manually change session runtime state from chamber layout itself

---

## Chamber Card Visual Rules

The card should stay visually close to the current session card design language already used in the app.

The redesign should reuse existing design patterns and avoid creating a disconnected visual system.

### Required card qualities

- same general card proportions and information density as current cards
- same dark theme language already used in app
- same detail logic reused across views
- clear border/glow treatment for state

### State styling

- `Running` main session --> green animated border/glow
- `Idle` --> yellow animated glow/blink
- `Idle with active subagents` --> blue animated border/glow
- `Error` --> red animated border/glow

These animations should feel deliberate and readable, not noisy.

---

## Chamber Overlap / Stack Behavior

When multiple sessions occupy the same project row and same zone, they should appear as overlapping cards.

The visual metaphor is pages in a book.

### Required behavior

- front card stays readable
- cards behind it peek out from behind
- stack visually indicates more than one session exists
- hover or focus expands the stack enough to choose a specific card
- if too many sessions exist, show `+N more`

### Visual intent

This should feel like layered paper/pages, not random z-index overlap.

### Practical expectation

Most stacks will likely be small, commonly 2 or 3 cards.
The UI should optimize for that case.

---

## Chamber Hold Behavior

Hold is applied to the whole project row.

It is not a column.
It is not a separate lane.

### Hold effects

- row becomes visually muted / grayed out
- row moves lower in Chamber ordering
- row stops producing sound notifications
- row stops producing browser notifications
- live session state updates still continue inside the row
- sessions may still move between running and idle visually

### Purpose

Hold means: keep this project visible, but stop interrupting me with it for now.

---

## Chamber Notifications

Only tracked sessions should trigger Chamber alert behavior.

Untracked sessions must remain quiet.

### Notification rule

- tracked + not on hold --> notification behavior allowed
- tracked + row on hold --> notification behavior suppressed
- not tracked --> notification behavior suppressed

This applies to:
- sound/bing behavior
- browser notifications

---

## Chamber Done List

The right-side pane contains recently completed tracked sessions.

This is a compact recent list, not the full archive.

### Purpose

- let user quickly reopen recently completed work
- separate finished work from live board
- keep Chamber focused on current work

### Item content

Each done item should show enough summary to identify the session quickly, such as:
- title
- project
- model if useful
- completion time
- optional tag badge if tagged

Clicking a done item opens the shared floating session viewer.

---

## Shared Floating Session Viewer

Every detailed session view should reuse the same viewer pattern.

This applies to:
- Chamber cards
- Chamber done list items
- Library timeline blocks
- Library database rows

### Required behavior

Clicking any of those items opens a large floating panel that covers most of the screen.

### Viewer content

Reuse the current session detail experience already in the app, including:
- conversation timeline
- tool calls
- notes
- subagent view/toggle
- existing session metadata areas where appropriate

### Reuse rule

Do not create multiple separate detailed session viewers.
One shared detailed viewer should be reused across the app.

---

## Library

## Purpose

The Library is the historical exploration surface.

It should support:
- reviewing past work
- understanding grouped runs
- revisiting tracked work
- scanning history by project and tag
- deep querying in database view

---

## Library Views

The Library has two views:
- timeline view
- database view

In Phase 1, existing Library UI can stay in place.
The redesign is part of later work.

---

## Library Timeline Placement Rules

Inside a project, sessions are organized by track meaning.

### Track model

A project can contain multiple timeline tracks such as:
- one track per explicit `group_tag`
- one tracked/done track for untagged tracked work
- one general/manual track for untagged non-tracked work

### Placement priority

- if session has `group_tag` --> place in that tag track
- else if session has tracked/done chamber meaning --> place in tracked track
- else --> place in general/manual track

### No duplication rule

A session should appear only once in Library placement.

If a session has both `group_tag` and Chamber completion metadata, it appears only in the tag track, with special done styling.

---

## Library Timeline Styling Rules

Track placement decides where a session appears.
Tracked/done metadata decides how it looks.

### Required styling rule

If a session was completed through Chamber, it should have a distinct visual treatment even inside its tag track.

That lets tagged sessions preserve workflow grouping while still showing their Chamber history.

---

## Grouped Container Rules

Sessions with same `project + group_tag` can be grouped into a larger outer container block.

### Split rule

Grouping must split when sessions are no longer temporally close.

Default split threshold:
- 10 minutes

This threshold must be configurable in settings.

### Result

Same tag can create multiple outer containers across time.
It should not force one giant continuous block forever.

---

## Session Resume / Segment Rules

One underlying session may generate multiple visible timeline segments.

This happens when a session is resumed later after a meaningful time gap.

### Required timeline behavior

- separate visible activity blocks for distinct periods of use
- preserve that they belong to same underlying session lineage

---

## Subagent Rules

Subagent activity should not create top-level timeline noise equal to main sessions.

Main workflow should stay primary.

### Library rule

Subagents are supporting detail under parent workflow, not first-class top-level clutter.

### Gap rule with subagents

Subagent activity should count as continued work for the parent workflow.

That means a parent workflow should not be split into separate grouped blocks only because the main agent was waiting on subagents.

---

## Library Overlap Behavior

When timeline blocks collide or overlap in time, the Library should use the same layered/stacked visual idea as Chamber.

The visual metaphor remains pages in a book.

### Required behavior

- overlapping blocks should remain readable
- hover/focus should help separate and inspect them
- overlaps should not explode vertical space by default

---

## Database View

The database view is the high-density exploration surface.

It should remain the place for full querying and detailed historical scanning.

The timeline does not need to show every possible detail expanded at once because the database view exists for deep inspection.

---

## Filtering and Persistence

Timeline and Library filtering should be strong and persistent.

### Filter capabilities

- project selection
- time range
- tag selection
- tracked / done chamber-related filtering
- collapse / density preferences where relevant

### Persistence rule

These preferences should persist across reboot.

Single-user local persistence is acceptable.

---

## Design Reuse Rules

The redesign must respect the existing app's visual and structural patterns.

### Required reuse

- reuse existing color scheme where possible
- reuse existing session viewer rather than duplicating it
- reuse current card language rather than inventing unrelated card styles
- reuse current subagent viewing logic

### Forbidden behavior

- do not build a parallel duplicated detail page with overlapping responsibility
- do not create a visually disconnected mini-app inside the current app

---

## UX Quality Constraints

The implementation must avoid obvious UX failures.

Examples of failure to avoid:
- timeline overflow that becomes hard to navigate
- bad scroll behavior on large horizontal canvases
- overlap behavior that hides cards without recoverability
- animation that feels jittery or too noisy
- hover interactions that make selection frustrating
- layout duplication that creates inconsistent session detail behavior

---

## Phase Intent

### Phase 1

Backend, plugin, migration, and live data contract for Chamber behavior.
Library can remain visually close to current UI for now.

### Phase 2

Captain's Chamber UI.
This includes live rows, overlap stacks, row hold, notifications gating, recent done list, and shared floating viewer integration.

### Phase 3

Library redesign.
This includes track-per-tag timeline, grouped containers, overlap rules, completion styling, and database/timeline integration refinements.
