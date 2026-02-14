# Analytics Page — Chart Fixes & Time Heatmap

> Follow-up fixes after initial Time Analytics implementation (commit `12b8ba1`).
> All changes are frontend chart config + one small backend endpoint.

---

## 1. Donut Legend Text Overflow (Cost by Model, Tokens by Model)

### Problem
Long model names like `anthropic/claude-sonnet-4-20250514` push the Chart.js legend outside the card boundary. Legend panel has no max width constraint, so it grows unbounded to the right and clips.

### What We Want
- Legend text truncated to show only the model name portion (after last `/`)
- Legend panel capped at a reasonable max width so it never overflows the card
- Full model name visible on hover (tooltip still shows it)

### What We Do NOT Want
- No hiding the legend entirely on these two charts — users need to see which color = which model
- No wrapping long names onto multiple lines — truncate instead

### Reference Files
- `frontend-svelte/src/routes/analytics/+page.svelte` — lines 186-196 (cost donut legend), lines 345-355 (tokens donut legend)

---

## 2. Donut Hover Animation (All 3 Donuts)

### Problem
Hovering over a donut slice shows a tooltip but the slice itself has zero visual reaction. No pop-out, no border change, nothing. Feels dead.

### What We Want
- Hovered slice pops outward slightly (a few pixels offset)
- Border thickens and brightens on the hovered slice
- Smooth transition — not jarring, subtle enough to feel polished
- Same animation style across all three donuts: Cost by Model, Tokens by Model, Time Spent by Model

### What We Do NOT Want
- No flashy color changes on hover — just offset + border
- No custom Chart.js plugins — use built-in dataset hover options

### Reference Files
- `frontend-svelte/src/routes/analytics/+page.svelte` — lines 172-178 (cost donut dataset), lines 330-336 (tokens donut dataset), lines 558-565 (time spent donut dataset)

---

## 3. Cost by Agent Bars Overlapping

### Problem
The horizontal bar chart for "Cost by Agent" uses a hardcoded `barThickness: 28`. When there are many agents, bars overlap each other on the y-axis because the container height is fixed at `h-64` (256px) regardless of how many agents exist.

### What We Want
- Bars never overlap — each bar has clear spacing from the next
- Container height grows dynamically based on number of agents (more agents = taller chart)
- Bars auto-size to fit available space with a max thickness cap
- Consistent with the sharp-edge bar style (no rounded corners — already fixed)

### What We Do NOT Want
- No fixed `barThickness` that ignores how many items exist
- No scrolling inside the chart card — just make it taller
- No bars thinner than ~16px (unreadable at small sizes)

### Reference Files
- `frontend-svelte/src/routes/analytics/+page.svelte` — lines 228-234 (dataset config), lines 1032-1035 (template container div with fixed `h-64`)

---

## 4. Heatmap Tooltip Shows Raw Numbers

### Problem
The activity heatmap now uses token counts (switched from request counts in last commit). Tooltip displays the raw integer: `22847291 tokens`. Should show `22.8M tokens` or `200.0K tokens` like every other token display in the dashboard.

### What We Want
- Tooltip value formatted using the same `formatTokens()` utility the rest of the app uses
- `>=1M` → `"22.8M"`, `>=1K` → `"200.0K"`, `<1K` → raw number

### What We Do NOT Want
- No new formatting function — reuse `formatTokens` from `$lib/utils`
- No changing the heatmap color scaling logic — just the display text

### Reference Files
- `frontend-svelte/src/lib/components/Heatmap.svelte` — line 144 (tooltip value display)
- `frontend-svelte/src/lib/utils.ts` — `formatTokens()` function (lines 13-17)

---

## 5. Heatmap Cell Borders Invisible

### Problem
Heatmap cells have no stroke/border at all. The empty cells (`#161b22`) are nearly identical to the page background, making the grid structure invisible. You can't see where one cell ends and another begins unless it has data.

### What We Want
- Every cell has a subtle faded grey border so the grid structure is always visible
- Border should be very low opacity — just enough to see the grid, not enough to distract from the data colors
- Consistent with GitHub's contribution graph look (they have faint borders too)

### What We Do NOT Want
- No bright or high-contrast borders — should be barely visible
- No border only on data cells — ALL cells get the border including empty ones
- No changing cell size or gap — just add the stroke

### Reference Files
- `frontend-svelte/src/lib/components/Heatmap.svelte` — lines 123-134 (SVG `<rect>` elements, currently no `stroke` attribute)

---

## 6. Remove Model Selection from Response Time Chart

### Problem
"Response Time by Model" chart has model filter chips crammed into the header bar. With 5+ models they wrap badly, look cluttered, and the UX is confusing. Chart.js already has built-in legend click-to-toggle which does the same thing.

### What We Want
- Remove the model filter chips entirely from the header area
- Keep only the time range buttons (24h / 7d / 30d / 90d)
- Users can still toggle models on/off by clicking the chart legend labels (Chart.js built-in behavior)
- Clean header with just the title and time range selector

### What We Do NOT Want
- No custom model filter UI — Chart.js legend handles it
- No leftover state/functions related to model selection (`selectedModels`, `toggleModel`, `getModelColor`)

### Reference Files
- `frontend-svelte/src/routes/analytics/+page.svelte` — lines 1178-1214 (model filter chips template), lines 785-791 (`toggleModel` function), lines 795-798 (`getModelColor` function), line 39 (`selectedModels` state)

---

## 7. Response Time Tooltip Covers Data Points

### Problem
On the "Response Time by Model" line chart, the tooltip box renders directly at the cursor position, covering the actual data points the user is trying to inspect. `interaction: { intersect: false, mode: 'index' }` makes it trigger on vertical line which is correct, but the tooltip itself sits right on top of the points.

### What We Want
- Tooltip positioned above or offset from the data points so the points remain visible
- Enough padding between the tooltip caret and the nearest point
- Apply same fix to cost trend line chart and any other chart where tooltip obscures data

### What We Do NOT Want
- No disabling `mode: 'index'` — we want to see all models at a given date
- No making tooltip smaller to compensate — position it properly instead

### Reference Files
- `frontend-svelte/src/routes/analytics/+page.svelte` — lines 495-508 (response time tooltip config), lines 140-154 (cost trend tooltip config)

---

## 8. Time Spent by Model — Double Model Name List

### Problem
The "Time Spent by Model" section shows model names in TWO places: the Chart.js legend on the right side of the donut AND the data table next to it (which has model names with color dots). Redundant — the table IS the legend.

### What We Want
- Hide the Chart.js built-in legend on this specific donut chart
- The data table serves as the legend — it already has color dots, model names, and values
- Donut gets more canvas space since the right-side legend was eating ~40% of the chart area

### What We Do NOT Want
- No removing the table — the table stays, the Chart.js legend goes
- No hiding legends on the OTHER donuts (Cost by Model, Tokens by Model) — those don't have tables

### Reference Files
- `frontend-svelte/src/routes/analytics/+page.svelte` — lines 572-583 (time donut legend config to hide), lines 1265-1320 (data table that replaces it)

---

## 9. Bar Chart Hover Animation (All Bar Charts)

### Problem
Hovering over a bar in any bar chart (Cost by Agent, Top Projects, Lines by Language, Time by Project) shows only a tooltip. The bar itself has no visual hover feedback — no brightness change, no highlight.

### What We Want
- Bars visually react on hover — slightly brighter or highlighted
- Quick smooth transition on hover (not sluggish)
- Tooltip only shows when directly hovering a bar, not empty space between bars
- Consistent hover feel across all bar charts

### What We Do NOT Want
- No color-changing bars on hover — just brightness/opacity shift
- No hover animations that lag behind the cursor

### Reference Files
- `frontend-svelte/src/routes/analytics/+page.svelte` — lines 220-267 (cost by agent), lines 272-321 (project analytics), lines 379-436 (file stats), lines 612-729 (time by project)

---

## 10. Time Spent Heatmap Calendar (New Feature)

### Problem
We have a token activity heatmap (green GitHub calendar) but no equivalent for time spent. Users want to see at a glance which days they spent the most cumulative LLM time.

### What We Want
- A second heatmap calendar in the Time Analytics section
- Different color scheme from the existing one — blue tones instead of green, so they're visually distinct
- Shows total `duration_ms` summed per day (same as token heatmap but for time)
- Tooltip shows formatted duration ("2h 15m", "45m") not raw milliseconds
- Same 365-day range, same cell sizing, same layout as existing heatmap
- Heatmap component should accept a color scheme prop so both can reuse the same component

### What We Do NOT Want
- No duplicating the Heatmap component — make it configurable via props (color scheme, label formatter)
- No mixing time data into the existing token heatmap — separate chart
- No new page or section — sits inside the existing Time Analytics section

### Backend Data Needed
- New endpoint: daily sum of `duration_ms` from `token_usage` grouped by date (same pattern as existing heatmap endpoint but summing `duration_ms` instead of tokens)

### Reference Files
- `frontend-svelte/src/lib/components/Heatmap.svelte` — entire file (needs color scheme prop added)
- `frontend-svelte/src/routes/analytics/+page.svelte` — Time Analytics section starts at line 1156
- `backend/src/handlers/api.ts` — lines 555-573 (existing heatmap endpoint to mirror for time)
- `frontend-svelte/src/lib/api.ts` — new API function needed

---

## Priority Order

1. **High** — Heatmap borders (#5) + tooltip formatting (#4) — most visually broken
2. **High** — Cost by Agent overlap (#3) — data literally hidden
3. **High** — Double model list (#8) + remove model chips (#6) — redundant UI clutter
4. **Medium** — Donut hover animation (#2) + bar hover animation (#9) — polish
5. **Medium** — Legend text overflow (#1) — cosmetic but noticeable
6. **Medium** — Tooltip covering points (#7) — usability
7. **Medium** — Time heatmap calendar (#10) — new feature, needs backend work
