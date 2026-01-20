// frontend/src/pages/analytics-page.tsx
// New analytics dashboard with D3 charts
import { useState, useEffect, useCallback } from "react"
import { AreaChart } from "@/components/charts/AreaChart"
import { DonutChart } from "@/components/charts/DonutChart"
import { BarChart } from "@/components/charts/BarChart"
import { HeatmapChart } from "@/components/charts/HeatmapChart"
import { MultiLineChart } from "@/components/charts/MultiLineChart"
import { TokenFlowChart } from "@/components/charts/TokenFlowChart"
import { StackedBarChart } from "@/components/charts/StackedBarChart"
import { Coins, DollarSign, ArrowDownToLine, ArrowUpFromLine, Zap } from "lucide-react"

// ============================================
// Types
// ============================================
interface Summary {
  total_requests: number
  total_input: number
  total_output: number
  total_tokens: number
  total_cost: number
}

interface CostByModel {
  label: string
  value: number
  tokens: number
}

interface CostByAgent {
  label: string
  value: number
  tokens: number
}

interface TokenFlow {
  period: string
  input: number
  output: number
}

interface ModelUsage {
  period: string
  total: number
  models: Record<string, number>
}

interface FileStats {
  extension: string
  lines_added: number
  lines_removed: number
  edit_count: number
}

interface HeatmapData {
  date: string
  tokens: number
  cost: number
}

interface ModelPerformance {
  period: string
  models: Record<string, number>
}

interface CostTrend {
  date: string
  cost: number
}

type Range = "24h" | "7d" | "30d" | "1y"

// ============================================
// Component
// ============================================
export function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary>({ total_requests: 0, total_input: 0, total_output: 0, total_tokens: 0, total_cost: 0 })
  const [costByModel, setCostByModel] = useState<CostByModel[]>([])
  const [costByAgent, setCostByAgent] = useState<CostByAgent[]>([])
  const [tokenFlow, setTokenFlow] = useState<TokenFlow[]>([])
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([])
  const [fileStats, setFileStats] = useState<FileStats[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([])
  const [modelPerf, setModelPerf] = useState<ModelPerformance[]>([])
  const [costTrend, setCostTrend] = useState<CostTrend[]>([])
  const [modelList, setModelList] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  
  const [tokenRange, setTokenRange] = useState<Range>("7d")
  const [perfRange, setPerfRange] = useState<Range>("7d")
  const [usageRange, setUsageRange] = useState<Range>("7d")
  const [loading, setLoading] = useState(true)

  // Helper to get auth headers
  const getHeaders = useCallback(() => {
    const password = localStorage.getItem('dashboard_password') || ''
    return { 'X-API-Key': password }
  }, [])

  // Fetch all data
  useEffect(() => {
    Promise.all([
      fetch("/api/analytics/summary-extended", { headers: getHeaders() }).then(r => r.json()),
      fetch("/api/analytics/cost-by-model", { headers: getHeaders() }).then(r => r.json()),
      fetch("/api/analytics/cost-by-agent", { headers: getHeaders() }).then(r => r.json()),
      fetch("/api/analytics/file-stats", { headers: getHeaders() }).then(r => r.json()),
      fetch("/api/analytics/heatmap", { headers: getHeaders() }).then(r => r.json()),
      fetch("/api/analytics/cost-trend?days=30", { headers: getHeaders() }).then(r => r.json()),
      fetch("/api/analytics/model-list", { headers: getHeaders() }).then(r => r.json()),
    ]).then(([sum, models, agents, files, heatmap, cost, modelL]) => {
      setSummary(sum)
      setCostByModel(models)
      setCostByAgent(agents)
      setFileStats(files)
      setHeatmapData(heatmap)
      setCostTrend(cost)
      setModelList(modelL)
      setSelectedModels(modelL.slice(0, 4)) // default first 4
      setLoading(false)
    })
  }, [getHeaders])

  // Fetch token flow when range changes
  useEffect(() => {
    fetch(`/api/analytics/token-flow?range=${tokenRange}`, { headers: getHeaders() })
      .then(r => r.json())
      .then(setTokenFlow)
  }, [tokenRange, getHeaders])

  // Fetch model usage when range changes
  useEffect(() => {
    fetch(`/api/analytics/usage?range=${usageRange}`, { headers: getHeaders() })
      .then(r => r.json())
      .then(setModelUsage)
  }, [usageRange, getHeaders])

  // Fetch model performance when range changes
  useEffect(() => {
    const params = new URLSearchParams({ range: perfRange })
    if (selectedModels.length) params.set("models", selectedModels.join(","))
    fetch(`/api/analytics/model-performance?${params}`, { headers: getHeaders() })
      .then(r => r.json())
      .then(setModelPerf)
  }, [perfRange, selectedModels, getHeaders])

  const formatCost = useCallback((v: number) => {
    if (v >= 100) return `$${v.toFixed(0)}`
    if (v >= 1) return `$${v.toFixed(2)}`
    return `$${v.toFixed(4)}`
  }, [])

  const formatTokens = useCallback((v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
    return v.toString()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header Stats Bar - fully responsive */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <StatItem 
              icon={<DollarSign className="size-3.5 sm:size-4" />}
              label="Total Spend"
              value={formatCost(summary.total_cost)}
              color="text-emerald-400"
            />
            <StatItem 
              icon={<Zap className="size-3.5 sm:size-4" />}
              label="Requests"
              value={summary.total_requests.toLocaleString()}
            />
            <StatItem 
              icon={<Coins className="size-3.5 sm:size-4" />}
              label="Total Tokens"
              value={formatTokens(summary.total_tokens)}
            />
            <StatItem 
              icon={<ArrowDownToLine className="size-3.5 sm:size-4" />}
              label="Input"
              value={formatTokens(summary.total_input)}
              color="text-indigo-400"
            />
            <StatItem 
              icon={<ArrowUpFromLine className="size-3.5 sm:size-4" />}
              label="Output"
              value={formatTokens(summary.total_output)}
              color="text-sky-400"
            />
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Row 1: Cost Over Time (full width) */}
        <ChartCard title="Cost Over Time">
          <AreaChart
            data={costTrend.map(d => ({ date: d.date, value: d.cost }))}
            color="#10b981"
            formatValue={formatCost}
            label="Cost"
            height={280}
          />
        </ChartCard>

        {/* Row 2: Cost by Model + Cost by Agent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Cost by Model">
            <DonutChart
              data={costByModel}
              formatValue={formatCost}
              centerLabel="TOTAL COST"
              height={260}
            />
          </ChartCard>
          
          <ChartCard title="Cost by Agent">
            {costByAgent.length > 0 ? (
              <BarChart
                data={costByAgent.map(a => ({ label: a.label || "unknown", value: a.value }))}
                formatValue={formatCost}
                valueLabel="Cost"
              />
            ) : (
              <div className="h-32 sm:h-36 lg:h-40 flex items-center justify-center text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                No agent data yet
              </div>
            )}
          </ChartCard>
        </div>

        {/* Row 3: Token Flow (full width) */}
        <ChartCard 
          title="Token Flow" 
          action={
            <RangeSelector value={tokenRange} onChange={setTokenRange} />
          }
        >
          <TokenFlowChart data={tokenFlow} height={280} />
        </ChartCard>

        {/* Row 4: Model Usage Over Time (full width) */}
        <ChartCard 
          title="Model Usage Over Time" 
          action={
            <RangeSelector value={usageRange} onChange={setUsageRange} />
          }
        >
          <StackedBarChart data={modelUsage} height={280} />
        </ChartCard>

        {/* Row 3: Lines of Code */}
        <ChartCard title="Lines of Code by Language">
          {fileStats.length > 0 ? (
            <BarChart
              data={fileStats.map(f => ({ 
                label: f.extension || "unknown", 
                value: f.lines_added,
                secondary: f.lines_removed
              }))}
              formatValue={(v) => `${v.toLocaleString()}`}
              formatSecondary={(v) => `${v.toLocaleString()}`}
              valueLabel="Added"
              secondaryLabel="Removed"
              showSecondary
            />
            ) : (
              <div className="h-32 sm:h-36 lg:h-40 flex items-center justify-center text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                No file edit data yet
              </div>
            )}
        </ChartCard>

        {/* Row 4: Token Usage Heatmap */}
        <ChartCard title="Token Usage Heatmap">
          <HeatmapChart 
            data={heatmapData} 
            formatValue={(v) => formatTokens(v)}
          />
        </ChartCard>

        {/* Row 5: Model Performance */}
        <ChartCard 
          title="Model Performance - Avg Response Time"
          action={
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <ModelFilter 
                models={modelList} 
                selected={selectedModels} 
                onChange={setSelectedModels} 
              />
              <RangeSelector value={perfRange} onChange={setPerfRange} />
            </div>
          }
        >
          {modelPerf.length > 0 ? (
            <MultiLineChart
              data={modelPerf}
              selectedModels={selectedModels}
              formatValue={(v) => `${(v / 1000).toFixed(1)}s`}
              valueLabel="Avg Duration"
              height={280}
            />
          ) : (
            <div className="h-32 sm:h-36 lg:h-40 flex items-center justify-center text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
              No performance data yet
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ============================================
// Sub-components
// ============================================
function StatItem({ icon, label, value, color }: { 
  icon: React.ReactNode
  label: string
  value: string
  color?: string 
}) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className={`text-base sm:text-lg font-semibold font-mono truncate ${color || "text-foreground"}`}>{value}</div>
        <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  )
}

function ChartCard({ title, children, action }: { 
  title: string
  children: React.ReactNode
  action?: React.ReactNode 
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex-1 min-w-0" />
        {action}
      </div>
      {children}
    </div>
  )
}

function RangeSelector({ value, onChange }: { 
  value: Range
  onChange: (v: Range) => void 
}) {
  const ranges: Range[] = ["24h", "7d", "30d", "1y"]
  return (
    <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-md bg-muted">
      {ranges.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2 py-1 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs rounded transition-colors ${
            value === r 
              ? "bg-card text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

function ModelFilter({ models, selected, onChange }: {
  models: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (model: string) => {
    if (selected.includes(model)) {
      onChange(selected.filter(m => m !== model))
    } else {
      onChange([...selected, model])
    }
  }

  if (models.length === 0) return null

  return (
    <div className="flex flex-wrap gap-0.5 sm:gap-1">
      {models.slice(0, 6).map(m => (
        <button
          key={m}
          onClick={() => toggle(m)}
          className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 text-[11px] sm:text-xs rounded transition-colors ${
            selected.includes(m)
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.length > 12 ? m.slice(0, 12) + "…" : m}
        </button>
      ))}
    </div>
  )
}
