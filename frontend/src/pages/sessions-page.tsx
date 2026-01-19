// frontend/src/pages/sessions-page.tsx
// Main sessions list page with real-time updates
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { useWebSocket } from '@/hooks/useWebSocket'
import { SessionCard } from '@/components/sessions/session-card'
import { SessionFilters } from '@/components/sessions/session-filters'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Wifi, WifiOff, Power } from 'lucide-react'
import type { Session } from '@/store'

export function SessionsPage() {
  const navigate = useNavigate()
  const { selectSession, setSessions, addSession, updateSession, getFilteredSessions, wsConnected, setWsConnected } = useStore()
  const sessions = getFilteredSessions()

  const [loading, setLoading] = useState(true)
  const [instances, setInstances] = useState<string[]>([])
  const [recentUpdates, setRecentUpdates] = useState<Set<string>>(new Set())

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [sessionsRes, instancesRes] = await Promise.all([
          fetch('/api/sessions'),
          fetch('/api/instances')
        ])
        const sessionsData = await sessionsRes.json()
        const instancesData = await instancesRes.json()

        setSessions(sessionsData)
        setInstances(instancesData.map((i: any) => i.hostname))
      } catch (err) {
        console.error('Failed to fetch:', err)
      }
      setLoading(false)
    }
    fetchData()
  }, [setSessions])

  // Flash effect for updated sessions
  const flashSession = useCallback((id: string) => {
    setRecentUpdates((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setRecentUpdates((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 2000)
  }, [])

  // Play notification sound
  const playSound = useCallback(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==')
    audio.volume = 0.3
    audio.play().catch(() => {})
  }, [])

  // Handle WebSocket messages - using refs to avoid stale closure
  const handlersRef = useRef({
    addSession,
    updateSession,
    flashSession,
    playSound,
  })

  useEffect(() => {
    handlersRef.current = { addSession, updateSession, flashSession, playSound }
  }, [addSession, updateSession, flashSession, playSound])

  const handleWSMessage = useCallback((msg: any) => {
    const { addSession, updateSession, flashSession, playSound } = handlersRef.current
    switch (msg.type) {
      case 'session.created':
        addSession(msg.data)
        flashSession(msg.data.id)
        break
      case 'session.updated':
        updateSession(msg.data)
        flashSession(msg.data.id)
        break
      case 'timeline':
        flashSession(msg.data.sessionId)
        break
      case 'attention':
        updateSession({ id: msg.data.sessionId, needs_attention: msg.data.needsAttention ? 1 : 0 })
        if (msg.data.needsAttention) playSound()
        break
      case 'idle':
        updateSession({ id: msg.data.sessionId, status: 'idle' })
        playSound()
        break
    }
  }, [])

  // Handle session click - navigate to detail page
  const handleSessionClick = useCallback((session: Session) => {
    selectSession(session)
    navigate(`/session/${session.id}`)
  }, [navigate, selectSession])

  // WebSocket connection
  const password = localStorage.getItem('dashboard_password') || ''
  useWebSocket(password, handleWSMessage, setWsConnected)

  // Calculate stats
  const activeCount = sessions.filter(s => s.status === 'active').length
  const attentionCount = sessions.filter(s => s.needs_attention === 1).length
  const totalTokens = sessions.reduce((sum, s) => sum + s.token_total, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Sessions</h1>
              <p className="text-xs text-muted-foreground">{sessions.length} total sessions</p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <Activity className="size-3.5 text-green-500" />
                <span className="font-medium text-green-500">{activeCount} active</span>
              </div>

              {attentionCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 animate-pulse">
                  <Power className="size-3.5 text-orange-500" />
                  <span className="font-medium text-orange-500">{attentionCount} needs attention</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                <span className="font-medium text-primary">{(totalTokens / 1000).toFixed(1)}k tokens</span>
              </div>
            </div>

            {/* Connection status */}
            <div className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full border">
              {wsConnected ? (
                <>
                  <Wifi className="size-4 text-green-500" />
                  <span className="text-green-500 font-medium">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="size-4 text-red-500" />
                  <span className="text-red-500 font-medium">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <SessionFilters instances={instances} />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
              <Activity className="size-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No sessions found</h2>
            <p className="text-muted-foreground">Start coding and your sessions will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => handleSessionClick(session)}
                justUpdated={recentUpdates.has(session.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Import useRef at top
import { useRef } from 'react'