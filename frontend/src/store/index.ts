// frontend/src/store/index.ts
// Zustand store for global state management
import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  hostname: string
  directory?: string
  status: 'active' | 'idle' | 'error' | 'old'
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
  event_type: string
  summary: string
  tool_name?: string
}

interface Filters {
  hostname: string | null
  status: string | null
  search: string
}

interface DashboardStore {
  // State
  sessions: Session[]
  selectedSession: Session | null
  timeline: Map<string, TimelineEvent[]>
  filters: Filters
  theme: 'light' | 'dark' | 'system'
  wsConnected: boolean

  // Actions
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (session: Partial<Session> & { id: string }) => void
  selectSession: (session: Session | null) => void
  setTimeline: (sessionId: string, events: TimelineEvent[]) => void
  setFilters: (filters: Partial<Filters>) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setWsConnected: (connected: boolean) => void
  getFilteredSessions: () => Session[]
}

export const useStore = create<DashboardStore>((set, get) => ({
  sessions: [],
  selectedSession: null,
  timeline: new Map(),
  filters: { hostname: null, status: null, search: '' },
  theme: 'system',
  wsConnected: false,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => set((s) => ({
    sessions: [session, ...s.sessions]
  })),

  updateSession: (update) => set((s) => ({
    sessions: s.sessions.map((sess) =>
      sess.id === update.id ? { ...sess, ...update } : sess
    ),
  })),

  selectSession: (session) => set({ selectedSession: session }),

  setTimeline: (sessionId, events) => set((s) => {
    const timeline = new Map(s.timeline)
    timeline.set(sessionId, events)
    return { timeline }
  }),

  setFilters: (filters) => set((s) => ({
    filters: { ...s.filters, ...filters },
  })),

  setTheme: (theme) => set({ theme }),

  setWsConnected: (wsConnected) => set({ wsConnected }),

  getFilteredSessions: () => {
    const { sessions, filters } = get()
    return sessions.filter((s) => {
      if (filters.hostname && s.hostname !== filters.hostname) return false
      if (filters.status && s.status !== filters.status) return false
      if (filters.search && !s.title.toLowerCase().includes(filters.search.toLowerCase())) return false
      return true
    })
  },
}))
