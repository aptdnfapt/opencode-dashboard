<script lang="ts">
  import { onMount } from 'svelte'
  import { Chart, registerables } from 'chart.js'
  import { getAnalyticsSummary, getCostTrend, getCostByModel, getCostByAgent } from '$lib/api'
  import { formatTokens, formatCost } from '$lib/utils'
  import StatCard from '$lib/components/StatCard.svelte'
  
  // Register all Chart.js components
  Chart.register(...registerables)
  
  // State
  let loading = $state(true)
  let summary = $state({ total_sessions: 0, total_tokens: 0, total_cost: 0 })
  let costTrend = $state<{ date: string; cost: number; tokens: number }[]>([])
  let costByModel = $state<{ label: string; value: number; tokens: number }[]>([])
  let costByAgent = $state<{ label: string; value: number; tokens: number }[]>([])
  
  // Time range for trend chart
  let trendRange = $state<7 | 30 | 90>(30)
  
  // Chart instances (for cleanup)
  let lineChart: Chart | null = null
  let donutChart: Chart | null = null
  let barChart: Chart | null = null
  
  // Canvas refs
  let lineCanvas: HTMLCanvasElement
  let donutCanvas: HTMLCanvasElement
  let barCanvas: HTMLCanvasElement
  
  // Dark theme colors matching app.css
  const colors = {
    blue: '#58a6ff',
    green: '#3fb950',
    amber: '#d29922',
    red: '#f85149',
    purple: '#a371f7',
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
    '#79c0ff', // lighter blue
    '#7ee787', // lighter green
    '#e3b341', // lighter amber
  ]
  
  // Initialize/update line chart (cost trend)
  function renderLineChart() {
    if (!lineCanvas || costTrend.length === 0) return
    
    // Destroy existing chart
    if (lineChart) lineChart.destroy()
    
    lineChart = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels: costTrend.map(d => d.date.slice(5)), // MM-DD format
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
          x: {
            grid: { color: colors.border + '40' },
            ticks: { color: colors.fgMuted, maxTicksLimit: 10 }
          },
          y: {
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.fgMuted,
              callback: (v) => '$' + Number(v).toFixed(2)
            }
          }
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
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: colors.fgSecondary,
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
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
        indexAxis: 'y', // Horizontal bars
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
          x: {
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.fgMuted,
              callback: (v) => '$' + Number(v).toFixed(2)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: colors.fgSecondary }
          }
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
  
  // Initial data load
  onMount(async () => {
    try {
      const [s, trend, models, agents] = await Promise.all([
        getAnalyticsSummary(),
        getCostTrend(trendRange),
        getCostByModel(),
        getCostByAgent()
      ])
      summary = s
      costTrend = trend
      costByModel = models
      costByAgent = agents
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      loading = false
    }
  })
  
  // Render charts after data loads
  $effect(() => {
    if (!loading && costTrend.length > 0) {
      // Use tick to ensure canvas is mounted
      setTimeout(() => {
        renderLineChart()
        renderDonutChart()
        renderBarChart()
      }, 0)
    }
  })
</script>

<div class="p-6">
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-[var(--fg-primary)]">Analytics</h1>
    <p class="text-sm text-[var(--fg-secondary)]">Token usage and cost breakdown</p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <span class="text-[var(--fg-muted)]">Loading analytics...</span>
    </div>
  {:else}
    <!-- Summary stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <StatCard label="Total Sessions" value={summary.total_sessions} />
      <StatCard label="Total Tokens" value={formatTokens(summary.total_tokens)} color="blue" />
      <StatCard label="Total Cost" value={formatCost(summary.total_cost)} color="green" />
    </div>

    <!-- Charts grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      
      <!-- Cost by Model - Donut Chart -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
        <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide mb-4">Cost by Model</h2>
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
        <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide mb-4">Cost by Agent</h2>
        {#if costByAgent.length === 0}
          <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
        {:else}
          <div class="h-64">
            <canvas bind:this={barCanvas}></canvas>
          </div>
        {/if}
      </div>
    </div>

    <!-- Cost Trend - Line Chart (full width) -->
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Cost Trend</h2>
        
        <!-- Time range selector -->
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

    <!-- Data tables (collapsed by default, expandable) -->
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
