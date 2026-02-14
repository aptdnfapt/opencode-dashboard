// Utility functions

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len - 1) + '…'
}

export function getProjectName(directory: string | null): string {
  if (!directory) return 'Unknown'
  const parts = directory.split('/')
  return parts[parts.length - 1] || directory
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// 12 visually distinct project colors — no blue/green (reserved for model/status)
const PROJECT_COLORS = [
  '#f97583',  // pink
  '#d2a8ff',  // lavender
  '#ffa657',  // orange
  '#e6b450',  // gold
  '#ff7b72',  // coral
  '#c4a5de',  // soft purple
  '#f0883e',  // burnt orange
  '#e8c46c',  // warm yellow
  '#db7093',  // pale violet red
  '#d4976c',  // tan
  '#c9879f',  // muted rose
  '#b8a9c9',  // grey purple
]

// Assigns unique colors per project directory — no overlaps
// Uses array length + identity check instead of .join('|') string comparison
const colorCache = new Map<string, string>()
let lastDirRef: string[] | null = null

export function getProjectColor(directory: string | null, allDirectories: string[]): string {
  if (!directory) return 'var(--fg-secondary)'
  
  // Rebuild cache only when the array reference or length changes
  if (allDirectories !== lastDirRef || colorCache.size === 0) {
    colorCache.clear()
    const sorted = [...new Set(allDirectories)].sort()
    sorted.forEach((dir, i) => {
      colorCache.set(dir, PROJECT_COLORS[i % PROJECT_COLORS.length])
    })
    lastDirRef = allDirectories
  }
  
  return colorCache.get(directory) ?? 'var(--fg-secondary)'
}
