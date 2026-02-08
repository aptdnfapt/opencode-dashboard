<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { Chart, registerables } from 'chart.js'
  import { getAnalyticsSummary, getCostTrend, getCostByModel, getCostByAgent, getHeatmap, getTokenFlow, getProjectAnalytics, getSummaryExtended } from '$lib/api'
  import { formatTokens, formatCost } from '$lib/utils'
  import StatCard from '$lib/components/StatCard.svelte'
  import Heatmap from '$lib/components/Heatmap.svelte'
  import { store } from '$lib/store.svelte'
  import { Calendar, TrendingUp, PieChart, BarChart3, Activity, ArrowRightLeft, FolderKanban } from 'lucide-svelte'
  
  // Register Chart.js components only in browser (SSR safe)
  if (browser) {
    Chart.register(...registerables)
  }
  
  // Track session count to detect changes
  let lastSessionCount = $state(0)
  
  // State
  let loading = $state(true)
  let summary = $state({ total_sessions: 0, total_tokens: 0, total_cost: 0 })
  let summaryExt = $state({ total_requests: 0, total_input: 0, total_output: 0, total_tokens: 0, total_cost: 0 })
  let costTrend = $state<{ date: string; cost: number; tokens: number }[]>([])
  let costByModel = $state<{ label: string; value: number; tokens: number }[]>([])
  let costByAgent = $state<{ label: string; value: number; tokens: number }[]>([])
  let heatmapData = $state<Record<string, number>>({})
  let tokenFlow = $state<{ period: string; input: number; output: number }[]>([])
  let projectAnalytics = $state<{ directory: string; sessions: number; tokens: number; cost: number }[]>([])
  
  // Time range for trend chart
  let trendRange = $state<7 | 30 | 90>(30)
  let flowRange = $state<'7d' | '30d' | '90d'>('7d')
  
  // Chart instances (for cleanup)
  let lineChart: Chart | null = null
  let donutChart: Chart | null = null
  let barChart: Chart | null = null
  let flowChart: Chart | null = null
  let projectChart: Chart | null = null
  
  // Canvas refs
  let lineCanvas: HTMLCanvasElement
  let donutCanvas: HTMLCanvasElement
  let barCanvas: HTMLCanvasElement
  let flowCanvas: HTMLCanvasElement
  let projectCanvas: HTMLCanvasElement
  
  // Dark theme colors matching app.css
  const colors = {
    blue: '#58a6ff',
    green: '#3fb950',
    amber: '#d29922',
    red: '#f85149',
    purple: '#a371f7',
    cyan: '#39d4ba',
    bgSecondary: '#161b22',
    bgTertiary: '#21262d',
    fgPrimary: '#e6edf3',
    fgSecondary: '#8b949e',
    fgMuted: '#6e7681',
    border: '#30363d'
  }
  
  // Color palette for charts
  const chartColors = [
    colors.blue,
    colors.green,
    colors.amber,
    colors.purple,
    colors.red,
    colors.cyan,
    '#79c0ff',
    '#7ee787',
  ]
  
  // Initialize/update line chart (cost trend)
  function renderLineChart() {
    if (!lineCanvas || costTrend.length === 0) return
    if (lineChart) lineChart.destroy()
    
    lineChart = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels: costTrend.map(d => d.date.slice(5)),
        datasets: [{
          label: 'Cost',
          data: costTrend.map(d => d.cost),
          borderColor: colors.green,
          backgroundColor: colors.green + '20',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.bgTertiary,
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: colors.border,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `Cost: ${formatCost(ctx.raw as number)}`
            }
          }
        },
        scales: {
          x: { grid: { color: colors.border + '40' }, ticks: { color: colors.fgMuted, maxTicksLimit: 10 } },
          y: { grid: { color: colors.border + '40' }, ticks: { color: colors.fgMuted, callback: (v) => '$' + Number(v).toFixed(2) } }
        }
      }
    })
  }
  
  // Initialize donut chart (cost by model)
  function renderDonutChart() {
    if (!donutCanvas || costByModel.length === 0) return
    if (donutChart) donutChart.destroy()
    
    donutChart = new Chart(donutCanvas, {
      type: 'doughnut',
      data: {
        labels: costByModel.map(d => d.label),
        datasets: [{
          data: costByModel.map(d => d.value),
          backgroundColor: chartColors.slice(0, costByModel.length),
          borderColor: colors.bgSecondary,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { position: 'right', labels: { color: colors.fgSecondary, padding: 12, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: {
            backgroundColor: colors.bgTertiary,
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: colors.border,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const item = costByModel[ctx.dataIndex]
                return `${formatCost(item.value)} (${formatTokens(item.tokens)} tok)`
              }
            }
          }
        }
      }
    })
  }
  
  // Initialize bar chart (cost by agent)
  function renderBarChart() {
    if (!barCanvas || costByAgent.length === 0) return
    if (barChart) barChart.destroy()
    
    barChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: costByAgent.map(d => d.label),
        datasets: [{
          label: 'Cost',
          data: costByAgent.map(d => d.value),
          backgroundColor: chartColors.slice(0, costByAgent.length),
          borderRadius: 4,
          barThickness: 32
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.bgTertiary,
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: colors.border,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const item = costByAgent[ctx.dataIndex]
                return `${formatCost(item.value)} (${formatTokens(item.tokens)} tok)`
              }
            }
          }
        },
        scales: {
          x: { grid: { color: colors.border + '40' }, ticks: { color: colors.fgMuted, callback: (v) => '$' + Number(v).toFixed(2) } },
          y: { grid: { display: false }, ticks: { color: colors.fgSecondary } }
        }
      }
    })
  }
  
  // Token flow chart (input vs output)
  function renderFlowChart() {
    if (!flowCanvas || tokenFlow.length === 0) return
    if (flowChart) flowChart.destroy()
    
    flowChart = new Chart(flowCanvas, {
      type: 'bar',
      data: {
        labels: tokenFlow.map(d => d.period),
        datasets: [
          {
            label: 'Input',
            data: tokenFlow.map(d => d.input),
            backgroundColor: colors.blue,
            borderRadius: 4
          },
          {
            label: 'Output',
            data: tokenFlow.map(d => d.output),
            backgroundColor: colors.green,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { position: 'top', labels: { color: colors.fgSecondary, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: {
            backgroundColor: colors.bgTertiary,
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: colors.border,
            borderWidth: 1,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatTokens(ctx.raw as number)}` }
          }
        },
        scales: {
          x: { grid: { color: colors.border + '40' }, ticks: { color: colors.fgMuted } },
          y: { grid: { color: colors.border + '40' }, ticks: { color: colors.fgMuted, callback: (v) => formatTokens(Number(v)) } }
        }
      }
    })
  }
  
  // Project analytics chart
  function renderProjectChart() {
    if (!projectCanvas || projectAnalytics.length === 0) return
    if (projectChart) projectChart.destroy()
    
    const top5 = projectAnalytics.slice(0, 5)
    
    projectChart = new Chart(projectCanvas, {
      type: 'bar',
      data: {
        labels: top5.map(d => d.directory.split('/').pop() || d.directory),
        datasets: [{
          label: 'Tokens',
          data: top5.map(d => d.tokens),
          backgroundColor: chartColors.slice(0, top5.length),
          borderRadius: 4,
          barThickness: 28
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.bgTertiary,
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: colors.border,
            borderWidth: 1,
            callbacks: {
              title: (ctx) => top5[ctx[0].dataIndex].directory,
              label: (ctx) => {
                const item = top5[ctx.dataIndex]
                return `${formatTokens(item.tokens)} tokens, ${formatCost(item.cost)}`
              }
            }
          }
        },
        scales: {
          x: { grid: { color: colors.border + '40' }, ticks: { color: colors.fgMuted, callback: (v) => formatTokens(Number(v)) } },
          y: { grid: { display: false }, ticks: { color: colors.fgSecondary } }
        }
      }
    })
  }
  
  // Load trend data for selected range
  async function loadTrend(days: 7 | 30 | 90) {
    trendRange = days
    try {
      costTrend = await getCostTrend(days)
      renderLineChart()
    } catch (err) {
      console.error('Failed to load trend:', err)
    }
  }
  
  // Load token flow for selected range
  async function loadFlow(range: '7d' | '30d' | '90d') {
    flowRange = range
    try {
      tokenFlow = await getTokenFlow(range)
      renderFlowChart()
    } catch (err) {
      console.error('Failed to load token flow:', err)
    }
  }
  
  // Initial data load
  onMount(async () => {
    try {
      const [s, sExt, trend, models, agents, heatmap, flow, projects] = await Promise.all([
        getAnalyticsSummary(),
        getSummaryExtended(),
        getCostTrend(trendRange),
        getCostByModel(),
        getCostByAgent(),
        getHeatmap(365),
        getTokenFlow(flowRange),
        getProjectAnalytics('30d')
      ])
      summary = s
      summaryExt = sExt
      costTrend = trend
      costByModel = models
      costByAgent = agents
      // Convert heatmap array to Record<string, number>
      heatmapData = heatmap.reduce((acc, d) => {
        acc[d.date] = d.requests
        return acc
      }, {} as Record<string, number>)
      tokenFlow = flow
      projectAnalytics = projects
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      loading = false
    }
  })
  
  // Render charts after data loads
  $effect(() => {
    if (!loading && costTrend.length > 0) {
      setTimeout(() => {
        renderLineChart()
        renderDonutChart()
        renderBarChart()
        renderFlowChart()
        renderProjectChart()
      }, 0)
    }
  })
  
  // Cleanup charts on component unmount
  onDestroy(() => {
    if (lineChart) lineChart.destroy()
    if (donutChart) donutChart.destroy()
    if (barChart) barChart.destroy()
    if (flowChart) flowChart.destroy()
    if (projectChart) projectChart.destroy()
  })
  
  // Refresh analytics when sessions change
  $effect(() => {
    const currentCount = store.sessions.length
    const currentTokens = store.stats.totalTokens
    
    if (lastSessionCount === 0) {
      lastSessionCount = currentCount
      return
    }
    
    if (currentCount !== lastSessionCount || loading === false) {
      lastSessionCount = currentCount
      refreshAnalytics()
    }
  })
  
  // Debounced refresh
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null
  async function refreshAnalytics() {
    if (refreshTimeout) clearTimeout(refreshTimeout)
    refreshTimeout = setTimeout(async () => {
      try {
        const [s, models, agents] = await Promise.all([
          getAnalyticsSummary(),
          getCostByModel(),
          getCostByAgent()
        ])
        summary = s
        costByModel = models
        costByAgent = agents
        renderDonutChart()
        renderBarChart()
      } catch (err) {
        console.error('Failed to refresh analytics:', err)
      }
    }, 1000)
  }
  
  // Compute input/output ratio
  let ioRatio = $derived(summaryExt.total_input > 0 ? (summaryExt.total_output / summaryExt.total_input).toFixed(2) : '0')
</script>

<div class="p-6">
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-[var(--fg-primary)] flex items-center gap-2">
      <Activity size={20} />
      Analytics
    </h1>
    <p class="text-sm text-[var(--fg-secondary)]">Token usage and cost breakdown</p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <span class="text-[var(--fg-muted)]">Loading analytics...</span>
    </div>
  {:else}
    <!-- Summary stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
      <StatCard label="Total Sessions" value={summary.total_sessions} />
      <StatCard label="Total Tokens" value={formatTokens(summary.total_tokens)} color="blue" />
      <StatCard label="Total Cost" value={formatCost(summary.total_cost)} color="green" />
      <StatCard label="Input Tokens" value={formatTokens(summaryExt.total_input)} color="blue" />
      <StatCard label="Output Tokens" value={formatTokens(summaryExt.total_output)} color="amber" />
      <StatCard label="I/O Ratio" value={`1:${ioRatio}`} subvalue="output per input" />
    </div>

    <!-- Activity Heatmap (GitHub style) -->
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-8">
      <div class="flex items-center gap-2 mb-4">
        <Calendar size={16} class="text-[var(--fg-muted)]" />
        <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Activity</h2>
        <span class="text-xs text-[var(--fg-muted)]">Last 365 days</span>
      </div>
      <div class="overflow-x-auto">
        <Heatmap data={heatmapData} days={365} />
      </div>
    </div>

    <!-- Token Flow Chart -->
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-8">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <ArrowRightLeft size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Token Flow</h2>
        </div>
        <div class="flex gap-1">
          {#each ['7d', '30d', '90d'] as range}
            <button
              onclick={() => loadFlow(range as '7d' | '30d' | '90d')}
              class="px-3 py-1 text-xs rounded transition-colors {flowRange === range 
                ? 'bg-[var(--accent-blue)] text-white' 
                : 'bg-[var(--bg-tertiary)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]'}"
            >
              {range}
            </button>
          {/each}
        </div>
      </div>
      {#if tokenFlow.length === 0}
        <div class="h-48 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
      {:else}
        <div class="h-48">
          <canvas bind:this={flowCanvas}></canvas>
        </div>
      {/if}
    </div>

    <!-- Charts grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Cost by Model - Donut Chart -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
        <div class="flex items-center gap-2 mb-4">
          <PieChart size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Cost by Model</h2>
        </div>
        {#if costByModel.length === 0}
          <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
        {:else}
          <div class="h-64">
            <canvas bind:this={donutCanvas}></canvas>
          </div>
        {/if}
      </div>

      <!-- Cost by Agent - Bar Chart -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
        <div class="flex items-center gap-2 mb-4">
          <BarChart3 size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Cost by Agent</h2>
        </div>
        {#if costByAgent.length === 0}
          <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
        {:else}
          <div class="h-64">
            <canvas bind:this={barCanvas}></canvas>
          </div>
        {/if}
      </div>
    </div>

    <!-- Project Analytics -->
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-8">
      <div class="flex items-center gap-2 mb-4">
        <FolderKanban size={16} class="text-[var(--fg-muted)]" />
        <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Top Projects</h2>
        <span class="text-xs text-[var(--fg-muted)]">by token usage</span>
      </div>
      {#if projectAnalytics.length === 0}
        <div class="h-48 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
      {:else}
        <div class="h-48">
          <canvas bind:this={projectCanvas}></canvas>
        </div>
      {/if}
    </div>

    <!-- Cost Trend - Line Chart (full width) -->
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <TrendingUp size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Cost Trend</h2>
        </div>
        <div class="flex gap-1">
          {#each [7, 30, 90] as days}
            <button
              onclick={() => loadTrend(days as 7 | 30 | 90)}
              class="px-3 py-1 text-xs rounded transition-colors {trendRange === days 
                ? 'bg-[var(--accent-blue)] text-white' 
                : 'bg-[var(--bg-tertiary)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]'}"
            >
              {days}d
            </button>
          {/each}
        </div>
      </div>
      {#if costTrend.length === 0}
        <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
      {:else}
        <div class="h-64">
          <canvas bind:this={lineCanvas}></canvas>
        </div>
      {/if}
    </div>

    <!-- Data tables (collapsed by default) -->
    <details class="mt-6">
      <summary class="cursor-pointer text-sm text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] mb-4">
        View raw data tables
      </summary>
      
      <!-- Cost by Model Table -->
      <div class="mb-6">
        <h3 class="text-sm font-medium text-[var(--fg-secondary)] mb-2">Model Breakdown</h3>
        <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
          {#if costByModel.length === 0}
            <div class="p-4 text-center text-[var(--fg-muted)]">No data</div>
          {:else}
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-[var(--border-subtle)]">
                  <th class="text-left px-4 py-3 text-[var(--fg-muted)] font-medium">Model</th>
                  <th class="text-right px-4 py-3 text-[var(--fg-muted)] font-medium">Tokens</th>
                  <th class="text-right px-4 py-3 text-[var(--fg-muted)] font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {#each costByModel as row}
                  <tr class="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-tertiary)]">
                    <td class="px-4 py-3 mono text-[var(--fg-primary)]">{row.label}</td>
                    <td class="px-4 py-3 mono text-right text-[var(--fg-secondary)]">{formatTokens(row.tokens)}</td>
                    <td class="px-4 py-3 mono text-right text-[var(--accent-green)]">{formatCost(row.value)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>

      <!-- Cost by Agent Table -->
      <div>
        <h3 class="text-sm font-medium text-[var(--fg-secondary)] mb-2">Agent Breakdown</h3>
        <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
          {#if costByAgent.length === 0}
            <div class="p-4 text-center text-[var(--fg-muted)]">No data</div>
          {:else}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
              {#each costByAgent as agent}
                <div class="p-3 rounded bg-[var(--bg-tertiary)]">
                  <div class="text-xs text-[var(--fg-muted)] uppercase mb-1">{agent.label}</div>
                  <div class="text-lg font-semibold mono text-[var(--fg-primary)]">{formatCost(agent.value)}</div>
                  <div class="text-xs mono text-[var(--fg-secondary)]">{formatTokens(agent.tokens)} tok</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </details>
  {/if}
</div>
