# Chamber + Library Overview

Date: 2026-03-17

## Purpose

These changes redesign the dashboard so live tracked work and historical session history are no longer mixed into one overloaded surface.

The goal is to reduce alert fatigue, make active human-in-the-loop work easy to monitor, and make historical work easier to explore without flooding the main view.

The redesign introduces two clear areas:

- `Captain's Chamber` --> a live operational view for explicitly tracked sessions
- `Library` --> a structured archive for reviewing all sessions across projects, tags, and time

This spec set exists to define:
- the user workflows
- the Chamber live behavior
- the Library timeline and database behavior
- the shared detailed session viewer
- the data and state rules needed to support these flows

## Why this change matters

The current dashboard makes it hard to distinguish between:
- sessions that need human attention now
- sessions that are background work
- sessions that are only historical context

This redesign fixes that by separating live operational tracking from archival exploration, while still keeping both connected through shared session detail views and consistent metadata.

## Spec files in this directory

- `master-spec.md` --> full product and UX source of truth
- `phase-plan.md` --> execution split across backend/plugin, Chamber, and Library work
- `acceptance-checklist.md` --> detailed checklist to prevent missed behaviors and UX gaps
