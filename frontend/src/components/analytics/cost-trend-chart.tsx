// frontend/src/components/analytics/cost-trend-chart.tsx
import { useState, useEffect } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

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
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-sm font-medium">Cost Trend</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          ${totalCost.toFixed(2)} last 30 days
        </p>
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#635bff" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#635bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 10% 16%)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: "hsl(220 8% 55%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `$${v.toFixed(2)}`}
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
                labelFormatter={formatDate}
                formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#635bff"
                strokeWidth={2}
                fill="url(#costGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#635bff", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
