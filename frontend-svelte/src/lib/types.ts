// Core data types for OpenCode Dashboard

export interface Session {
  id: string
  title: string
  hostname: string
  directory: string | null
  parent_session_id: string | null
  status: 'active' | 'idle' | 'error' | 'stale'
  created_at: number
  updated_at: number
  needs_attention: number
  token_total: number
  cost_total: number
}

export interface TimelineEvent {
  id: number
  session_id: string
  timestamp: number
  event_type: 'tool' | 'message' | 'user' | 'error' | 'permission'
  summary: string
  tool_name: string | null
  provider_id: string | null
  model_id: string | null
}

export interface Project {
  directory: string
  session_count: number
  total_tokens: number
  total_cost: number
  last_activity: number
  active_count: number
}

export interface TokenUsage {
  model_id: string
  total_tokens: number
  total_cost: number
}

export interface DailyStats {
  date: string
  tokens: number
  cost: number
  requests: number
}

// /api/analytics/daily response
export interface DailyUsage {
  date: string
  total_tokens: number
  total_cost: number
}

// /api/analytics/usage response
export interface UsagePeriod {
  period: string
  total: number
  models: Record<string, number>
}

// /api/analytics/trend response
export interface TrendData {
  date: string
  total_tokens: number
  total_cost: number
}

// /api/analytics/hosts response
export interface HostStats {
  hostname: string
  session_count: number
  total_tokens: number
  total_cost: number
}

// /api/analytics/host-usage response
export interface HostUsagePeriod {
  period: string
  total: number
  hosts: Record<string, number>
}

// /api/instances response
export interface Instance {
  id: number
  hostname: string
  ip_address: string | null
  location: string | null
  provider: string | null
  created_at: number
}

// /api/analytics/summary-extended response
export interface SummaryExtended {
  total_requests: number
  total_input: number
  total_output: number
  total_tokens: number
  total_cost: number
}

// /api/analytics/model-performance response
export interface ModelPerformancePeriod {
  period: string
  models: Record<string, number>
}

// /api/analytics/by-project response
export interface ProjectAnalytics {
  directory: string
  sessions: number
  tokens: number
  cost: number
}

// /api/analytics/file-stats response
export interface FileStats {
  extension: string
  lines_added: number
  lines_removed: number
  edit_count: number
}

// /api/analytics/cost-by-model and cost-by-agent response
export interface CostBreakdown {
  label: string
  value: number
  tokens: number
  requests: number
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface WSMessage {
  type: 'session.created' | 'session.updated' | 'timeline' | 'attention' | 'idle' | 'error' | 'auth'
  data?: Record<string, unknown>
  success?: boolean
}
