// API client for backend communication

import type { 
  Session, TimelineEvent, Project, TokenUsage, DailyStats,
  DailyUsage, UsagePeriod, TrendData, HostStats, HostUsagePeriod,
  Instance, SummaryExtended, ModelPerformancePeriod, ProjectAnalytics,
  FileStats, CostBreakdown
} from './types'

// Get API key from localStorage (set at login) — no build-time baking
function getApiKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('dashboard_password') || ''
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const key = getApiKey()
  const res = await fetch(endpoint, {
    headers: key ? { 'X-API-Key': key } : {}
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Sessions
export async function getSessions(params?: {
  status?: string
  hostname?: string
  directory?: string
  search?: string
}): Promise<Session[]> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.hostname) query.set('hostname', params.hostname)
  if (params?.directory) query.set('directory', params.directory)
  if (params?.search) query.set('search', params.search)
  
  const qs = query.toString()
  return fetchAPI(`/api/sessions${qs ? `?${qs}` : ''}`)
}

export async function getSession(id: string): Promise<{ session: Session; timeline: TimelineEvent[] }> {
  return fetchAPI(`/api/sessions/${id}`)
}

// Projects
export async function getProjects(): Promise<Project[]> {
  return fetchAPI('/api/projects')
}

// Analytics
export async function getAnalyticsSummary(): Promise<{
  total_sessions: number
  total_tokens: number
  total_cost: number
}> {
  return fetchAPI('/api/analytics/summary')
}

export async function getModelUsage(): Promise<TokenUsage[]> {
  return fetchAPI('/api/analytics/models')
}

export async function getCostTrend(days = 30): Promise<DailyStats[]> {
  return fetchAPI(`/api/analytics/cost-trend?days=${days}`)
}

export async function getHeatmap(days = 365): Promise<DailyStats[]> {
  return fetchAPI(`/api/analytics/heatmap?days=${days}`)
}

export async function getCostByModel(): Promise<CostBreakdown[]> {
  return fetchAPI('/api/analytics/cost-by-model')
}

export async function getTokensByModel(): Promise<{ label: string; value: number; cost: number; requests: number }[]> {
  return fetchAPI('/api/analytics/tokens-by-model')
}

export async function getCostByAgent(): Promise<CostBreakdown[]> {
  return fetchAPI('/api/analytics/cost-by-agent')
}

export async function getTokenFlow(range = '7d'): Promise<{ period: string; input: number; output: number }[]> {
  return fetchAPI(`/api/analytics/token-flow?range=${range}`)
}

// Daily usage for calendar
export async function getDailyUsage(): Promise<DailyUsage[]> {
  return fetchAPI('/api/analytics/daily')
}

// Token usage by period with model breakdown
export async function getUsage(range = '7d'): Promise<UsagePeriod[]> {
  return fetchAPI(`/api/analytics/usage?range=${range}`)
}

// Daily token trend for line chart
export async function getTrend(days = 90): Promise<TrendData[]> {
  return fetchAPI(`/api/analytics/trend?days=${days}`)
}

// Host summary stats
export async function getHosts(): Promise<HostStats[]> {
  return fetchAPI('/api/analytics/hosts')
}

// Token usage by period with host breakdown
export async function getHostUsage(range = '7d'): Promise<HostUsagePeriod[]> {
  return fetchAPI(`/api/analytics/host-usage?range=${range}`)
}

// VPS instances
export async function getInstances(): Promise<Instance[]> {
  return fetchAPI('/api/instances')
}

// Extended summary with input/output breakdown
export async function getSummaryExtended(): Promise<SummaryExtended> {
  return fetchAPI('/api/analytics/summary-extended')
}

// Model performance (avg duration) over time
export async function getModelPerformance(range = '7d', models?: string[]): Promise<ModelPerformancePeriod[]> {
  const params = new URLSearchParams({ range })
  if (models?.length) params.set('models', models.join(','))
  return fetchAPI(`/api/analytics/model-performance?${params}`)
}

// List of models with duration data
export async function getModelList(): Promise<string[]> {
  return fetchAPI('/api/analytics/model-list')
}

// Project-level analytics with time range
export async function getProjectAnalytics(range = '7d'): Promise<ProjectAnalytics[]> {
  return fetchAPI(`/api/analytics/by-project?range=${range}`)
}

// File edit stats by extension
export async function getFileStats(): Promise<FileStats[]> {
  return fetchAPI('/api/analytics/file-stats')
}

// Health check
export async function getHealth(): Promise<{ status: string; clients: number }> {
  return fetchAPI('/health')
}

// Archive/unarchive session
export async function archiveSession(id: string): Promise<{ success: boolean }> {
  const key = getApiKey()
  const res = await fetch(`/api/sessions/${id}/archive`, {
    method: 'PATCH',
    headers: key ? { 'X-API-Key': key } : {}
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function unarchiveSession(id: string): Promise<{ success: boolean }> {
  const key = getApiKey()
  const res = await fetch(`/api/sessions/${id}/unarchive`, {
    method: 'PATCH',
    headers: key ? { 'X-API-Key': key } : {}
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Dismiss attention (clear yellow blink)
export async function dismissSession(id: string): Promise<{ success: boolean }> {
  const key = getApiKey()
  const res = await fetch(`/api/sessions/${id}/dismiss`, {
    method: 'PATCH',
    headers: key ? { 'X-API-Key': key } : {}
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Permanently delete session and all related data
export async function deleteSession(id: string): Promise<{ success: boolean }> {
  const key = getApiKey()
  const res = await fetch(`/api/sessions/${id}`, {
    method: 'DELETE',
    headers: key ? { 'X-API-Key': key } : {}
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Time analytics endpoints
export async function getTimePerModel(): Promise<{
  provider_id: string
  model_id: string
  directory: string
  total_time_ms: number
  avg_time_ms: number
  num_calls: number
}[]> {
  return fetchAPI('/api/analytics/time-per-model')
}

export async function getResponseTimeOverTime(range = '7d', models?: string[]): Promise<{
  period: string
  models: Record<string, number>
}[]> {
  const params = new URLSearchParams({ range })
  if (models?.length) params.set('models', models.join(','))
  return fetchAPI(`/api/analytics/response-time-over-time?${params}`)
}

// Daily duration sums for time-spent heatmap calendar
export async function getTimeHeatmap(days = 365): Promise<{ date: string; duration_ms: number }[]> {
  return fetchAPI(`/api/analytics/time-heatmap?days=${days}`)
}

export async function getTimeByProject(): Promise<{
  directory: string
  provider_id: string
  model_id: string
  total_time_ms: number
}[]> {
  return fetchAPI('/api/analytics/time-by-project')
}
