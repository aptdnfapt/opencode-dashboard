// frontend/src/components/sessions/session-detail.tsx
// Modal showing session timeline and details
import { useState, useEffect, useMemo } from 'react'
import { X, MessageSquare, Terminal, AlertCircle, Lock, Clock, Coins } from 'lucide-react'
import { useStore, type TimelineEvent } from '@/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/utils'

const eventIcons: Record<string, React.ReactNode> = {
  user: <MessageSquare className="size-4 text-blue-500" />,
  assistant: <MessageSquare className="size-4 text-purple-500" />,
  tool: <Terminal className="size-4 text-green-500" />,
  error: <AlertCircle className="size-4 text-red-500" />,
  permission: <Lock className="size-4 text-orange-500" />,
}

export function SessionDetail() {
  const { selectedSession, selectSession, timeline } = useStore()
  const [loading, setLoading] = useState(false)

  // Get timeline from store - useMemo for stability
  const events: TimelineEvent[] = useMemo(() => {
    if (!selectedSession) return []
    return timeline.get(selectedSession.id) || []
  }, [selectedSession, timeline])

  // Fetch timeline from API if not in store
  useEffect(() => {
    if (!selectedSession || timeline.has(selectedSession.id)) return
    setLoading(true)
    fetch(`/api/sessions/${selectedSession.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.timeline) {
          useStore.getState().setTimeline(selectedSession.id, data.timeline)
        }
      })
      .catch(err => console.error('Failed to fetch timeline:', err))
      .finally(() => setLoading(false))
  }, [selectedSession, timeline])

  // Early return after all hooks
  if (!selectedSession) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => selectSession(null)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 border-b border-border bg-card">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-foreground truncate">
              {selectedSession.title}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <Badge variant={selectedSession.status}>{selectedSession.status}</Badge>
              <span>{selectedSession.hostname}</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatRelativeTime(selectedSession.updated_at)}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => selectSession(null)}>
            <X className="size-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          {/* Session info */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Started</p>
              <p className="text-sm font-medium">{new Date(selectedSession.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tokens</p>
              <p className="text-sm font-medium flex items-center gap-1">
                <Coins className="size-3.5 text-primary" />
                {selectedSession.token_total.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Timeline</h3>
            <div className="space-y-3">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No events yet</p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-1 flex-shrink-0">
                      {eventIcons[event.event_type] || <MessageSquare className="size-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{event.event_type}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{event.summary}</p>
                      {event.tool_name && (
                        <p className="text-xs text-muted-foreground mt-1">{event.tool_name}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}