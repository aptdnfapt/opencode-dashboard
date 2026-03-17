# Chamber + Library Phase Plan

## Purpose

This file breaks the work into implementation phases.
Detailed UX behavior lives in `spec/chamber-library/master-spec.md`.

---

## Phase 1 - Backend, Plugin, Migration

## Goal

Create the data model and live event flow required for Chamber behavior.

## Scope

- add tracked metadata support
- add generic group tag support
- add completion metadata for `/cc-done`
- add row-level hold persistence model if needed
- extend plugin slash-command behavior for `/cc-add`, `/cc-remove`, `/cc-done`
- allow tracked/tag updates from web UI
- update realtime payloads / websocket flow
- gate notifications so only tracked sessions can alert
- keep existing Library working while new metadata begins flowing

## Migration belongs here

Migration is part of Phase 1, not an afterthought.

Reason:
- new metadata fields are foundational
- frontend behavior depends on those fields existing cleanly
- old data needs safe defaults

## Expected outcome

After Phase 1:
- backend can store and serve Chamber-related metadata
- plugin can create/update that metadata
- live tracked sessions can be identified cleanly
- frontend has stable contract for Chamber work

---

## Phase 2 - Captain's Chamber Frontend

## Goal

Ship the live operational board.

## Scope

- add top-level view toggle between Chamber and Library
- build Chamber main layout with left live board and right recent done list
- render one row per project
- render tracked sessions only
- auto-slide cards between `Running` and `Idle`
- implement pages-in-a-book overlap stacks inside row zones
- implement row-level Hold behavior
- apply state-specific card animations and visual language
- ensure notifications respect tracked and hold rules
- wire cards and done items to shared floating session viewer
- reuse current detailed session UI rather than duplicating it

## Expected outcome

After Phase 2:
- user can operate on live tracked work from Chamber
- tracked sessions alert correctly
- held rows go quiet and move lower
- recently completed work is accessible in right-side pane

---

## Phase 3 - Library Redesign

## Goal

Turn Library into the structured historical exploration surface.

## Scope

- redesign timeline around project tracks and meaning-based subtracks
- use tag-driven track placement
- style chamber-completed sessions differently inside tag tracks
- split grouped containers by configurable time gap (default 10m)
- preserve session lineage across multiple activity segments
- treat subagent activity as supporting parent continuity
- use overlap/layered behavior for colliding blocks
- strengthen timeline filtering and persistence
- refine database view integration with shared floating session viewer

## Expected outcome

After Phase 3:
- Library can explain grouped history clearly
- tagged work, tracked work, and general work remain understandable
- timeline stays readable without losing depth

---

## Sequencing Notes

## Why this order

Phase 1 comes first because the data contract must exist before Chamber UI can behave correctly.

Phase 2 comes next because Chamber is the highest-value user-facing workflow and depends directly on live metadata.

Phase 3 comes last because Library redesign is broader and can build safely on the same metadata foundations.

---

## Out of Scope by Phase

### Not required in Phase 1

- full Library redesign
- final overlap timeline UX
- final database polish

### Not required in Phase 2

- full Library track-per-tag redesign

### Not required in Phase 3

- changing core Chamber command model
