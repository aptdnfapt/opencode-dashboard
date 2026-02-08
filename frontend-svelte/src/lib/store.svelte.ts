// Svelte 5 runes-based state management

import type { Session, TimelineEvent, ConnectionStatus } from './types'

// Global reactive state using Svelte 5 runes
class DashboardStore {
  // Sessions state
  sessions = $state<Session[]>([])
  selectedSessionId = $state<string | null>(null)
  
  // Timeline per session (Map for efficient lookup)
  timelines = $state<Map<string, TimelineEvent[]>>(new Map())
  
  // Connection state
  connectionStatus = $state<ConnectionStatus>('disconnected')
  
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

  // Derived: filtered sessions
  get filteredSessions() {
    return this.sessions.filter(s => {
      if (this.filters.status && s.status !== this.filters.status) return false
      if (this.filters.hostname && s.hostname !== this.filters.hostname) return false
      if (this.filters.directory && s.directory !== this.filters.directory) return false
      if (this.filters.search) {
        const q = this.filters.search.toLowerCase()
        if (!s.title.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false
      }
      return true
    })
  }

  // Derived: stats
  get stats() {
    const active = this.sessions.filter(s => s.status === 'active').length
    const idle = this.sessions.filter(s => s.status === 'idle').length
    const attention = this.sessions.filter(s => s.needs_attention).length
    const totalTokens = this.sessions.reduce((sum, s) => sum + (s.token_total || 0), 0)
    const totalCost = this.sessions.reduce((sum, s) => sum + (s.cost_total || 0), 0)
    return { active, idle, attention, totalTokens, totalCost, total: this.sessions.length }
  }

  // Actions
  setSessions(sessions: Session[]) {
    this.sessions = sessions
  }

  addSession(session: Session) {
    const idx = this.sessions.findIndex(s => s.id === session.id)
    if (idx >= 0) {
      this.sessions[idx] = { ...this.sessions[idx], ...session }
    } else {
      this.sessions = [session, ...this.sessions]
    }
  }

  updateSession(partial: Partial<Session> & { id: string }) {
    const idx = this.sessions.findIndex(s => s.id === partial.id)
    if (idx >= 0) {
      this.sessions[idx] = { ...this.sessions[idx], ...partial }
    }
  }

  removeSession(id: string) {
    this.sessions = this.sessions.filter(s => s.id !== id)
  }

  setTimeline(sessionId: string, events: TimelineEvent[]) {
    this.timelines.set(sessionId, events)
  }

  addTimelineEvent(sessionId: string, event: TimelineEvent) {
    const existing = this.timelines.get(sessionId) || []
    // Dedupe by id
    if (!existing.some(e => e.id === event.id)) {
      this.timelines.set(sessionId, [...existing, event])
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
}

// Singleton export
export const store = new DashboardStore()
