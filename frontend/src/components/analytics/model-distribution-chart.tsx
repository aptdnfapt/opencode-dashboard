"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { PieChart as PieIcon } from "lucide-react"

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
  "#22c55e", "#eab308", "#06b6d4", "#ef4444"
]

export interface ModelData {
  model_id: string
  total_tokens: number
  total_cost: number
}

interface ModelDistributionChartProps {
  data: ModelData[]
  loading?: boolean
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-2">{payload[0]?.name}</p>
      <div className="flex items-center gap-2 text-xs">
        <div
          className="w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: payload[0]?.color }}
        />
        <span className="text-muted-foreground">Tokens:</span>
        <span className="font-medium text-foreground">
          {payload[0]?.value.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

export function ModelDistributionChart({ data, loading }: ModelDistributionChartProps) {
  const chartData = data.map((d, i) => ({
    name: d.model_id,
    value: d.total_tokens,
    cost: d.total_cost,
    color: COLORS[i % COLORS.length]
  }))

  const totalTokens = chartData.reduce((acc, d) => acc + d.value, 0)
  const totalCost = chartData.reduce((acc, d) => acc + d.cost, 0)

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    percent: number
  }) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="h-8 w-48 animate-pulse bg-muted rounded mb-4" />
        <div className="h-64 bg-muted/50 rounded" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <PieIcon className="size-5 text-primary" />
          Model Distribution
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {totalTokens.toLocaleString()} tokens · ${totalCost.toFixed(2)} total
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="h-64 w-full max-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  innerRadius={40}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-3 w-full">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {((item.value / totalTokens) * 100).toFixed(1)}%
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