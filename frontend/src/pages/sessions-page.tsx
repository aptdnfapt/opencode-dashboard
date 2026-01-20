// frontend/src/pages/sessions-page.tsx
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { useWebSocket } from '@/hooks/useWebSocket'
import { SessionCard } from '@/components/sessions/session-card'
import { SessionFilters } from '@/components/sessions/session-filters'
import { Skeleton } from '@/components/ui/skeleton'
import { Circle, Wifi, WifiOff } from 'lucide-react'
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

  // Flash effect
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

  const playSound = useCallback(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==')
    audio.volume = 0.3
    audio.play().catch(() => {})
  }, [])

  const handlersRef = useRef({ addSession, updateSession, flashSession, playSound, sessions })
  useEffect(() => {
    handlersRef.current = { addSession, updateSession, flashSession, playSound, sessions }
  }, [addSession, updateSession, flashSession, playSound, sessions])

  const handleWSMessage = useCallback((msg: any) => {
    const { addSession, updateSession, flashSession, playSound, sessions } = handlersRef.current
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
        flashSession(msg.data.sessionId)
        break
      case 'error':
        updateSession({ id: msg.data.sessionId, status: 'error' })
        flashSession(msg.data.sessionId)
        playSound()
        break
    }
  }, [])

  const handleSessionClick = useCallback((session: Session) => {
    selectSession(session)
    navigate(`/session/${session.id}`)
  }, [navigate, selectSession])

  const password = localStorage.getItem('dashboard_password') || ''
  useWebSocket(password, handleWSMessage, setWsConnected)

  // Stats
  const activeCount = sessions.filter(s => s.status === 'active').length
  const attentionCount = sessions.filter(s => s.needs_attention === 1).length

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-medium">Sessions</h1>
            
            {/* Stats */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Circle className="size-2 fill-emerald-500 text-emerald-500" />
                <span className="text-muted-foreground">{activeCount} active</span>
              </div>
              {attentionCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Circle className="size-2 fill-amber-500 text-amber-500 animate-pulse" />
                  <span className="text-amber-500">{attentionCount} needs attention</span>
                </div>
              )}
              <span className="text-muted-foreground">{sessions.length} total</span>
            </div>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs">
            {wsConnected ? (
              <>
                <Wifi className="size-3.5 text-emerald-500" />
                <span className="text-muted-foreground">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="size-3.5 text-destructive" />
                <span className="text-destructive">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <SessionFilters instances={instances} />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Circle className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No sessions yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
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
      </div>
    </div>
  )
}
