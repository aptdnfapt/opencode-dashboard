// frontend/src/pages/session-detail-page.tsx
import { useEffect, useState, useCallback, useRef } from "react"
import { useStore } from "@/store"
import { useParams, useNavigate } from "react-router-dom"
import { useWebSocket } from "@/hooks/useWebSocket"
import ReactMarkdown from "react-markdown"
import { ArrowLeft, User, Bot, Clock, Terminal, FileText, AlertCircle, CheckCircle, Activity, Server, Coins, Circle, ArrowDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const eventConfig: Record<string, { icon: typeof Bot; color: string }> = {
  user: { icon: User, color: "text-sky-500" },
  message: { icon: Bot, color: "text-violet-500" },
  tool: { icon: Terminal, color: "text-amber-500" },
  bash: { icon: Terminal, color: "text-emerald-500" },
  read: { icon: FileText, color: "text-sky-500" },
  write: { icon: FileText, color: "text-sky-500" },
  edit: { icon: FileText, color: "text-sky-500" },
  error: { icon: AlertCircle, color: "text-rose-500" },
  idle: { icon: CheckCircle, color: "text-muted-foreground" },
  compacted: { icon: Activity, color: "text-amber-500" },
  permission: { icon: AlertCircle, color: "text-amber-500" },
}

const statusColors: Record<string, string> = {
  active: "text-emerald-500",
  idle: "text-amber-500",
  error: "text-rose-500",
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { selectSession, setTimeline, timeline, addTimelineEvent } = useStore()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const timelineEndRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  const sessionTimeline = sessionId ? timeline.get(sessionId) || [] : []

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Track scroll position to show/hide scroll button
  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = main
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200
      setShowScrollBtn(!isNearBottom)
    }

    main.addEventListener('scroll', handleScroll)
    return () => main.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (!loading && sessionTimeline.length > 0) {
      setTimeout(scrollToBottom, 100)
    }
  }, [loading, scrollToBottom])

  // Fetch initial data
  useEffect(() => {
    if (!sessionId) {
      navigate("/")
      return
    }

    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        const data = await res.json()
        setSession(data.session)
        selectSession(data.session)
        setTimeline(sessionId!, data.timeline || [])
      } catch (err) {
        console.error("Failed to fetch session:", err)
      }
      setLoading(false)
    }

    fetchSession()
  }, [sessionId, navigate, selectSession, setTimeline])

  // WebSocket handler for real-time updates
  const handleWSMessage = useCallback((msg: any) => {
    if (!sessionId) return
    
    switch (msg.type) {
      case 'timeline':
        // Only add if it's for this session
        if (msg.data?.sessionId === sessionId) {
          addTimelineEvent(sessionId, {
            id: Date.now(), // temp id
            session_id: sessionId,
            timestamp: msg.data.timestamp || Date.now(),
            event_type: msg.data.eventType,
            summary: msg.data.summary,
            tool_name: msg.data.tool,
          })
          // Auto-scroll to bottom
          setTimeout(() => {
            timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }
        break
      case 'idle':
        if (msg.data?.sessionId === sessionId) {
          setSession((s: any) => s ? { ...s, status: 'idle' } : s)
        }
        break
      case 'error':
        if (msg.data?.sessionId === sessionId) {
          setSession((s: any) => s ? { ...s, status: 'error' } : s)
        }
        break
      case 'attention':
        if (msg.data?.sessionId === sessionId) {
          setSession((s: any) => s ? { ...s, needs_attention: msg.data.needsAttention ? 1 : 0 } : s)
        }
        break
    }
  }, [sessionId, addTimelineEvent])

  // Connect to WebSocket
  const password = localStorage.getItem('dashboard_password') || ''
  useWebSocket(password, handleWSMessage)

  const handleBack = () => {
    selectSession(null)
    navigate("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-14 border-b border-border" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Session not found</p>
          <button onClick={handleBack} className="text-sm text-primary hover:underline">
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="shrink-0 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="h-full px-6 flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          <div className="h-4 w-px bg-border" />

          <h1 className="text-sm font-medium truncate flex-1">{session.title}</h1>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className={`flex items-center gap-1.5 ${statusColors[session.status] || ''}`}>
              <Circle className="size-2 fill-current" />
              <span className="capitalize">{session.status}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Server className="size-3" />
              <span>{session.hostname}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3" />
              <span>{formatDate(session.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="size-3" />
              <span>{(session.token_total / 1000).toFixed(1)}k</span>
            </div>
            <span className="font-medium text-foreground">${session.cost_total.toFixed(2)}</span>
          </div>
        </div>
      </header>

      {/* Timeline */}
      <main ref={mainRef} className="flex-1 overflow-y-auto p-6">
        {sessionTimeline.length === 0 ? (
          <div className="text-center py-20">
            <Activity className="size-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessionTimeline.map((event, index) => {
              const config = eventConfig[event.event_type] || { icon: Activity, color: "text-muted-foreground" }
              const Icon = config.icon
              const isLast = index === sessionTimeline.length - 1

              return (
                <div key={event.id} className="flex gap-3">
                  {/* Timeline line + icon */}
                  <div className="flex flex-col items-center w-6 shrink-0">
                    <div className={`size-6 rounded-full bg-muted flex items-center justify-center ${config.color}`}>
                      <Icon className="size-3" />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border my-1" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {event.event_type}
                      </span>
                      {event.tool_name && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                          {event.tool_name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>

                    <div className="rounded-md bg-muted p-3 text-sm">
                      {event.event_type === "message" || event.event_type === "user" ? (
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown
                            components={{
                              code({ children, className }) {
                                const isInline = !className
                                return (
                                  <code
                                    className={
                                      isInline
                                        ? "bg-background px-1 py-0.5 rounded text-xs"
                                        : "block bg-background p-3 rounded overflow-x-auto text-xs"
                                    }
                                  >
                                    {children}
                                  </code>
                                )
                              },
                            }}
                          >
                            {event.summary}
                          </ReactMarkdown>
                        </div>
                      ) : event.event_type === "tool" || event.event_type === "bash" ? (
                        <div className="font-mono text-xs">
                          <span className="text-muted-foreground mr-2">$</span>
                          {event.summary}
                        </div>
                      ) : event.event_type === "error" ? (
                        <div className="text-rose-400 text-xs">{event.summary}</div>
                      ) : (
                        <p className="text-xs whitespace-pre-wrap">{event.summary}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {/* Scroll anchor */}
            <div ref={timelineEndRef} />
          </div>
        )}
      </main>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-6 right-6 size-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          <ArrowDown className="size-5" />
        </button>
      )}
    </div>
  )
}
