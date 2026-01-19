"use client"

import { useState, useEffect, useMemo } from "react"
import { Activity, DollarSign, TrendingUp, Calendar } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { ModelUsageChart, type UsageData } from "@/components/analytics/model-usage-chart"
import { UsageTrendChart, type TrendData } from "@/components/analytics/usage-trend-chart"
import { ModelDistributionChart, type ModelData } from "@/components/analytics/model-distribution-chart"
import { Skeleton } from "@/components/ui/skeleton"

interface SummaryData {
  total_sessions: number
  total_tokens: number
  total_cost: number
}

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SummaryData>({ total_sessions: 0, total_tokens: 0, total_cost: 0 })
  const [modelUsage, setModelUsage] = useState<UsageData[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [modelDistribution, setModelDistribution] = useState<ModelData[]>([])

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const [summaryRes, usageRes, trendRes, modelsRes] = await Promise.all([
          fetch("/api/analytics/summary"),
          fetch("/api/analytics/usage?period=day&limit=30"),
          fetch("/api/analytics/trend?days=90"),
          fetch("/api/analytics/models")
        ])

        const [s, u, t, m] = await Promise.all([
          summaryRes.json(),
          usageRes.json(),
          trendRes.json(),
          modelsRes.json()
        ])

        setSummary(s)
        setModelUsage(u)
        setTrendData(t)
        setModelDistribution(m)
      } catch (err) {
        console.error("Failed to fetch analytics:", err)
      }
      setLoading(false)
    }
    fetchAnalytics()
  }, [])

  const avgPerSession = useMemo(() => {
    return summary.total_sessions
      ? Math.round((summary.total_tokens / summary.total_sessions) / 1000) + "k"
      : "0k"
  }, [summary])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Activity className="size-6 text-primary" />
          <h1 className="text-xl font-semibold">Analytics</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <StatCard title="Total Sessions" value={summary.total_sessions} icon="sessions" />
              <StatCard title="Total Tokens" value={summary.total_tokens.toLocaleString()} icon="tokens" />
              <StatCard title="Total Cost" value={`$${summary.total_cost.toFixed(2)}`} icon="cost" />
              <StatCard title="Avg per Session" value={avgPerSession} icon="tokens" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ModelUsageChart data={modelUsage} loading={loading} />
          <UsageTrendChart data={trendData} loading={loading} />
        </div>

        <ModelDistributionChart data={modelDistribution} loading={loading} />
      </main>
    </div>
  )
}