"use client"

import { useEffect, useState } from "react"
import { useStore, type ChatMessage } from "@/store"
import { useParams, useNavigate } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import { ArrowLeft, User, Bot, Clock, Hash, DollarSign, Terminal, FileText, AlertCircle, CheckCircle, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
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

const eventIcons: Record<string, typeof Bot> = {
  user: User,
  message: Bot,
  tool: Terminal,
  bash: Terminal,
  read: FileText,
  write: FileText,
  edit: FileText,
  error: AlertCircle,
  idle: CheckCircle,
  compacted: Activity,
  permission: AlertCircle,
}

const eventColors: Record<string, string> = {
  user: "bg-primary/10 text-primary",
  message: "bg-purple-500/10 text-purple-500",
  tool: "bg-orange-500/10 text-orange-500",
  bash: "bg-green-500/10 text-green-500",
  read: "bg-blue-500/10 text-blue-500",
  write: "bg-blue-500/10 text-blue-500",
  edit: "bg-blue-500/10 text-blue-500",
  error: "bg-red-500/10 text-red-500",
  idle: "bg-gray-500/10 text-gray-500",
  compacted: "bg-yellow-500/10 text-yellow-500",
  permission: "bg-orange-500/10 text-orange-500",
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { selectSession, setTimeline, timeline } = useStore()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)

  const sessionTimeline = sessionId ? timeline.get(sessionId) || [] : []

  useEffect(() => {
    if (!sessionId) {
      navigate("/")
      return
    }

    const currentSessionId = sessionId

    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/${currentSessionId}`)
        const data = await res.json()

        setSession(data.session)
        selectSession(data.session)
        setTimeline(currentSessionId, data.timeline || [])
      } catch (err) {
        console.error("Failed to fetch session:", err)
      }
      setLoading(false)
    }

    fetchSession()
  }, [sessionId, navigate, selectSession, setTimeline])

  const handleBack = () => {
    selectSession(null)
    navigate("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Skeleton className="h-10 w-32 mb-6" />
          <Skeleton className="h-48 w-full rounded-xl mb-4" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Session not found</h1>
          <Button onClick={handleBack}>Go back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{session.title}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="size-3" />
                {formatDate(session.created_at)}
                {session.hostname && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1">
                      <Hash className="size-3" />
                      {session.hostname}
                    </span>
                  </>
                )}
                {session.directory && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="truncate max-w-[200px]">{session.directory}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Hash className="size-4" />
                {(session.token_total / 1000).toFixed(1)}k tokens
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="size-4" />
                ${session.cost_total.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Timeline */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {sessionTimeline.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Activity className="size-12 mx-auto mb-4 opacity-50" />
            <p>No activity in this session</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessionTimeline.map((event, index) => {
              const Icon = eventIcons[event.event_type] || Activity
              const colorClass = eventColors[event.event_type] || "bg-muted text-muted-foreground"
              const isLast = index === sessionTimeline.length - 1

              return (
                <div key={event.id} className="flex gap-3 group">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="size-4" />
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-border min-h-[40px] my-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        {event.event_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(event.timestamp)}
                      </span>
                      {event.tool_name && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {event.tool_name}
                        </span>
                      )}
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3">
                      {event.event_type === "message" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown
                            components={{
                              code(props) {
                                const { children, className } = props
                                const isInline = !className
                                return (
                                  <code
                                    className={`${
                                      isInline
                                        ? "bg-black/10 px-1.5 py-0.5 rounded text-sm"
                                        : "block bg-black/5 p-4 rounded-lg overflow-x-auto text-sm"
                                    } ${className || ""}`}
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
                        <div className="font-mono text-sm">
                          <span className="text-muted-foreground mr-2">$</span>
                          {event.summary}
                        </div>
                      ) : event.event_type === "error" ? (
                        <div className="text-red-500 text-sm">{event.summary}</div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{event.summary}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}