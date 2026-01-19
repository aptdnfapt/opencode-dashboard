"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Calendar, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
  "#22c55e", "#eab308", "#06b6d4", "#ef4444"
]

export interface UsageData {
  period: string
  total_tokens: number
  total_cost: number
  models: Record<string, number>
}

interface ModelUsageChartProps {
  data: UsageData[]
  loading?: boolean
}

type Period = "day" | "week" | "month"

const periodLabels: Record<Period, string> = {
  day: "Last 14 Days",
  week: "Last 8 Weeks",
  month: "Last 6 Months",
}

const periodLimits: Record<Period, number> = {
  day: 14,
  week: 8,
  month: 6,
}

function CustomTooltip({ active, payload, label, period }: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
  period: Period
}) {
  if (!active || !payload?.length) return null

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (period === "month") {
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-2">{formatDate(label || "")}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {entry.dataKey.replace("models.", "")}:
          </span>
          <span className="font-medium text-foreground">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ModelUsageChart({ data, loading }: ModelUsageChartProps) {
  const [period, setPeriod] = useState<Period>("day")

  const filteredData = useMemo(() => {
    const limit = periodLimits[period]
    return data.slice(-limit).reverse()
  }, [data, period])

  const modelColors = useMemo(() => {
    const models = new Set<string>()
    filteredData.forEach(d => {
      Object.keys(d.models).forEach(m => models.add(m))
    })
    return Array.from(models).reduce((acc, model, i) => {
      acc[model] = COLORS[i % COLORS.length]
      return acc
    }, {} as Record<string, string>)
  }, [filteredData])

  const totals = useMemo(() => {
    return filteredData.reduce((acc, d) => ({
      tokens: acc.tokens + (d.total_tokens || 0),
      cost: acc.cost + (d.total_cost || 0)
    }), { tokens: 0, cost: 0 })
  }, [filteredData])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (period === "month") {
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            Model Usage by {period === "day" ? "Day" : period === "week" ? "Week" : "Month"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {totals.tokens.toLocaleString()} tokens · ${totals.cost.toFixed(2)} cost
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" size="sm" className="h-8">
              <Calendar className="size-4 mr-2" />
              {periodLabels[period]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <DropdownMenuItem key={p} onClick={() => setPeriod(p)}>
                {periodLabels[p]} {period === p && "✓"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {Object.keys(modelColors).length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filteredData}
              barGap={2}
              margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={formatDate}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip
                content={<CustomTooltip period={period} />}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
              />
              {Object.entries(modelColors).map(([model, color]) => (
                <Bar
                  key={model}
                  dataKey={`models.${model}`}
                  stackId="a"
                  fill={color}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {Object.keys(modelColors).length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border">
          {Object.entries(modelColors).map(([model, color]) => (
            <div key={model} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground">{model}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}