// frontend/src/pages/analytics-page.tsx
import { useState, useEffect } from "react"
import { ModelUsageChart } from "@/components/analytics/model-usage-chart"
import { CostTrendChart } from "@/components/analytics/cost-trend-chart"
import { ModelDistributionChart } from "@/components/analytics/model-distribution-chart"
import { Coins, DollarSign, Activity } from "lucide-react"

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
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="h-full px-6 flex items-center">
          <h1 className="text-sm font-medium">Analytics</h1>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Sessions"
            value={loading ? "—" : summary.total_sessions.toString()}
            icon={<Activity className="size-4" />}
          />
          <StatCard
            label="Total Tokens"
            value={loading ? "—" : `${(summary.total_tokens / 1000).toFixed(1)}k`}
            icon={<Coins className="size-4" />}
          />
          <StatCard
            label="Total Cost"
            value={loading ? "—" : `$${summary.total_cost.toFixed(2)}`}
            icon={<DollarSign className="size-4" />}
          />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ModelUsageChart />
          <CostTrendChart />
        </div>

        {/* Charts row 2 */}
        <ModelDistributionChart />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}
