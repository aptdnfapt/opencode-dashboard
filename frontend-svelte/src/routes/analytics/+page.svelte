<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { Chart, registerables } from 'chart.js'
  import { getAnalyticsSummary, getCostTrend, getCostByModel, getCostByAgent, getHeatmap, getProjectAnalytics, getSummaryExtended, getTokensByModel, getFileStats, getResponseTimeOverTime, getTimePerModel, getTimeByProject, getModelList, getTimeHeatmap } from '$lib/api'
  import { formatTokens, formatCost } from '$lib/utils'
  import StatCard from '$lib/components/StatCard.svelte'
  import Heatmap from '$lib/components/Heatmap.svelte'
  import { store } from '$lib/store.svelte'
  import { Calendar, TrendingUp, PieChart, BarChart3, Activity, FolderKanban, Code2 } from 'lucide-svelte'
  
  // Register Chart.js components only in browser (SSR safe)
  if (browser) {
    Chart.register(...registerables)
  }
  
  // Track session count to detect changes
  let lastSessionCount = $state(0)
  
  // State
  let loading = $state(true)
  let loadingTimeAnalytics = $state(true)
  let summary = $state({ total_sessions: 0, total_tokens: 0, total_cost: 0 })
  let summaryExt = $state({ total_requests: 0, total_input: 0, total_output: 0, total_tokens: 0, total_cost: 0 })
  let costTrend = $state<{ date: string; cost: number; tokens: number }[]>([])
  let costByModel = $state<{ label: string; value: number; tokens: number }[]>([])
  let costByAgent = $state<{ label: string; value: number; tokens: number }[]>([])
  let heatmapData = $state<Record<string, number>>({})
  let timeHeatmapData = $state<Record<string, number>>({})

  let projectAnalytics = $state<{ directory: string; sessions: number; tokens: number; cost: number }[]>([])
  let tokensByModel = $state<{ label: string; value: number; cost: number; requests: number }[]>([])
  let fileStats = $state<{ extension: string; lines_added: number; lines_removed: number; edit_count: number }[]>([])
  
  // Time analytics state
  let responseTimeOverTime = $state<{ period: string; models: Record<string, number> }[]>([])
  let timePerModel = $state<{ provider_id: string; model_id: string; directory: string; total_time_ms: number; avg_time_ms: number; num_calls: number }[]>([])
  let timeByProject = $state<{ directory: string; provider_id: string; model_id: string; total_time_ms: number }[]>([])
  let availableModels = $state<string[]>([])
  let responseTimeRange = $state<'24h' | '7d' | '30d' | '90d'>('7d')
  let timeTableData = $state<{ model: string; total_time_ms: number; num_calls: number; avg_time_ms: number }[]>([])
  
  // Time range for trend chart
  let trendRange = $state<7 | 30 | 90>(30)
  
  // Chart instances (for cleanup)
  let lineChart: Chart | null = null
  let donutChart: Chart | null = null
  let barChart: Chart | null = null
  let projectChart: Chart | null = null
  let tokensDonutChart: Chart | null = null
  let fileStatsChart: Chart | null = null
  let responseTimeChart: Chart | null = null
  let timeDonutChart: Chart | null = null
  let timeProjectChart: Chart | null = null
  
  // Canvas refs
  let lineCanvas: HTMLCanvasElement | null = $state(null)
  let donutCanvas: HTMLCanvasElement | null = $state(null)
  let barCanvas: HTMLCanvasElement | null = $state(null)
  let projectCanvas: HTMLCanvasElement | null = $state(null)
  let tokensDonutCanvas: HTMLCanvasElement | null = $state(null)
  let fileStatsCanvas: HTMLCanvasElement | null = $state(null)
  let responseTimeCanvas: HTMLCanvasElement | null = $state(null)
  let timeDonutCanvas: HTMLCanvasElement | null = $state(null)
  let timeProjectCanvas: HTMLCanvasElement | null = $state(null)
  
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
  
  // Color palette for charts (expanded for more models)
  const chartColors = [
    colors.blue,
    colors.green,
    colors.amber,
    colors.purple,
    colors.red,
    colors.cyan,
    '#79c0ff',
    '#7ee787',
    '#ffa657',
    '#ff7b72',
    '#d2a8ff',
    '#56d364',
    '#e3b341',
    '#ff9bce',
    '#6e7681',
    '#8b949e'
  ]
  
  // Initialize/update line chart (cost trend)
  function renderLineChart() {
    if (!lineCanvas || costTrend.length === 0) return
    if (lineChart) lineChart.destroy()
    
    // Create gradient fill for line chart
    const ctx = lineCanvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, lineCanvas.clientHeight || 256)
    gradient.addColorStop(0, colors.green + '30')
    gradient.addColorStop(1, colors.green + '02')
    
    lineChart = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels: costTrend.map(d => d.date.slice(5)),
        datasets: [{
          label: 'Cost',
          data: costTrend.map(d => d.cost),
          borderColor: colors.green,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: colors.green,
          pointHoverBorderColor: colors.bgSecondary,
          pointHoverBorderWidth: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            // Offset tooltip above data points so they stay visible
            yAlign: 'bottom' as const,
            caretPadding: 12,
            callbacks: {
              label: (ctx) => `Cost: ${formatCost(ctx.raw as number)}`
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(240,246,252,0.06)' }, ticks: { color: colors.fgMuted, maxTicksLimit: 10, font: { size: 11 } } },
          y: { grid: { color: 'rgba(240,246,252,0.06)' }, ticks: { color: colors.fgMuted, font: { size: 11 }, callback: (v) => '$' + Number(v).toFixed(2) } }
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
          borderWidth: 2,
          hoverOffset: 8,
          hoverBorderWidth: 3,
          hoverBorderColor: '#e6edf3'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { 
            position: 'right', 
            labels: { 
              color: colors.fgSecondary, 
              padding: 16, 
              usePointStyle: true, 
              pointStyle: 'circle', 
              font: { size: 11 },
              boxWidth: 8,
              boxHeight: 8,
              // Truncate long model names — show only after last /
              filter: (item) => {
                item.text = item.text.split('/').pop() || item.text
                return true
              }
            } 
          },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
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
          maxBarThickness: 28,
          categoryPercentage: 0.8,
          hoverBackgroundColor: chartColors.slice(0, costByAgent.length).map(c => c + 'DD')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const item = costByAgent[ctx.dataIndex]
                return `${formatCost(item.value)} (${formatTokens(item.tokens)} tok)`
              }
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(240,246,252,0.06)' }, ticks: { color: colors.fgMuted, font: { size: 11 }, callback: (v) => '$' + Number(v).toFixed(2) } },
          y: { grid: { display: false }, ticks: { color: colors.fgSecondary, font: { size: 11 } } }
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
          maxBarThickness: 28,
          categoryPercentage: 0.8,
          hoverBackgroundColor: chartColors.slice(0, top5.length).map(c => c + 'DD')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
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
          x: { grid: { color: 'rgba(240,246,252,0.06)' }, ticks: { color: colors.fgMuted, font: { size: 11 }, callback: (v) => formatTokens(Number(v)) } },
          y: { grid: { display: false }, ticks: { color: colors.fgSecondary, font: { size: 11 } } }
        }
      }
    })
  }
  
  // Tokens by model donut chart
  function renderTokensDonutChart() {
    if (!tokensDonutCanvas || tokensByModel.length === 0) return
    if (tokensDonutChart) tokensDonutChart.destroy()
    
    tokensDonutChart = new Chart(tokensDonutCanvas, {
      type: 'doughnut',
      data: {
        labels: tokensByModel.map(d => d.label),
        datasets: [{
          data: tokensByModel.map(d => d.value),
          backgroundColor: chartColors.slice(0, tokensByModel.length),
          borderColor: colors.bgSecondary,
          borderWidth: 2,
          hoverOffset: 8,
          hoverBorderWidth: 3,
          hoverBorderColor: '#e6edf3'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { 
            position: 'right', 
            labels: { 
              color: colors.fgSecondary, 
              padding: 16, 
              usePointStyle: true, 
              pointStyle: 'circle', 
              font: { size: 11 },
              boxWidth: 8,
              boxHeight: 8,
              filter: (item) => {
                item.text = item.text.split('/').pop() || item.text
                return true
              }
            } 
          },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const item = tokensByModel[ctx.dataIndex]
                return `${formatTokens(item.value)} tokens (${formatCost(item.cost)})`
              }
            }
          }
        }
      }
    })
  }
  
  // File stats bar chart (horizontal stacked - added colored, removed = grayed shade of same color)
  function renderFileStatsChart() {
    if (!fileStatsCanvas || fileStats.length === 0) return
    if (fileStatsChart) fileStatsChart.destroy()
    
    const top8 = fileStats.slice(0, 8)
    
    // Different color for each language
    const langColors = top8.map((_, i) => chartColors[i % chartColors.length])
    // Grayed shade of same color (30% opacity)
    const langColorsGray = langColors.map(c => c + '4D')
    
    fileStatsChart = new Chart(fileStatsCanvas, {
      type: 'bar',
      data: {
        labels: top8.map(d => d.extension || 'unknown'),
        datasets: [
          {
            label: 'Added',
            data: top8.map(d => d.lines_added),
            backgroundColor: langColors,
            hoverBackgroundColor: langColors.map(c => c + 'DD')
          },
          {
            label: 'Removed',
            data: top8.map(d => d.lines_removed),
            backgroundColor: langColorsGray,
            hoverBackgroundColor: langColorsGray.map(c => c.slice(0, -2) + '80')
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { position: 'top', labels: { color: colors.fgSecondary, usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} lines`
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { color: 'rgba(240,246,252,0.06)' }, ticks: { color: colors.fgMuted, font: { size: 11 } } },
          y: { stacked: true, grid: { display: false }, ticks: { color: colors.fgSecondary, font: { size: 11 } } }
        }
      }
    })
  }
  
  // Response time by model over time (multi-line chart)
  function renderResponseTimeChart() {
    if (!responseTimeCanvas || responseTimeOverTime.length === 0) return
    if (responseTimeChart) responseTimeChart.destroy()
    
    const ctx = responseTimeCanvas.getContext('2d')
    if (!ctx) return
    
    // Get all unique models from the data
    const allModels = new Set<string>()
    responseTimeOverTime.forEach(period => {
      Object.keys(period.models).forEach(model => allModels.add(model))
    })
    
    // Show all models — users toggle via Chart.js legend click
    const modelsToShow = Array.from(allModels)
    
    if (modelsToShow.length === 0) return
    
    // Create datasets for each model
    const datasets = modelsToShow.map((model, index) => ({
      label: model,
      data: responseTimeOverTime.map(period => period.models[model] || 0),
      borderColor: chartColors[index % chartColors.length],
      backgroundColor: chartColors[index % chartColors.length] + '20',
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 6,
      borderWidth: 2
    }))
    
    responseTimeChart = new Chart(responseTimeCanvas, {
      type: 'line',
      data: {
        labels: responseTimeOverTime.map(d => d.period.slice(5)),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { 
            position: 'top', 
            labels: { 
              color: colors.fgSecondary, 
              padding: 16, 
              usePointStyle: true, 
              pointStyle: 'circle', 
              font: { size: 11 },
              boxWidth: 8,
              boxHeight: 8
            } 
          },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            // Offset tooltip above data points so they stay visible
            yAlign: 'bottom' as const,
            caretPadding: 12,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number / 1000).toFixed(1)}s`
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(240,246,252,0.06)' }, ticks: { color: colors.fgMuted, maxTicksLimit: 10, font: { size: 11 } } },
          y: { 
            grid: { color: 'rgba(240,246,252,0.06)' }, 
            ticks: { color: colors.fgMuted, font: { size: 11 }, callback: (v) => `${(v as number / 1000).toFixed(0)}s` },
            title: { display: true, text: 'Seconds', color: colors.fgMuted, font: { size: 11 } }
          }
        }
      }
    })
  }
  
  // Time spent by model (donut + table)
  function renderTimeDonutChart() {
    if (!timeDonutCanvas || timePerModel.length === 0) return
    if (timeDonutChart) timeDonutChart.destroy()
    
    // Group by model and sum total time
    const modelTimeMap = new Map<string, number>()
    const modelCallMap = new Map<string, number>()
    
    timePerModel.forEach(item => {
      const key = `${item.provider_id}/${item.model_id}`
      const currentTotal = modelTimeMap.get(key) || 0
      const currentCalls = modelCallMap.get(key) || 0
      
      modelTimeMap.set(key, currentTotal + item.total_time_ms)
      modelCallMap.set(key, currentCalls + item.num_calls)
    })
    
    // Convert to array and sort by total time, calculate average properly
    const modelData = Array.from(modelTimeMap.entries())
      .map(([model, total_time_ms]) => { 
        const num_calls = modelCallMap.get(model) || 0
        return { 
          model, 
          total_time_ms,
          num_calls,
          avg_time_ms: num_calls > 0 ? Math.round(total_time_ms / num_calls) : 0
        }
      })
      .sort((a, b) => b.total_time_ms - a.total_time_ms)
    
    // Take top 8 models
    const topModels = modelData.slice(0, 8)
    
    timeDonutChart = new Chart(timeDonutCanvas, {
      type: 'doughnut',
      data: {
        labels: topModels.map(d => d.model),
        datasets: [{
          data: topModels.map(d => d.total_time_ms),
          backgroundColor: chartColors.slice(0, topModels.length),
          borderColor: colors.bgSecondary,
          borderWidth: 2,
          hoverOffset: 8,
          hoverBorderWidth: 3,
          hoverBorderColor: '#e6edf3'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          // Hide Chart.js legend — the data table next to the donut serves as the legend
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const item = topModels[ctx.dataIndex]
                const hours = Math.floor(item.total_time_ms / 3600000)
                const minutes = Math.floor((item.total_time_ms % 3600000) / 60000)
                return `${hours}h ${minutes}m`
              }
            }
          }
        }
      }
    })
    
    // Store the table data for rendering
    timeTableData = topModels
  }
  
  // Time by project (stacked bar)
  function renderTimeProjectChart() {
    if (!timeProjectCanvas || timeByProject.length === 0) return
    if (timeProjectChart) timeProjectChart.destroy()
    
    // Group by directory and model
    const projectMap = new Map<string, Map<string, number>>()
    timeByProject.forEach(item => {
      if (!projectMap.has(item.directory)) {
        projectMap.set(item.directory, new Map())
      }
      const modelMap = projectMap.get(item.directory)!
      const key = `${item.provider_id}/${item.model_id}`
      const current = modelMap.get(key) || 0
      modelMap.set(key, current + item.total_time_ms)
    })
    
    // Convert to array and sort by total time
    const projects = Array.from(projectMap.entries())
      .map(([directory, modelMap]) => {
        const total = Array.from(modelMap.values()).reduce((a, b) => a + b, 0)
        return { directory, modelMap, total }
      })
      .sort((a, b) => b.total - a.total)
    
    // Take top 5 projects
    const topProjects = projects.slice(0, 5)
    
    // Get all unique models across top projects
    const allModels = new Set<string>()
    topProjects.forEach(project => {
      project.modelMap.forEach((_, model) => allModels.add(model))
    })
    
    // Create datasets for each model
    const datasets = Array.from(allModels).map((model, index) => ({
      label: model,
      data: topProjects.map(project => project.modelMap.get(model) || 0),
      backgroundColor: chartColors[index % chartColors.length],
      hoverBackgroundColor: chartColors[index % chartColors.length] + 'DD',
      borderWidth: 0
    }))
    
    timeProjectChart = new Chart(timeProjectCanvas, {
      type: 'bar',
      data: {
        labels: topProjects.map(p => {
          const totalHours = Math.floor(p.total / 3600000)
          const name = p.directory.split('/').pop() || p.directory
          return `${name} (${totalHours}h)`
        }),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { 
            position: 'right',
            align: 'start',
            labels: { 
              color: colors.fgSecondary, 
              usePointStyle: true, 
              pointStyle: 'circle', 
              padding: 12, 
              font: { size: 10 },
              boxWidth: 10,
              boxHeight: 10
            } 
          },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor: colors.fgPrimary,
            bodyColor: colors.fgSecondary,
            borderColor: 'rgba(240,246,252,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            callbacks: {
              title: (ctx) => topProjects[ctx[0].dataIndex].directory,
              label: (ctx) => {
                const item = topProjects[ctx.dataIndex]
                const model = ctx.dataset.label as string
                const timeMs = item.modelMap.get(model) || 0
                const hours = Math.floor(timeMs / 3600000)
                const minutes = Math.floor((timeMs % 3600000) / 60000)
                return `${model}: ${hours}h ${minutes}m`
              }
            }
          }
        },
        scales: {
          x: { 
            stacked: true, 
            grid: { color: 'rgba(240,246,252,0.06)' }, 
            ticks: { 
              color: colors.fgMuted, 
              font: { size: 11 },
              callback: (v) => {
                const value = v as number
                const hours = Math.floor(value / 3600000)
                const minutes = Math.floor((value % 3600000) / 60000)
                return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
              }
            } 
          },
          y: { 
            stacked: true, 
            grid: { display: false }, 
            ticks: { color: colors.fgSecondary, font: { size: 11 } } 
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
  

  
  // Load response time over time
  async function loadResponseTime(range: '24h' | '7d' | '30d' | '90d') {
    responseTimeRange = range
    try {
      responseTimeOverTime = await getResponseTimeOverTime(range)
      renderResponseTimeChart()
    } catch (err) {
      console.error('Failed to load response time:', err)
    }
  }
  
  // Load time per model
  async function loadTimePerModel() {
    try {
      timePerModel = await getTimePerModel()
      renderTimeDonutChart()
    } catch (err) {
      console.error('Failed to load time per model:', err)
    }
  }
  
  // Load time by project
  async function loadTimeByProject() {
    try {
      timeByProject = await getTimeByProject()
      renderTimeProjectChart()
    } catch (err) {
      console.error('Failed to load time by project:', err)
    }
  }
  
  // Load available models for filter
  async function loadAvailableModels() {
    try {
      availableModels = await getModelList()
    } catch (err) {
      console.error('Failed to load available models:', err)
    }
  }
  
  
  // Format duration in hours/minutes
  function formatDuration(ms: number): string {
    if (ms >= 3600000) {
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      return `${h}h ${m}m`
    }
    return `${Math.floor(ms / 60000)}m`
  }
  
  // Format duration short (minutes/seconds)
  function formatDurationShort(ms: number): string {
    if (ms >= 60000) {
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      return `${m}m ${s}s`
    }
    return `${Math.floor(ms / 1000)}s`
  }
  
  // Initial data load
  onMount(async () => {
    try {
      const [s, sExt, trend, models, agents, heatmap, projects, tokensModels, files, responseTime, timePerModelData, timeByProjectData, modelList, timeHeatmapRaw] = await Promise.all([
        getAnalyticsSummary(),
        getSummaryExtended(),
        getCostTrend(trendRange),
        getCostByModel(),
        getCostByAgent(),
        getHeatmap(365),
        getProjectAnalytics('30d'),
        getTokensByModel(),
        getFileStats(),
        getResponseTimeOverTime(responseTimeRange),
        getTimePerModel(),
        getTimeByProject(),
        getModelList(),
        getTimeHeatmap(365)
      ])
      summary = s
      summaryExt = sExt
      costTrend = trend
      costByModel = models
      costByAgent = agents
      // Convert heatmap array to Record<string, number> (using tokens instead of requests)
      heatmapData = heatmap.reduce((acc: Record<string, number>, d: { date: string; tokens: number }) => {
        acc[d.date] = d.tokens
        return acc
      }, {} as Record<string, number>)
      // Convert time heatmap array to Record<string, number> (duration_ms per day)
      timeHeatmapData = timeHeatmapRaw.reduce((acc: Record<string, number>, d: { date: string; duration_ms: number }) => {
        acc[d.date] = d.duration_ms
        return acc
      }, {} as Record<string, number>)
      projectAnalytics = projects
      tokensByModel = tokensModels
      fileStats = files
      responseTimeOverTime = responseTime
      timePerModel = timePerModelData
      timeByProject = timeByProjectData
      availableModels = modelList
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      loading = false
      loadingTimeAnalytics = false
    }
  })
  
  // Render charts after data loads
  $effect(() => {
    if (!loading && costTrend.length > 0) {
      setTimeout(() => {
        renderLineChart()
        renderDonutChart()
        renderBarChart()
        renderProjectChart()
        renderTokensDonutChart()
        renderFileStatsChart()
        // Render time analytics charts
        if (responseTimeOverTime.length > 0) {
          renderResponseTimeChart()
        }
        if (timePerModel.length > 0) {
          renderTimeDonutChart()
        }
        if (timeByProject.length > 0) {
          renderTimeProjectChart()
        }
      }, 0)
    }
  })
  
  // Cleanup charts on component unmount
  onDestroy(() => {
    if (lineChart) lineChart.destroy()
    if (donutChart) donutChart.destroy()
    if (barChart) barChart.destroy()
    if (projectChart) projectChart.destroy()
    if (tokensDonutChart) tokensDonutChart.destroy()
    if (fileStatsChart) fileStatsChart.destroy()
    if (responseTimeChart) responseTimeChart.destroy()
    if (timeDonutChart) timeDonutChart.destroy()
    if (timeProjectChart) timeProjectChart.destroy()
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
    <!-- Skeleton loading state -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
      {#each Array(6) as _}
        <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 h-20 animate-pulse"></div>
      {/each}
    </div>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-8 h-40 animate-pulse"></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {#each Array(4) as _}
        <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 h-72 animate-pulse"></div>
      {/each}
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

      <!-- Tokens by Model - Donut Chart -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
        <div class="flex items-center gap-2 mb-4">
          <PieChart size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Tokens by Model</h2>
        </div>
        {#if tokensByModel.length === 0}
          <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
        {:else}
          <div class="h-64">
            <canvas bind:this={tokensDonutCanvas}></canvas>
          </div>
        {/if}
      </div>
    </div>

    <!-- Second row of charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Cost by Agent - Bar Chart -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
        <div class="flex items-center gap-2 mb-4">
          <BarChart3 size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Cost by Agent</h2>
        </div>
        {#if costByAgent.length === 0}
          <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
        {:else}
          <!-- Dynamic height: 40px per agent, min 160px -->
          <div style="height: {Math.max(160, costByAgent.length * 40)}px">
            <canvas bind:this={barCanvas}></canvas>
          </div>
        {/if}
      </div>

      <!-- File Stats by Language - Bar Chart -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
        <div class="flex items-center gap-2 mb-4">
          <Code2 size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Lines by Language</h2>
        </div>
        {#if fileStats.length === 0}
          <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
        {:else}
          <div class="h-64">
            <canvas bind:this={fileStatsCanvas}></canvas>
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
        <div class="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
          {#each [7, 30, 90] as days}
            <button
              onclick={() => loadTrend(days as 7 | 30 | 90)}
              class="px-3 py-1.5 text-xs font-medium transition-colors {trendRange === days 
                ? 'bg-[var(--accent-blue)] text-white' 
                : 'bg-[var(--bg-tertiary)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]'}"
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

    <!-- Time Analytics Section -->
    <div class="border-t border-[var(--border-subtle)] my-8"></div>
    <div class="mt-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="p-2 rounded-lg bg-[var(--bg-tertiary)]">
          <svg class="w-5 h-5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div>
          <h2 class="text-lg font-semibold text-[var(--fg-primary)]">Time Analytics</h2>
          <p class="text-sm text-[var(--fg-muted)]">Response times and cumulative LLM usage</p>
        </div>
      </div>
      
      <!-- Time Spent Heatmap (blue calendar) -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-8">
        <div class="flex items-center gap-2 mb-4">
          <Calendar size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Time Spent</h2>
          <span class="text-xs text-[var(--fg-muted)]">Last 365 days</span>
        </div>
        <div class="overflow-x-auto">
          <Heatmap data={timeHeatmapData} days={365} colorScheme="blue" formatLabel={(ms) => {
            if (ms >= 3600000) {
              const h = Math.floor(ms / 3600000)
              const m = Math.floor((ms % 3600000) / 60000)
              return `${h}h ${m}m`
            }
            if (ms >= 60000) return `${Math.floor(ms / 60000)}m`
            if (ms >= 1000) return `${Math.floor(ms / 1000)}s`
            return `${ms}ms`
          }} />
        </div>
      </div>

      <!-- Chart 1: Response Time by Model Over Time -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-8">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <TrendingUp size={16} class="text-[var(--fg-muted)]" />
            <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Response Time by Model</h2>
          </div>
          <div class="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
              {#each ['24h', '7d', '30d', '90d'] as range}
                <button
                  onclick={() => loadResponseTime(range as '24h' | '7d' | '30d' | '90d')}
                  class="px-3 py-1.5 text-xs font-medium transition-colors {responseTimeRange === range 
                    ? 'bg-[var(--accent-blue)] text-white' 
                    : 'bg-[var(--bg-tertiary)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]'}"
                  aria-label="Show data for last {range}"
                  aria-pressed={responseTimeRange === range}
                >
                  {range}
                </button>
              {/each}
            </div>
        </div>
        {#if loadingTimeAnalytics}
          <div class="h-64 flex flex-col items-center justify-center gap-3">
            <div class="w-8 h-8 border-2 border-[var(--border-subtle)] border-t-[var(--accent-blue)] rounded-full animate-spin"></div>
            <span class="text-sm text-[var(--fg-muted)]">Loading time analytics...</span>
          </div>
        {:else if responseTimeOverTime.length === 0}
          <div class="h-64 flex flex-col items-center justify-center gap-3 text-[var(--fg-muted)]">
            <svg class="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p>No time data available yet</p>
            <p class="text-xs">Complete a few LLM requests to see analytics</p>
          </div>
        {:else}
          <div class="h-64">
            <canvas bind:this={responseTimeCanvas}></canvas>
          </div>
        {/if}
      </div>

      <!-- Chart 2: Time Spent by Model (donut + table) -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-8">
        <div class="flex items-center gap-2 mb-4">
          <PieChart size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Time Spent by Model</h2>
        </div>
        {#if loadingTimeAnalytics}
          <div class="h-64 flex flex-col items-center justify-center gap-3">
            <div class="w-8 h-8 border-2 border-[var(--border-subtle)] border-t-[var(--accent-blue)] rounded-full animate-spin"></div>
            <span class="text-sm text-[var(--fg-muted)]">Loading time analytics...</span>
          </div>
        {:else if timePerModel.length === 0}
          <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
        {:else}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Donut chart -->
            <div class="h-64">
              <canvas bind:this={timeDonutCanvas}></canvas>
            </div>
            <!-- Data table with progress bars -->
            <div class="bg-[var(--bg-tertiary)] rounded-lg overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--border-subtle)]">
                    <th class="text-left px-4 py-3 text-[var(--fg-muted)] font-medium w-[40%]">Model</th>
                    <th class="text-right px-4 py-3 text-[var(--fg-muted)] font-medium">Total</th>
                    <th class="text-right px-4 py-3 text-[var(--fg-muted)] font-medium">Calls</th>
                    <th class="text-right px-4 py-3 text-[var(--fg-muted)] font-medium">Avg</th>
                    <th class="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each timeTableData as row, i}
                    {@const totalTime = timeTableData.reduce((sum, r) => sum + r.total_time_ms, 0)}
                    {@const percent = totalTime > 0 ? (row.total_time_ms / totalTime) * 100 : 0}
                    <tr class="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <span 
                            class="w-3 h-3 rounded-full flex-shrink-0" 
                            style="background-color: {chartColors[i % chartColors.length]}"
                          ></span>
                          <span class="mono text-[var(--fg-primary)] truncate" title={row.model}>
                            {row.model.split('/').pop()}
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-3 mono text-right text-[var(--fg-secondary)]">
                        {formatDuration(row.total_time_ms)}
                      </td>
                      <td class="px-4 py-3 mono text-right text-[var(--fg-muted)]">
                        {row.num_calls.toLocaleString()}
                      </td>
                      <td class="px-4 py-3 mono text-right text-[var(--fg-muted)]">
                        {formatDurationShort(row.avg_time_ms)}
                      </td>
                      <td class="px-4 py-3">
                        <div class="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                          <div 
                            class="h-full rounded-full transition-all duration-500"
                            style="background-color: {chartColors[i % chartColors.length]}; width: {percent}%"
                          ></div>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>

      <!-- Chart 3: Time by Project (stacked bar) -->
      <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-8">
        <div class="flex items-center gap-2 mb-4">
          <BarChart3 size={16} class="text-[var(--fg-muted)]" />
          <h2 class="text-sm font-medium text-[var(--fg-secondary)] uppercase tracking-wide">Time by Project</h2>
        </div>
        {#if loadingTimeAnalytics}
          <div class="h-64 flex flex-col items-center justify-center gap-3">
            <div class="w-8 h-8 border-2 border-[var(--border-subtle)] border-t-[var(--accent-blue)] rounded-full animate-spin"></div>
            <span class="text-sm text-[var(--fg-muted)]">Loading time analytics...</span>
          </div>
        {:else if timeByProject.length === 0}
          <div class="h-64 flex items-center justify-center text-[var(--fg-muted)]">No data</div>
        {:else}
          <div class="h-64">
            <canvas bind:this={timeProjectCanvas}></canvas>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
