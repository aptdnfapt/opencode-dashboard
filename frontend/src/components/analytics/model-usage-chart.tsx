// frontend/src/components/analytics/model-usage-chart.tsx
import { useState, useEffect, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

// Stripe-style chart colors
const CHART_COLORS = [
  "#635bff", // indigo (primary)
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f43f5e", // rose
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

  // Extract models and flatten data for Recharts (avoid nested paths with special chars)
  const { models, colorMap, chartData } = useMemo(() => {
    const modelSet = new Set<string>()
    data.forEach(d => Object.keys(d.models || {}).forEach(m => modelSet.add(m)))
    const models = Array.from(modelSet)
    const colorMap = Object.fromEntries(models.map((m, i) => [m, CHART_COLORS[i % CHART_COLORS.length]]))
    
    // Flatten: { period, total, models: {a: 1, b: 2} } -> { period, total, model_0: 1, model_1: 2 }
    const chartData = data.map(d => {
      const flat: Record<string, any> = { period: d.period, total: d.total }
      models.forEach((m, i) => {
        flat[`model_${i}`] = d.models?.[m] || 0
      })
      return flat
    })
    
    return { models, colorMap, chartData }
  }, [data])

  const totalTokens = data.reduce((sum, d) => sum + (d.total || 0), 0)

  const formatPeriod = (p: string) => {
    if (range === "24h") return p.split(" ")[1] || p
    return new Date(p).toLocaleDateString("en", { month: "short", day: "numeric" })
  }

  if (loading) {
    return <div className="rounded-lg border border-border bg-card p-6 h-80 animate-pulse" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium">Token Usage</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalTokens.toLocaleString()} tokens
          </p>
        </div>
        {/* Range tabs */}
        <div className="flex gap-1 p-1 rounded-md bg-muted">
          {(["24h", "7d", "30d"] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                range === r 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 || models.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 10% 16%)" vertical={false} />
              <XAxis 
                dataKey="period" 
                tickFormatter={formatPeriod}
                tick={{ fontSize: 11, fill: "hsl(220 8% 55%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                tick={{ fontSize: 11, fill: "hsl(220 8% 55%)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ 
                  background: "hsl(230 12% 10%)", 
                  border: "1px solid hsl(230 10% 16%)",
                  borderRadius: "6px",
                  fontSize: "12px"
                }}
                labelFormatter={formatPeriod}
                formatter={(v: number, name: string) => [v.toLocaleString(), name]}
              />
              {models.map((model, i) => (
                <Bar 
                  key={model} 
                  dataKey={`model_${i}`} 
                  stackId="a" 
                  fill={colorMap[model]} 
                  name={model}
                  radius={[2, 2, 0, 0]}
                />
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
              <div className="size-2.5 rounded-sm" style={{ background: colorMap[m] }} />
              <span className="text-xs text-muted-foreground">{m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
