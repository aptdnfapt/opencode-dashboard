"use client"

import { useState, useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import { TrendingUp, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface TrendData {
  date: string
  total_tokens: number
  total_cost: number
}

interface UsageTrendChartProps {
  data: TrendData[]
  loading?: boolean
}

type ChartType = "line" | "area"
type TimeRange = "14d" | "30d" | "90d"

const rangeLabels: Record<TimeRange, string> = {
  "14d": "Last 14 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
}

const rangeLimits: Record<TimeRange, number> = {
  "14d": 14,
  "30d": 30,
  "90d": 90,
}

const CHART_COLOR = "#8b5cf6"

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-2">{formatDate(label || "")}</p>
      <div className="flex items-center gap-2 text-xs">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: CHART_COLOR }}
        />
        <span className="text-muted-foreground">Tokens:</span>
        <span className="font-medium text-foreground">
          {payload[0]?.value.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

export function UsageTrendChart({ data, loading }: UsageTrendChartProps) {
  const [chartType, setChartType] = useState<ChartType>("area")
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")

  const filteredData = useMemo(() => {
    const limit = rangeLimits[timeRange]
    return data.slice(-limit).reverse()
  }, [data, timeRange])

  const maxValue = useMemo(() => {
    return Math.max(...filteredData.map(d => d.total_tokens), 0)
  }, [filteredData])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
            <Activity className="size-5 text-primary" />
            Usage Trend
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Token usage over time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm" className="h-8">
                {rangeLabels[timeRange]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(rangeLabels) as TimeRange[]).map((r) => (
                <DropdownMenuItem key={r} onClick={() => setTimeRange(r)}>
                  {rangeLabels[r]} {timeRange === r && "✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm" className="h-8 px-2">
                <TrendingUp className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setChartType("area")}>
                Area {chartType === "area" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChartType("line")}>
                Line {chartType === "line" && "✓"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "area" ? (
              <AreaChart
                data={filteredData}
                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={formatDate}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  domain={[0, maxValue * 1.1]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total_tokens"
                  stroke={CHART_COLOR}
                  strokeWidth={2}
                  fill="url(#trendGradient)"
                  dot={{ fill: CHART_COLOR, strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: CHART_COLOR, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <LineChart
                data={filteredData}
                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={formatDate}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  domain={[0, maxValue * 1.1]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="total_tokens"
                  stroke={CHART_COLOR}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLOR, strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: CHART_COLOR, stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}