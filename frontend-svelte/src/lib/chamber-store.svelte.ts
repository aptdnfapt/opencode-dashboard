// Chamber-specific state management
// Handles tracked sessions, project holds, and recently completed sessions

import type { Session } from './types'
import { getChamberTracked, getChamberRecentDone, getProjectHolds, setProjectHold } from './api'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

// Derived grouping: project directory -> sessions
export interface ProjectRow {
  directory: string
  sessions: Session[]
  isHeld: boolean
}

class ChamberStore {
  // All tracked sessions
  tracked = $state<Session[]>([])
  
  // Recently completed sessions (limited)
  recentDone = $state<Session[]>([])
  
  // Hold state per project directory
  holds = new SvelteMap<string, boolean>()
  
  // Selected session for floating viewer
  selectedSessionId = $state<string | null>(null)
  
  // Loading states
  loading = $state(true)
  loadingDone = $state(false)
  
  // Tick for stale re-evaluation (synced with main store tick pattern)
  tick = $state(0)
  
  // Precomputed: active children set (for idle-with-subagents detection)
  get activeChildrenSet(): Set<string> {
    const set = new SvelteSet<string>()
    for (const s of this.tracked) {
      if (s.parent_session_id && s.status === 'active') {
        set.add(s.parent_session_id)
      }
    }
    return set
  }
  
  // Derived: group tracked sessions by project directory
  // Orders: non-held rows first, then held rows
  get projectRows(): ProjectRow[] {
    const STALE_THRESHOLD_MS = 3 * 60 * 1000
    const now = Date.now()
    const activeSubs = this.activeChildrenSet
    
    // Group by directory
    const grouped = new SvelteMap<string, Session[]>()
    for (const s of this.tracked) {
      const dir = s.directory || 'unknown'
      const arr = grouped.get(dir) || []
      arr.push(s)
      grouped.set(dir, arr)
    }
    
    // Build rows with hold state
    const rows: ProjectRow[] = []
    for (const [directory, sessions] of grouped) {
      // Sort sessions within row: active first, then by updated_at
      sessions.sort((a, b) => {
        // Compute effective status
        const getEffective = (s: Session) => {
          if (s.status === 'active') return 0
          if (s.status === 'idle') {
            const idleTime = now - (typeof s.updated_at === 'number' ? s.updated_at : new Date(s.updated_at).getTime())
            if (activeSubs.has(s.id)) return 1 // idle-with-subagents
            return idleTime > STALE_THRESHOLD_MS ? 3 : 2 // stale or idle
          }
          return 4 // error or other
        }
        const aEff = getEffective(a)
        const bEff = getEffective(b)
        if (aEff !== bEff) return aEff - bEff
        const aTime = typeof a.updated_at === 'number' ? a.updated_at : new Date(a.updated_at).getTime()
        const bTime = typeof b.updated_at === 'number' ? b.updated_at : new Date(b.updated_at).getTime()
        return bTime - aTime
      })
      
      rows.push({
        directory,
        sessions,
        isHeld: this.holds.get(directory) || false
      })
    }
    
    // Sort: non-held first, then by most recent activity
    rows.sort((a, b) => {
      if (a.isHeld !== b.isHeld) return a.isHeld ? 1 : -1
      const aTime = Math.max(...a.sessions.map(s => s.updated_at))
      const bTime = Math.max(...b.sessions.map(s => s.updated_at))
      return bTime - aTime
    })
    
    return rows
  }
  
  // Derived: running sessions (for quick notification check)
  get runningSessions(): Session[] {
    return this.tracked.filter(s => s.status === 'active')
  }
  
  // Derived: idle sessions (for notification eligibility)
  get idleSessions(): Session[] {
    return this.tracked.filter(s => s.status === 'idle')
  }
  
  // Get effective status for a session
  getEffectiveStatus(session: Session): 'active' | 'idle' | 'idle-with-subagents' | 'error' | 'stale' {
    const STALE_THRESHOLD_MS = 3 * 60 * 1000
    if (session.status === 'active') return 'active'
    if (session.status === 'error') return 'error'
    if (session.status === 'idle') {
      const idleTime = Date.now() - (typeof session.updated_at === 'number' ? session.updated_at : new Date(session.updated_at).getTime())
      if (this.activeChildrenSet.has(session.id)) return 'idle-with-subagents'
      return idleTime > STALE_THRESHOLD_MS ? 'stale' : 'idle'
    }
    return 'stale'
  }
  
  // Actions
  async load() {
    this.loading = true
    try {
      const [tracked, holds] = await Promise.all([
        getChamberTracked(),
        getProjectHolds()
      ])
      this.tracked = tracked
      for (const h of holds) {
        this.holds.set(h.directory, Boolean(h.is_held))
      }
    } catch (err) {
      console.warn('Failed to load Chamber:', err)
    } finally {
      this.loading = false
    }
  }
  
  async loadRecentDone(limit = 20) {
    this.loadingDone = true
    try {
      this.recentDone = await getChamberRecentDone(limit)
    } catch (err) {
      console.warn('Failed to load recent done:', err)
    } finally {
      this.loadingDone = false
    }
  }
  
  async toggleHold(directory: string) {
    const current = this.holds.get(directory) || false
    const newHold = !current
    try {
      await setProjectHold(directory, newHold)
      this.holds.set(directory, newHold)
    } catch (err) {
      console.warn('Failed to toggle hold:', err)
    }
  }
  
  // Add/update a tracked session (from WS)
  addTracked(session: Session) {
    const idx = this.tracked.findIndex(s => s.id === session.id)
    if (idx >= 0) {
      this.tracked = this.tracked.map((s, i) => i === idx ? { ...s, ...session } : s)
    } else {
      this.tracked = [session, ...this.tracked]
    }
  }
  
  // Remove a tracked session (from WS - session removed or done)
  removeTracked(sessionId: string) {
    this.tracked = this.tracked.filter(s => s.id !== sessionId)
  }
  
  // Update session partial (from WS)
  updateTracked(partial: Partial<Session> & { id: string }) {
    const idx = this.tracked.findIndex(s => s.id === partial.id)
    if (idx >= 0) {
      this.tracked = this.tracked.map((s, i) => i === idx ? { ...s, ...partial } : s)
    }
  }
  
  // Add to recent done list (from WS or manual done)
  addToRecentDone(session: Session) {
    // Remove if already exists (re-dedup)
    const filtered = this.recentDone.filter(s => s.id !== session.id)
    this.recentDone = [session, ...filtered].slice(0, 50) // Keep last 50
  }
  
  // Update hold from WS
  setHold(directory: string, isHeld: boolean) {
    this.holds.set(directory, isHeld)
  }
  
  setSelected(sessionId: string | null) {
    this.selectedSessionId = sessionId
  }
}

export const chamberStore = new ChamberStore()

// Periodic tick for stale detection
if (typeof window !== 'undefined') {
  function scheduleTick() {
    setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          chamberStore.tick++
          scheduleTick()
        })
      } else {
        chamberStore.tick++
        scheduleTick()
      }
    }, 30_000)
  }
  scheduleTick()
}