// Svelte 5 runes-based state management

import type { Session, TimelineEvent, ConnectionStatus } from './types'

// Limit timeline events to prevent unbounded growth
const MAX_TIMELINE_EVENTS = 1000

// Global reactive state using Svelte 5 runes
class DashboardStore {
  // Sessions state
  sessions = $state<Session[]>([])
  selectedSessionId = $state<string | null>(null)
  
  // Timeline per session (Map for efficient lookup)
  timelines = $state<Map<string, TimelineEvent[]>>(new Map())
  
  // Connection state
  connectionStatus = $state<ConnectionStatus>('disconnected')
  
  // Settings
  sortActiveFirst = $state(true)
  
  // Filters
  filters = $state({
    status: '',
    hostname: '',
    directory: '',
    search: ''
  })

  // Derived: selected session
  get selectedSession() {
    return this.sessions.find(s => s.id === this.selectedSessionId) ?? null
  }

  // Derived: filtered sessions (handles computed 'stale' status + sorting)
  get filteredSessions() {
    const STALE_THRESHOLD_MS = 3 * 60 * 1000
    const now = Date.now()
    
    const filtered = this.sessions.filter(s => {
      // Compute effective status: idle > 3min = stale
      let effectiveStatus = s.status
      if (s.status === 'idle') {
        const idleTime = now - new Date(s.updated_at).getTime()
        effectiveStatus = idleTime > STALE_THRESHOLD_MS ? 'stale' : 'idle'
      }
      
      // Hide archived unless explicitly filtered for
      if (!this.filters.status && effectiveStatus === 'archived') return false
      
      if (this.filters.status && effectiveStatus !== this.filters.status) return false
      if (this.filters.hostname && s.hostname !== this.filters.hostname) return false
      if (this.filters.directory && s.directory !== this.filters.directory) return false
      if (this.filters.search) {
        const q = this.filters.search.toLowerCase()
        if (!s.title.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false
      }
      return true
    })
    
    // Sort: active first if enabled, then by updated_at
    if (this.sortActiveFirst) {
      return filtered.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1
        if (b.status === 'active' && a.status !== 'active') return 1
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
    }
    return filtered
  }

  // Derived: stats (idle > 3min = stale)
  get stats() {
    const STALE_THRESHOLD_MS = 3 * 60 * 1000
    const now = Date.now()
    const active = this.sessions.filter(s => s.status === 'active').length
    const idle = this.sessions.filter(s => {
      if (s.status !== 'idle') return false
      return (now - new Date(s.updated_at).getTime()) <= STALE_THRESHOLD_MS
    }).length
    const stale = this.sessions.filter(s => {
      if (s.status !== 'idle') return false
      return (now - new Date(s.updated_at).getTime()) > STALE_THRESHOLD_MS
    }).length
    const attention = this.sessions.filter(s => s.needs_attention).length
    const totalTokens = this.sessions.reduce((sum, s) => sum + (s.token_total || 0), 0)
    const totalCost = this.sessions.reduce((sum, s) => sum + (s.cost_total || 0), 0)
    return { active, idle, stale, attention, totalTokens, totalCost, total: this.sessions.length }
  }

  // Actions
  setSessions(sessions: Session[]) {
    this.sessions = sessions
  }

  addSession(session: Session) {
    const idx = this.sessions.findIndex(s => s.id === session.id)
    if (idx >= 0) {
      // Use .map() to trigger Svelte 5 reactivity (immutable update)
      this.sessions = this.sessions.map((s, i) =>
        i === idx ? { ...s, ...session } : s
      )
    } else {
      this.sessions = [session, ...this.sessions]
    }
  }

  updateSession(partial: Partial<Session> & { id: string }) {
    // Use .map() to trigger Svelte 5 reactivity (immutable update)
    this.sessions = this.sessions.map(s =>
      s.id === partial.id ? { ...s, ...partial } : s
    )
  }

  removeSession(id: string) {
    this.sessions = this.sessions.filter(s => s.id !== id)
    // Create new Map without the deleted key (triggers reactivity)
    const newTimelines = new Map(this.timelines)
    newTimelines.delete(id)
    this.timelines = newTimelines
  }

  setTimeline(sessionId: string, events: TimelineEvent[]) {
    // Create new Map to trigger reactivity
    const newTimelines = new Map(this.timelines)
    newTimelines.set(sessionId, events)
    this.timelines = newTimelines
  }

  addTimelineEvent(sessionId: string, event: TimelineEvent) {
    const existing = this.timelines.get(sessionId) || []
    // Dedupe by id
    if (!existing.some(e => e.id === event.id)) {
      let updated = [...existing, event]
      // Trim to MAX_TIMELINE_EVENTS (keep most recent)
      if (updated.length > MAX_TIMELINE_EVENTS) {
        updated = updated.slice(-MAX_TIMELINE_EVENTS)
      }
      // Create new Map to trigger reactivity
      const newTimelines = new Map(this.timelines)
      newTimelines.set(sessionId, updated)
      this.timelines = newTimelines
    }
  }

  setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status
  }

  setFilter(key: keyof typeof this.filters, value: string) {
    this.filters[key] = value
  }

  clearFilters() {
    this.filters = { status: '', hostname: '', directory: '', search: '' }
  }

  setSortActiveFirst(value: boolean) {
    this.sortActiveFirst = value
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_sort_active_first', String(value))
    }
  }

  loadSettings() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_sort_active_first')
      this.sortActiveFirst = saved === null || saved === 'true'
    }
  }
}

// Singleton export
export const store = new DashboardStore()
