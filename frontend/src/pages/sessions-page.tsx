// frontend/src/pages/sessions-page.tsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { SessionCard } from '@/components/sessions/session-card'
import { SessionFilters } from '@/components/sessions/session-filters'
import { Skeleton } from '@/components/ui/skeleton'
import { Circle, Wifi, WifiOff } from 'lucide-react'
import type { Session } from '@/store'

export function SessionsPage() {
  const navigate = useNavigate()
  const selectSession = useStore(s => s.selectSession)
  const setSessions = useStore(s => s.setSessions)
  const wsConnected = useStore(s => s.wsConnected)
  const sessions = useStore(s => s.sessions)
  const filters = useStore(s => s.filters)
  
  // Filter sessions (reactive to both sessions and filters changes)
  const filteredSessions = sessions.filter((s) => {
    if (filters.hostname && s.hostname !== filters.hostname) return false
    if (filters.status && s.status !== filters.status) return false
    if (filters.search && !s.title.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  const [loading, setLoading] = useState(true)
  const [instances, setInstances] = useState<string[]>([])

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const password = localStorage.getItem('dashboard_password') || ''
        const headers = { 'X-API-Key': password }

        const [sessionsRes, instancesRes] = await Promise.all([
          fetch('/api/sessions', { headers }),
          fetch('/api/instances', { headers })
        ])

        if (!sessionsRes.ok || !instancesRes.ok) {
          console.error('Auth failed')
          setLoading(false)
          return
        }

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

  const handleSessionClick = useCallback((session: Session) => {
    selectSession(session)
    navigate(`/session/${session.id}`)
  }, [navigate, selectSession])

  // Stats
  const activeCount = sessions.filter(s => s.status === 'active').length
  const attentionCount = sessions.filter(s => s.needs_attention === 1).length

  return (
    <div className="min-h-screen">
      {/* Header - responsive: visible on all devices */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="h-full px-4 py-2 lg:px-6 lg:py-0 lg:h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-6">
            <h1 className="text-sm font-medium">Sessions</h1>
            
            {/* Stats - responsive layout */}
            <div className="flex items-center gap-2 lg:gap-4 text-[11px] lg:text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <Circle className="size-1.5 lg:size-2 fill-emerald-500 text-emerald-500" />
                <span className="text-muted-foreground">{activeCount} active</span>
              </div>
              {attentionCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Circle className="size-1.5 lg:size-2 fill-amber-500 text-amber-500 animate-pulse" />
                  <span className="text-amber-500">{attentionCount} needs attention</span>
                </div>
              )}
              <span className="text-muted-foreground">{sessions.length} total</span>
            </div>
          </div>

          {/* Connection status - responsive icon size */}
          <div className="flex items-center gap-1.5 text-[11px] lg:text-xs">
            {wsConnected ? (
              <>
                <Wifi className="size-3 lg:size-3.5 text-emerald-500" />
                <span className="text-muted-foreground hidden sm:inline">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="size-3 lg:size-3.5 text-destructive" />
                <span className="text-destructive hidden sm:inline">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 lg:p-6">
        <SessionFilters instances={instances} />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 sm:h-32 rounded-lg" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => handleSessionClick(session)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
