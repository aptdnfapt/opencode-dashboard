# Library UI Issues - Detailed Breakdown

## Overview

This document captures all agreed-upon fixes for the Library timeline view based on user feedback and discussion.

---

## Issue 1: Floating Island Missing in SessionViewer Embed Mode

### Current State
- When clicking a timeline card → opens SessionViewer (iframe with `?embed=1`)
- The floating island (frosted glass header) is HIDDEN due to `{#if !isEmbed}` check in `/sessions/[id]/+page.svelte`
- The floating island exists at lines 498-607 but is not visible in embed mode

### What Floating Island Is
The floating island is a frosted glass header bar that:
- Shows compact session info (status dot, title, tokens, cost)
- Expands on hover to reveal full details (session ID, created, hostname, directory, models)
- Has animated border status indicators:
  - Green spinning border for `active` status
  - Yellow blinking glow for `idle` status  
  - Blue spinning border for `idle-with-subagents` status
- Located at absolute center of the top bar
- Responds to `onmouseenter` / `onmouseleave` events

### Expected Behavior
- **User wants**: SessionViewer embedded iframe (opened when clicking timeline card) should SHOW the floating island
- Currently hidden behind `{#if !isEmbed}` check at line 486
- The floating island provides context about the session being viewed

### Resolution
Remove or modify the `{#if !isEmbed}` condition so floating island is visible in embed mode. The back button should still be hidden in embed mode (makes no sense in iframe), but the floating island content should show.

### File Locations
- Session page: `frontend-svelte/src/routes/sessions/[id]/+page.svelte`
- Lines to modify: 486 (remove `!isEmbed` from floating island condition)
- Keep `!isEmbed` for back button but NOT for floating island

---

## Issue 2: Timeline Card Hover Expand Animation

### Current State
- TimelineBlock shows basic info (truncated title, duration, status icon)
- Hover shows a fixed-position overlay card without animation
- Does not match the frosted glass floating island style

### Expected Behavior
- Hover on timeline card should reveal expanded session details
- **Animation style**: Expand outward from card position (like floating island)
- **Visual style**: Frosted glass effect (backdrop-blur-md, rounded border, shadow)
- **Position**: Card stays in place, expansion floats OVER adjacent content (no pushing)
- **Direction**: Expand upward if card near bottom of viewport, downward otherwise

### Content to Show in Expanded Card
Based on floating island reference:
1. **Compact row (always visible)**:
   - Status dot (animated based on status)
   - Session title (full, not truncated)
   - Token count
   - Cost

2. **Expanded details (on hover)**:
   - Session ID (with copy button)
   - Model(s) used (as badges)
   - Created timestamp
   - Last active timestamp
   - Duration
   - Directory path
   - Chamber completion badge (if applicable)
   - Subagent activity indicator (if applicable)
   - Segment info (for resumed sessions: "Segment 1/3")

### Implementation
- Add hover state with CSS `max-height` transition (0 → auto)
- Use `backdrop-blur-md bg-[var(--bg-secondary)]/80` for frosted glass
- Add animated status border (same classes as floating island)
- Position logic: check card rect vs viewport center, expand away from edge

### File Locations  
- TimelineBlock component: `frontend-svelte/src/lib/components/TimelineBlock.svelte`
- Reference styles: Lines 505-607 of `sessions/[id]/+page.svelte` (floating island CSS)

---

## Issue 3: Filter Bar Wastes Vertical Space

### Current State
Library page has THREE rows before timeline:
1. **Row 1**: Title + stats badge + time dropdown + view toggle
2. **Row 2**: Filter button (opens dropdown popover under the button)
3. **Row 3**: (appears empty/invisible)

### Expected Behavior
- **Single row header**: Title + stats + filter button + time range + view toggle
- **Filter opens as centered modal**: NOT dropdown under button
- Modal has blur/dim backdrop behind it
- Modal contains ALL filters (search, chamber state, visibility toggles, projects, tags, time range)
- Time range has **arbitrary input** (type custom hours/days, not just presets)
- Empty Row 2 and Row 3 should be eliminated

### Filter Modal Requirements
1. **Centered modal** with backdrop blur
2. **Search**: Text input with autocomplete for project names
3. **Time range**: 
   - Preset options (1h, 6h, 24h, 7d, 30d, all)
   - **Custom input**: Text field accepting "5h", "3d", etc.
4. **Chamber filter**: Dropdown (all, tracked-or-done, tracked-only, done-only, non-chamber)
5. **Visibility toggles**: Checkboxes for "Tagged" and "Manual"
6. **Project chips**: Clickable project badges
7. **Tag chips**: Clickable tag badges
8. **Reset button**: Clear all filters
9. **Done button**: Close modal

### CSS Investigation Needed
- Identify cause of Row 3 empty space
- Check for overflow CSS creating invisible elements
- Check TimelineView CSS for unwanted padding/margin

### File Locations
- Library page: `frontend-svelte/src/routes/library/+page.svelte`
- Filter component: `frontend-svelte/src/lib/components/LibraryFilters.svelte`
- Timeline CSS: `frontend-svelte/src/lib/components/TimelineView.svelte`

---

## Issue 4: Project & Lane Watermarks Not Repeating

### Current State
- **Project watermark**: Shows project name ONCE on far left of track
- **Lane watermark**: Shows lane type (Tag: X, Tracked/Chamber, Manual/General) ONCE on left
- When scrolling timeline to the right, watermarks disappear from view
- No visual context for which project/lane you're looking at

### Expected Behavior
- **Watermarks repeat horizontally** based on zoom level / viewport width
- User should ALWAYS see which project and lane they're viewing, regardless of scroll position
- Automatic spacing based on time range zoom

### Algorithm for Repetition
```
function getWatermarkSpacing(timeRange: string): number {
  // Returns pixel spacing between watermark repetitions
  // Based on zoom level: more zoomed out = wider spacing
  switch (timeRange) {
    case '1h': return 400px
    case '6h': return 600px
    case '24h': return 800px
    case '7d': return 1000px
    case '30d': return 1400px
    case 'all': return 2000px
    default: return 600px
  }
}
```

### Alternative Approach
Instead of pixel-based, use time-based:
- Repeat watermark every N hours based on zoom
- At 6h view: repeat every 2 hours
- At 24h view: repeat every 6 hours
- At 7d view: repeat every 24 hours

### Implementation
- Create array of watermark positions based on canvas width
- Position watermarks using `position: absolute; left: ${position}px`
- Ensure watermarks don't overlap with blocks (use pointer-events: none)
- Lane watermarks should be lighter/smaller than project watermarks

### File Locations
- TimelineView: `frontend-svelte/src/lib/components/TimelineView.svelte`
- Lane rendering: lines 86-101

---

## Issue 5: CSS Overflow Creating Empty Space

### Current State
- User reports empty row appearing before timeline starts
- Likely CSS overflow issue from time-axis or track-lanes

### Investigation Needed
1. Check `.time-axis` CSS for overflow
2. Check `.timeline-canvas` for unwanted height
3. Check `.project-track` for padding/margin creating gaps
4. Check `.lane-row` for overflow issues

### Potential Fixes
- Add `overflow: hidden` to parent containers
- Reduce padding on time-axis
- Check for sticky positioning creating gaps
- Verify border/margin accumulation

### File Locations
- TimelineView CSS: Lines 108-213 of `TimelineView.svelte`
- Library page CSS: Lines 113-236 of `+page.svelte`

---

## Issue 6: Blocks Overflowing Their Containers

### Current State
- Subagent curly border indicator extending beyond card bounds
- Cards don't properly contain their content

### Expected Behavior
- All content should stay within card bounds
- Use `overflow: hidden` on card container
- Increase card height if needed for subagent indicator

### File Locations
- TimelineBlock CSS: Lines 182-226 of `TimelineBlock.svelte`

---

## Summary of Agreed Solutions

| Issue | Solution | Files |
|-------|----------|-------|
| 1. Floating island hidden | Remove `!isEmbed` from floating island condition | `sessions/[id]/+page.svelte` |
| 2. No hover animation | Add floating-island-style expand animation to TimelineBlock | `TimelineBlock.svelte` |
| 3. Empty header rows | Consolidate to one row + centered modal filter | `library/+page.svelte`, `LibraryFilters.svelte` |
| 4. Watermarks don't repeat | Add horizontal repetition based on zoom | `TimelineView.svelte` |
| 5. Empty space before timeline | Fix CSS overflow issues | `TimelineView.svelte` |
| 6. Cards overflow | Add `overflow: hidden` to TimelineBlock | `TimelineBlock.svelte` |

---

## Visual Reference: Hover Expand Card

```
       ┌──────────────────────────────────────────────────────────────────┐
       │                                                                  │
       │            ┌────────────────────────────────────┐                │
       │            │ THIS IS THE EXPANDED HOVER CARD     │                │
     ──┼────────────┤                                    ├─────────────────┼──
       │            │  [Status] Session Title              │                │
       │            │  Tokens: 1.2M  Cost: $2.34            │                │
       │            │  ─────────────────────              │                │
       │            │  Model: claude-3-opus               │                │
       │            │  Created: Mar 17, 10:30 AM          │                │
       │            │  Last Active: Mar 17, 2:45 PM        │                │
       │            │  Directory: /home/user/project      │                │
       │            │  ✓ Completed via Chamber             │                │
       │            │  ───────────┬─────┬────────         │                │
       │            └─────────────┴CARD┴──────────────────┘                │
       │                         │                                       │
       │                         └─────┘                                 │
    ───┼──────────────────────────────────────────────────────────────────┼──┐
       │                                                                  │  │
       │                    (rest of timeline)                            │
       │                                                                  │
       └──────────────────────────────────────────────────────────────────┘
```

The card stays in place. The expanded detail floats above (high z-index), positioned based on available space (up or down).

---

## Implementation Priority

1. **Fix empty rows** (quick CSS fix)
2. **Show floating island in embed mode** (one-line change)
3. **Add hover animation to timeline cards** (medium complexity, clear visual impact)
4. **Repeating watermarks** (medium complexity, requires calculation)
5. **Centered filter modal** (requires refactoring LibraryFilters component)
6. **Fix card overflow** (quick CSS fix)