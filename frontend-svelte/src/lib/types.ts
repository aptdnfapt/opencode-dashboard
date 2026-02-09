// Core data types for OpenCode Dashboard

export interface Session {
  id: string
  title: string
  hostname: string
  directory: string | null
  parent_session_id: string | null
  status: 'active' | 'idle' | 'error' | 'stale' | 'archived'
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

// WebSocket message data types for discriminated union
export interface TimelineWSData {
  id: number
  sessionId: string
  timestamp: number
  eventType: string
  summary: string
  toolName: string | null
  providerId: string | null
  modelId: string | null
}

export interface SessionCreatedWSData {
  id: string
  title: string
  hostname: string
  directory?: string | null
  parent_session_id?: string | null
  status?: 'active' | 'idle' | 'error' | 'stale' | 'archived'
  created_at?: number
  updated_at?: number
  needs_attention?: number
  token_total?: number
  cost_total?: number
}

export interface SessionUpdatedWSData {
  id: string
  title?: string
  hostname?: string
  directory?: string | null
  status?: 'active' | 'idle' | 'error' | 'stale'
  updated_at?: number
  needs_attention?: number
  token_total?: number
  cost_total?: number
}

export interface AttentionWSData {
  sessionId: string
  needsAttention: boolean
  title?: string
  audioUrl?: string
  isSubagent?: boolean
}

export interface IdleWSData {
  sessionId: string
  title?: string
  audioUrl?: string
  isSubagent?: boolean
}

export interface ErrorWSData {
  sessionId: string
  message?: string
}

export interface AuthWSData {
  success: boolean
}

// Discriminated union for all WebSocket messages
export type WSMessage =
  | { type: 'session.created'; data: SessionCreatedWSData }
  | { type: 'session.updated'; data: SessionUpdatedWSData }
  | { type: 'timeline'; data: TimelineWSData }
  | { type: 'attention'; data: AttentionWSData }
  | { type: 'idle'; data: IdleWSData }
  | { type: 'error'; data: ErrorWSData }
  | { type: 'auth'; success: boolean }

// Type guards for runtime validation
export function isTimelineWSData(data: unknown): data is TimelineWSData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    typeof d.id === 'number' &&
    typeof d.sessionId === 'string' &&
    typeof d.timestamp === 'number' &&
    typeof d.eventType === 'string' &&
    typeof d.summary === 'string' &&
    (d.toolName === null || typeof d.toolName === 'string')
  )
}

export function isSessionCreatedWSData(data: unknown): data is SessionCreatedWSData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    typeof d.id === 'string' &&
    typeof d.title === 'string' &&
    typeof d.hostname === 'string'
  )
}

export function isSessionUpdatedWSData(data: unknown): data is SessionUpdatedWSData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return typeof d.id === 'string'
}

export function isAttentionWSData(data: unknown): data is AttentionWSData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return typeof d.sessionId === 'string' && typeof d.needsAttention === 'boolean'
}

export function isIdleWSData(data: unknown): data is IdleWSData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return typeof d.sessionId === 'string'
}

export function isErrorWSData(data: unknown): data is ErrorWSData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return typeof d.sessionId === 'string'
}

export function isAuthMessage(msg: unknown): msg is { type: 'auth'; success: boolean } {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as Record<string, unknown>
  return m.type === 'auth' && typeof m.success === 'boolean'
}
