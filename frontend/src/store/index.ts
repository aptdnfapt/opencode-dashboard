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

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  tokens?: number
  cost?: number
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
  messages: Map<string, ChatMessage[]>
  filters: Filters
  theme: 'light' | 'dark' | 'system'
  wsConnected: boolean

  // Actions
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (session: Partial<Session> & { id: string }) => void
  selectSession: (session: Session | null) => void
  setTimeline: (sessionId: string, events: TimelineEvent[]) => void
  addTimelineEvent: (sessionId: string, event: TimelineEvent) => void
  setMessages: (sessionId: string, msgs: ChatMessage[]) => void
  addMessage: (sessionId: string, msg: ChatMessage) => void
  setFilters: (filters: Partial<Filters>) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setWsConnected: (connected: boolean) => void
  getFilteredSessions: () => Session[]
}

export const useStore = create<DashboardStore>((set, get) => ({
  sessions: [],
  selectedSession: null,
  timeline: new Map(),
  messages: new Map(),
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

  addTimelineEvent: (sessionId, event) => set((s) => {
    const timeline = new Map(s.timeline)
    const current = timeline.get(sessionId) || []
    
    // Dedupe: skip if same event_type + summary already exists in last 5 events
    const recent = current.slice(-5)
    const isDupe = recent.some(e => 
      e.event_type === event.event_type && 
      e.summary === event.summary
    )
    if (isDupe) return { timeline }
    
    timeline.set(sessionId, [...current, event])
    return { timeline }
  }),

  setMessages: (sessionId, msgs) => set((s) => {
    const messages = new Map(s.messages)
    messages.set(sessionId, msgs)
    return { messages }
  }),

  addMessage: (sessionId, msg) => set((s) => {
    const messages = new Map(s.messages)
    const current = messages.get(sessionId) || []
    messages.set(sessionId, [...current, msg])
    return { messages }
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
