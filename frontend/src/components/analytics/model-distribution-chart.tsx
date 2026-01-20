// frontend/src/components/analytics/model-distribution-chart.tsx
import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const CHART_COLORS = ["#635bff", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f43f5e"]

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
      .then((d: ModelData[]) => setData(d.filter(m => m.model_id))) // filter null model_ids
      .finally(() => setLoading(false))
  }, [])

  const chartData = data.map((d, i) => ({
    name: d.model_id,
    value: d.total_tokens,
    cost: d.total_cost,
    color: CHART_COLORS[i % CHART_COLORS.length]
  }))

  const total = chartData.reduce((s, d) => s + d.value, 0)
  const totalCost = chartData.reduce((s, d) => s + d.cost, 0)

  if (loading) {
    return <div className="rounded-lg border border-border bg-card p-6 h-64 animate-pulse" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6">
        <h3 className="text-sm font-medium">Model Distribution</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {total.toLocaleString()} tokens · ${totalCost.toFixed(2)}
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Pie chart */}
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={60}
                  dataKey="value"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(230 12% 10%)",
                    border: "1px solid hsl(230 10% 16%)",
                    borderRadius: "6px",
                    fontSize: "12px"
                  }}
                  formatter={(v: number) => [v.toLocaleString(), "Tokens"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 grid grid-cols-2 gap-3 w-full">
            {chartData.map(item => (
              <div key={item.name} className="flex items-center gap-3">
                <div className="size-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{item.name}</p>
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
