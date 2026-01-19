// frontend/src/pages/analytics-page.tsx
// Analytics page with charts
import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, Activity, TrendingUp, Calendar } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981']

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const summary = { total_sessions: 0, total_tokens: 0, total_cost: 0 }
  const models: { model_id: string; total_tokens: number; total_cost: number }[] = []
  const daily: { date: string; total_tokens: number; total_cost: number }[] = []

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const [summaryRes, modelsRes, dailyRes] = await Promise.all([
          fetch('/api/analytics/summary'),
          fetch('/api/analytics/models'),
          fetch('/api/analytics/daily')
        ])
        
        const s = await summaryRes.json()
        const m = await modelsRes.json()
        const d = await dailyRes.json()
        
        Object.assign(summary, s)
        models.push(...m)
        daily.push(...d)
      } catch (err) {
        console.error('Failed to fetch analytics:', err)
      }
      setLoading(false)
    }
    fetchAnalytics()
  }, [])

  const modelChartData = models.length ? models.map(m => ({ name: m.model_id, tokens: m.total_tokens, cost: m.total_cost })) : []
  const dailyChartData = daily.length ? daily.slice(0, 7).reverse().map(d => ({ date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tokens: d.total_tokens })) : []

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Activity className="size-6 text-primary" />
          <h1 className="text-xl font-semibold">Analytics</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Sessions" value={summary.total_sessions} icon="sessions" />
          <StatCard title="Total Tokens" value={summary.total_tokens.toLocaleString()} icon="tokens" />
          <StatCard title="Total Cost" value={`$${summary.total_cost.toFixed(2)}`} icon="cost" />
          <StatCard title="Avg per Session" value={summary.total_sessions ? Math.round((summary.total_tokens / summary.total_sessions) / 1000) + 'k' : '0k'} icon="tokens" />
        </div>

        {/* Token usage by model */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Token Usage by Model</h2>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-64" />
          ) : modelChartData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelChartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tokens" fill="#3b82f6" name="Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-16">No data available</p>
          )}
        </div>

        {/* Daily usage */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Daily Token Usage (Last 7 Days)</h2>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-64" />
          ) : dailyChartData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-16">No data available</p>
          )}
        </div>
      </main>
    </div>
  )
}
