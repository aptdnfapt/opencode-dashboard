# Analytics & UI Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken analytics charts, add proper visualizations, and apply Flexoki color scheme with Radix-inspired UI

**Architecture:** 
- Backend: Fix SQL queries in `/api/analytics/*` endpoints
- Frontend: Rewrite chart components with correct data bindings
- Theme: Replace current HSL vars with Flexoki palette (dark mode)

**Tech Stack:** Bun/Hono, SQLite, React, Recharts, Tailwind CSS, Flexoki colors

---

## Current Issues Analysis

### Backend Problems (`backend/src/handlers/api.ts`)

1. **Line 111** - Invalid SQLite syntax: `DATE('week' = 'mon', ...)` is wrong
2. **Line 145** - `orderDir` used but never defined (undefined)
3. **`/api/analytics/usage`** - Complex query returning malformed data
4. **`/api/analytics/trend`** - Returns ASC but frontend expects DESC (newest first)

### Frontend Problems

1. **model-usage-chart.tsx:88** - `data.slice(-limit).reverse()` - double reversal issue
2. **usage-trend-chart.tsx** - Shows tokens only, not cost (user wants cost line chart)
3. **No stacked bar chart** - User wants 24h/7d/30d with model color breakdown
4. **Pie chart exists** - But may not render if `/api/analytics/models` returns empty

### DB Schema (`token_usage` table)
```sql
-- Has: session_id, message_id, provider_id, model_id, tokens_in, tokens_out, cost, timestamp
-- Timestamp is Unix ms
-- model_id stores model name
```

---

## Flexoki Color Palette (Dark Theme)

```css
/* Backgrounds */
--bg: #100F0F;        /* black - main bg */
--bg-2: #1C1B1A;      /* base-950 - elevated */
--ui: #282726;        /* base-900 - cards */
--ui-2: #343331;      /* base-850 - hover */
--ui-3: #403E3C;      /* base-800 - borders */

/* Text */
--tx: #CECDC3;        /* base-200 - primary text */
--tx-2: #878580;      /* base-500 - secondary */
--tx-3: #575653;      /* base-700 - muted */

/* Chart Colors (for model breakdown) */
--red: #D14D41;       /* red-400 */
--orange: #DA702C;    /* orange-400 */
--yellow: #D0A215;    /* yellow-400 */
--green: #879A39;     /* green-400 */
--cyan: #3AA99F;      /* cyan-400 */
--blue: #4385BE;      /* blue-400 */
--purple: #8B7EC8;    /* purple-400 */
--magenta: #CE5D97;   /* magenta-400 */
```

---

## Tasks Overview

1. **Task 1:** Fix backend `/api/analytics/usage` endpoint
2. **Task 2:** Fix backend `/api/analytics/trend` endpoint  
3. **Task 3:** Add new `/api/analytics/cost-trend` endpoint
4. **Task 4:** Apply Flexoki theme to `index.css`
5. **Task 5:** Rewrite `model-usage-chart.tsx` (stacked bars)
6. **Task 6:** Create `cost-trend-chart.tsx` (smooth line)
7. **Task 7:** Fix `model-distribution-chart.tsx` (pie)
8. **Task 8:** Update `analytics-page.tsx` layout
9. **Task 9:** Update global UI components (cards, buttons)

---

## Task 1: Fix `/api/analytics/usage` Endpoint

**Files:**
- Modify: `backend/src/handlers/api.ts:101-163`

**Problem:** Invalid SQL syntax, undefined `orderDir`, complex model pivot logic broken

**Step 1: Replace usage endpoint**

```typescript
// GET /api/analytics/usage - token usage by period with model breakdown
// Params: range=24h|7d|30d (default 7d)
app.get('/api/analytics/usage', (c: Context) => {
  const range = c.req.query('range') || '7d'
  
  // Calculate time boundaries
  const now = Date.now()
  let startTime: number
  let groupBy: string
  
  switch (range) {
    case '24h':
      startTime = now - 24 * 60 * 60 * 1000
      groupBy = "strftime('%Y-%m-%d %H:00', timestamp/1000, 'unixepoch')" // hourly
      break
    case '30d':
      startTime = now - 30 * 24 * 60 * 60 * 1000
      groupBy = "strftime('%Y-%m-%d', timestamp/1000, 'unixepoch')" // daily
      break
    default: // 7d
      startTime = now - 7 * 24 * 60 * 60 * 1000
      groupBy = "strftime('%Y-%m-%d', timestamp/1000, 'unixepoch')" // daily
  }

  // Get usage grouped by period and model
  const rows = db.prepare(`
    SELECT 
      ${groupBy} as period,
      model_id,
      SUM(tokens_in + tokens_out) as tokens
    FROM token_usage
    WHERE timestamp >= ? AND model_id IS NOT NULL
    GROUP BY period, model_id
    ORDER BY period ASC
  `).all(startTime) as { period: string; model_id: string; tokens: number }[]

  // Pivot: group by period, nest models
  const periodMap = new Map<string, { period: string; total: number; models: Record<string, number> }>()
  
  for (const row of rows) {
    if (!periodMap.has(row.period)) {
      periodMap.set(row.period, { period: row.period, total: 0, models: {} })
    }
    const entry = periodMap.get(row.period)!
    entry.models[row.model_id] = row.tokens
    entry.total += row.tokens
  }

  return c.json(Array.from(periodMap.values()))
})
```

**Step 2: Test endpoint**

```bash
curl -s "http://localhost:3000/api/analytics/usage?range=7d" | head -c 500
```

---

## Task 2: Fix `/api/analytics/trend` Endpoint

**Files:**
- Modify: `backend/src/handlers/api.ts:165-180`

**Problem:** Returns token trend, but frontend also needs it sorted correctly

**Step 1: Replace trend endpoint**

```typescript
// GET /api/analytics/trend - daily token usage for line chart
app.get('/api/analytics/trend', (c: Context) => {
  const days = parseInt(c.req.query('days') || '90')
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000

  const trend = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d', timestamp/1000, 'unixepoch') as date,
      SUM(tokens_in + tokens_out) as total_tokens,
      SUM(cost) as total_cost
    FROM token_usage
    WHERE timestamp >= ?
    GROUP BY date
    ORDER BY date ASC
  `).all(startTime)

  return c.json(trend)
})
```

---

## Task 3: Add `/api/analytics/cost-trend` Endpoint

**Files:**
- Modify: `backend/src/handlers/api.ts` (add after trend endpoint)

**Step 1: Add cost trend endpoint**

```typescript
// GET /api/analytics/cost-trend - daily cost for smooth line chart
app.get('/api/analytics/cost-trend', (c: Context) => {
  const days = parseInt(c.req.query('days') || '30')
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000

  const costs = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d', timestamp/1000, 'unixepoch') as date,
      SUM(cost) as cost,
      SUM(tokens_in + tokens_out) as tokens
    FROM token_usage
    WHERE timestamp >= ?
    GROUP BY date
    ORDER BY date ASC
  `).all(startTime)

  // Fill missing days with 0
  const result: { date: string; cost: number; tokens: number }[] = []
  const startDate = new Date(startTime)
  const endDate = new Date()
  
  const costMap = new Map(costs.map((c: any) => [c.date, c]))
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const existing = costMap.get(dateStr)
    result.push({
      date: dateStr,
      cost: existing?.cost || 0,
      tokens: existing?.tokens || 0
    })
  }

  return c.json(result)
})
```

---

## Task 4: Apply Flexoki Theme

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Replace CSS variables with Flexoki dark theme**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Flexoki Dark Theme */
    --background: 0 0% 6%;           /* #100F0F */
    --foreground: 44 6% 79%;         /* #CECDC3 */
    --card: 30 3% 15%;               /* #282726 */
    --card-foreground: 44 6% 79%;
    --popover: 30 4% 11%;            /* #1C1B1A */
    --popover-foreground: 44 6% 79%;
    --muted: 30 2% 20%;              /* #343331 */
    --muted-foreground: 40 2% 51%;   /* #878580 */
    --border: 30 2% 24%;             /* #403E3C */
    --input: 30 2% 24%;
    --ring: 207 44% 50%;             /* blue-400 */
    --primary: 207 44% 50%;          /* #4385BE */
    --primary-foreground: 44 6% 79%;
    --secondary: 30 3% 15%;
    --secondary-foreground: 44 6% 79%;
    --accent: 174 48% 44%;           /* cyan-400 */
    --accent-foreground: 44 6% 79%;
    --destructive: 1 66% 54%;        /* red-400 */
    --destructive-foreground: 44 6% 79%;
    --radius: 0.5rem;

    /* Chart colors - Flexoki accent palette */
    --chart-red: #D14D41;
    --chart-orange: #DA702C;
    --chart-yellow: #D0A215;
    --chart-green: #879A39;
    --chart-cyan: #3AA99F;
    --chart-blue: #4385BE;
    --chart-purple: #8B7EC8;
    --chart-magenta: #CE5D97;
  }
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

---

## Task 5: Rewrite Stacked Bar Chart

**Files:**
- Modify: `frontend/src/components/analytics/model-usage-chart.tsx`

**Goal:** Stacked bar chart with 24h/7d/30d tabs, model colors from Flexoki

**Step 1: Replace entire component**

```tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { BarChart3 } from "lucide-react"

// Flexoki chart colors
const MODEL_COLORS = [
  "#4385BE", // blue
  "#879A39", // green  
  "#DA702C", // orange
  "#8B7EC8", // purple
  "#D14D41", // red
  "#3AA99F", // cyan
  "#D0A215", // yellow
  "#CE5D97", // magenta
]

interface UsageEntry {
  period: string
  total: number
  models: Record<string, number>
}

type Range = "24h" | "7d" | "30d"

export function ModelUsageChart() {
  const [range, setRange] = useState<Range>("7d")
  const [data, setData] = useState<UsageEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/usage?range=${range}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [range])

  // Extract unique models and assign colors
  const { models, colorMap } = useMemo(() => {
    const modelSet = new Set<string>()
    data.forEach(d => Object.keys(d.models).forEach(m => modelSet.add(m)))
    const models = Array.from(modelSet)
    const colorMap = Object.fromEntries(models.map((m, i) => [m, MODEL_COLORS[i % MODEL_COLORS.length]]))
    return { models, colorMap }
  }, [data])

  const totalTokens = data.reduce((sum, d) => sum + d.total, 0)

  const formatPeriod = (p: string) => {
    if (range === "24h") return p.split(" ")[1] // show hour only
    return new Date(p).toLocaleDateString("en", { month: "short", day: "numeric" })
  }

  if (loading) {
    return <div className="rounded-lg border border-border bg-card p-6 h-80 animate-pulse" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            Token Usage by Model
          </h3>
          <p className="text-sm text-muted-foreground">
            {totalTokens.toLocaleString()} total tokens
          </p>
        </div>
        {/* Range tabs */}
        <div className="flex gap-1 bg-muted rounded-md p-1">
          {(["24h", "7d", "30d"] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded ${
                range === r ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">No data</div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="period" 
                tickFormatter={formatPeriod}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ 
                  background: "hsl(var(--popover))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }}
                labelFormatter={formatPeriod}
                formatter={(v: number, name: string) => [v.toLocaleString(), name]}
              />
              {models.map(model => (
                <Bar key={model} dataKey={`models.${model}`} stackId="a" fill={colorMap[model]} name={model} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      {models.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
          {models.map(m => (
            <div key={m} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: colorMap[m] }} />
              <span className="text-xs text-muted-foreground">{m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Task 6: Create Cost Trend Line Chart

**Files:**
- Create: `frontend/src/components/analytics/cost-trend-chart.tsx`

**Goal:** Smooth line chart showing daily cost over 30 days

**Step 1: Create new component**

```tsx
"use client"

import { useState, useEffect } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { DollarSign } from "lucide-react"

interface CostEntry {
  date: string
  cost: number
  tokens: number
}

export function CostTrendChart() {
  const [data, setData] = useState<CostEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/analytics/cost-trend?days=30")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const totalCost = data.reduce((sum, d) => sum + d.cost, 0)

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })
  }

  if (loading) {
    return <div className="rounded-lg border border-border bg-card p-6 h-80 animate-pulse" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-base font-medium flex items-center gap-2">
          <DollarSign className="size-4 text-primary" />
          Cost Over Time
        </h3>
        <p className="text-sm text-muted-foreground">
          ${totalCost.toFixed(2)} last 30 days
        </p>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">No data</div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3AA99F" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3AA99F" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `$${v.toFixed(2)}`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }}
                labelFormatter={formatDate}
                formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#3AA99F"
                strokeWidth={2}
                fill="url(#costGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#3AA99F" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
```

---

## Task 7: Fix Model Distribution Pie Chart

**Files:**
- Modify: `frontend/src/components/analytics/model-distribution-chart.tsx`

**Goal:** Use Flexoki colors, improve layout

**Step 1: Replace component**

```tsx
"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { PieChart as PieIcon } from "lucide-react"

// Flexoki colors
const COLORS = ["#4385BE", "#879A39", "#DA702C", "#8B7EC8", "#D14D41", "#3AA99F", "#D0A215", "#CE5D97"]

interface ModelData {
  model_id: string
  total_tokens: number
  total_cost: number
}

export function ModelDistributionChart() {
  const [data, setData] = useState<ModelData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/analytics/models")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const chartData = data.map((d, i) => ({
    name: d.model_id,
    value: d.total_tokens,
    cost: d.total_cost,
    color: COLORS[i % COLORS.length]
  }))

  const total = chartData.reduce((s, d) => s + d.value, 0)
  const totalCost = chartData.reduce((s, d) => s + d.cost, 0)

  if (loading) {
    return <div className="rounded-lg border border-border bg-card p-6 h-80 animate-pulse" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-base font-medium flex items-center gap-2">
          <PieIcon className="size-4 text-primary" />
          Model Distribution
        </h3>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} tokens · ${totalCost.toFixed(2)}
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px"
                  }}
                  formatter={(v: number, name: string) => [v.toLocaleString(), name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            {chartData.map(item => (
              <div key={item.name} className="flex items-center gap-2 p-2 rounded bg-muted">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {((item.value / total) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Task 8: Update Analytics Page Layout

**Files:**
- Modify: `frontend/src/pages/analytics-page.tsx`

**Goal:** Use new self-fetching chart components, cleaner layout

**Step 1: Replace analytics page**

```tsx
"use client"

import { useState, useEffect } from "react"
import { Activity } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { ModelUsageChart } from "@/components/analytics/model-usage-chart"
import { CostTrendChart } from "@/components/analytics/cost-trend-chart"
import { ModelDistributionChart } from "@/components/analytics/model-distribution-chart"

interface Summary {
  total_sessions: number
  total_tokens: number
  total_cost: number
}

export function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary>({ total_sessions: 0, total_tokens: 0, total_cost: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/analytics/summary")
      .then(r => r.json())
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Activity className="size-5 text-primary" />
          <h1 className="text-lg font-medium">Analytics</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard 
            title="Total Sessions" 
            value={loading ? "..." : summary.total_sessions} 
            icon="sessions" 
          />
          <StatCard 
            title="Total Tokens" 
            value={loading ? "..." : summary.total_tokens.toLocaleString()} 
            icon="tokens" 
          />
          <StatCard 
            title="Total Cost" 
            value={loading ? "..." : `$${summary.total_cost.toFixed(2)}`} 
            icon="cost" 
          />
        </div>

        {/* Charts row 1: Bar + Line */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ModelUsageChart />
          <CostTrendChart />
        </div>

        {/* Chart row 2: Pie */}
        <ModelDistributionChart />
      </main>
    </div>
  )
}
```

---

## Task 9: Update Global UI Styles

**Files:**
- Modify: `frontend/src/components/dashboard/stat-card.tsx`
- Modify: `frontend/src/components/ui/button.tsx` (if exists)

**Goal:** Apply Flexoki styling to cards and buttons

**Step 1: Update stat-card component**

```tsx
import { Layers, Coins, DollarSign, Server } from "lucide-react"

const icons = {
  sessions: Layers,
  tokens: Coins,
  cost: DollarSign,
  instances: Server,
}

interface StatCardProps {
  title: string
  value: string | number
  icon: keyof typeof icons
  change?: number
}

export function StatCard({ title, value, icon, change }: StatCardProps) {
  const Icon = icons[icon]

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold mt-2">{value}</p>
      {change !== undefined && (
        <p className={`text-xs mt-1 ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {change >= 0 ? "+" : ""}{change}% from last period
        </p>
      )}
    </div>
  )
}
```

---

## Execution Checklist

1. [ ] Task 1: Fix `/api/analytics/usage` endpoint
2. [ ] Task 2: Fix `/api/analytics/trend` endpoint
3. [ ] Task 3: Add `/api/analytics/cost-trend` endpoint
4. [ ] Task 4: Apply Flexoki theme to index.css
5. [ ] Task 5: Rewrite model-usage-chart.tsx
6. [ ] Task 6: Create cost-trend-chart.tsx
7. [ ] Task 7: Fix model-distribution-chart.tsx
8. [ ] Task 8: Update analytics-page.tsx
9. [ ] Task 9: Update stat-card.tsx
10. [ ] Test all endpoints with curl
11. [ ] Verify charts render correctly
12. [ ] Commit changes
