<script lang="ts">
  import { formatTokens } from '$lib/utils'
  
  interface Props {
    data: Record<string, number>
    days?: number
    /** 'green' = token activity (default), 'blue' = time spent */
    colorScheme?: 'green' | 'blue'
    /** Custom tooltip label — defaults to formatTokens + "tokens" */
    formatLabel?: (value: number) => string
  }
  
  let { data, days = 365, colorScheme = 'green', formatLabel }: Props = $props()
  
  // Color schemes: empty cell → lightest → darkest
  const schemes: Record<string, string[]> = {
    green: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
    blue:  ['#161b22', '#0c2d6b', '#0550ae', '#388bfd', '#58a6ff']
  }
  
  let colors = $derived(schemes[colorScheme] || schemes.green)
  
  // Container width for responsive scaling
  let containerWidth = $state(0)
  
  const cellSize = 14
  const cellGap = 4
  const weekdayLabelWidth = 32
  const monthLabelHeight = 20
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const weekdayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']
  
  // Find max for scaling
  let maxValue = $derived(Math.max(1, ...Object.values(data)))
  
  // Color index: 0=none, 1-4 based on quartile
  function getColorIndex(value: number): number {
    if (value === 0) return 0
    const ratio = value / maxValue
    if (ratio < 0.25) return 1
    if (ratio < 0.5) return 2
    if (ratio < 0.75) return 3
    return 4
  }
  
  // Generate grid cells
  let grid = $derived.by(() => {
    const cells: { date: string; x: number; y: number; value: number; color: string }[] = []
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - days + 1)
    start.setDate(start.getDate() - start.getDay()) // Align to Sunday
    
    let current = new Date(start)
    let week = 0
    
    while (current <= today) {
      const dow = current.getDay()
      const dateStr = current.toISOString().split('T')[0]
      const value = data[dateStr] || 0
      
      cells.push({
        date: dateStr,
        x: weekdayLabelWidth + week * (cellSize + cellGap),
        y: monthLabelHeight + dow * (cellSize + cellGap),
        value,
        color: colors[getColorIndex(value)]
      })
      
      current.setDate(current.getDate() + 1)
      if (current.getDay() === 0) week++
    }
    return cells
  })
  
  // Month labels
  let monthLabels = $derived.by(() => {
    const labels: { month: string; x: number }[] = []
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - days + 1)
    start.setDate(start.getDate() - start.getDay())
    
    let current = new Date(start)
    let week = 0
    let lastMonth = -1
    
    while (current <= today) {
      const month = current.getMonth()
      if (month !== lastMonth && current.getDate() <= 7) {
        labels.push({ month: monthNames[month], x: weekdayLabelWidth + week * (cellSize + cellGap) })
        lastMonth = month
      }
      current.setDate(current.getDate() + 7)
      week++
    }
    return labels
  })
  
  // Dimensions
  let weeks = $derived(Math.ceil(days / 7) + 1)
  let width = $derived(weekdayLabelWidth + weeks * (cellSize + cellGap))
  let height = $derived(monthLabelHeight + 7 * (cellSize + cellGap))
  
  // Tooltip state — uses page coordinates (not affected by CSS transform)
  let tooltip = $state<{ x: number; y: number; date: string; value: number } | null>(null)
  
  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  
  /** Default label: "22.8M tokens" */
  function defaultFormatLabel(value: number): string {
    return `${formatTokens(value)} ${value === 1 ? 'token' : 'tokens'}`
  }
  
  function showTooltip(cell: typeof grid[0], e: MouseEvent) {
    // Use pageX/pageY — these work regardless of CSS transforms
    tooltip = { 
      x: e.pageX, 
      y: e.pageY - 10, 
      date: cell.date, 
      value: cell.value 
    }
  }
  
  function hideTooltip() {
    tooltip = null
  }
</script>

<!-- Tooltip rendered OUTSIDE the scaled container so position:absolute works correctly -->
{#if tooltip}
  <div
    class="fixed z-[9999] px-2.5 py-1.5 text-xs rounded-md bg-[#1c2128] border border-[var(--border-subtle)] shadow-xl pointer-events-none"
    style="left: {tooltip.x}px; top: {tooltip.y}px; transform: translate(-50%, -100%)"
  >
    <div class="font-medium text-[var(--fg-primary)]">{(formatLabel || defaultFormatLabel)(tooltip.value)}</div>
    <div class="text-[var(--fg-muted)]">{formatDate(tooltip.date)}</div>
  </div>
{/if}

<div class="relative w-full" bind:clientWidth={containerWidth}>
  {#if containerWidth > 0}
    {@const scale = Math.min(1, containerWidth / width)}
    <div style="transform: scale({scale}); transform-origin: top left; height: {height * scale}px;">
      <svg {width} {height} class="overflow-visible">
        <!-- Month labels -->
        {#each monthLabels as label}
          <text x={label.x} y={12} class="fill-[var(--fg-muted)] text-[10px]">{label.month}</text>
        {/each}
        
        <!-- Weekday labels -->
        {#each weekdayLabels as label, i}
          {#if label}
            <text x={0} y={monthLabelHeight + i * (cellSize + cellGap) + cellSize - 2} class="fill-[var(--fg-muted)] text-[10px]">{label}</text>
          {/if}
        {/each}
        
        <!-- Cells -->
        {#each grid as cell}
          <rect
            x={cell.x}
            y={cell.y}
            width={cellSize}
            height={cellSize}
            rx={2}
            fill={cell.color}
            stroke="#30363d"
            stroke-opacity="0.4"
            stroke-width="1"
            class="transition-opacity hover:opacity-80 cursor-pointer"
            onmouseenter={(e) => showTooltip(cell, e)}
            onmousemove={(e) => showTooltip(cell, e)}
            onmouseleave={hideTooltip}
          />
        {/each}
      </svg>
    </div>
    
    <!-- Legend -->
    <div class="flex items-center gap-1.5 mt-2 text-[10px] text-[var(--fg-muted)]">
      <span>Less</span>
      {#each colors as color}
        <div class="w-[11px] h-[11px] rounded-sm" style="background-color: {color}"></div>
      {/each}
      <span>More</span>
    </div>
  {/if}
</div>
