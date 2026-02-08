# Dashboard Overhaul Plan

## Overview
Complete rewrite of OpenCode Dashboard with:
- Parent-child session tracking (subagents)
- Project-based grouping
- New sidebar UI layout
- Real-time fixes
- Different audio for subagents

## Phases

| Phase | Name | Status | Depends On |
|-------|------|--------|------------|
| 1 | Parent Session Tracking | pending | - |
| 2 | Backend Real-Time Fixes | pending | 1 |
| 3 | Frontend Real-Time Fixes | pending | 2 |
| 4 | Project Grouping APIs | pending | 1, 2 |
| 5 | UI Overhaul | pending | 1, 3, 4 |
| 6 | Subagent Audio | pending | 1, 2 |
| 7 | Performance & Polish | pending | 3, 4, 5 |

## New Packages
- shadcn/ui: sidebar, collapsible, resizable (copy-paste components)

## DB Changes
- New column: `sessions.parent_session_id`
- New indexes: `idx_sessions_parent`, `idx_sessions_directory`, `idx_token_timestamp`

## Execution Order
```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
                                    ↘ Phase 6
                              Phase 5 → Phase 7
```
