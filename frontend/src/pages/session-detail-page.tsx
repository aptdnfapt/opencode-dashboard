"use client"

import { useEffect, useState } from "react"
import { useStore } from "@/store"
import { useParams, useNavigate } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import { ArrowLeft, User, Bot, Clock, Hash, DollarSign, Terminal, FileText, AlertCircle, CheckCircle, Activity, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

// Solid background colors - no transparency
const eventColors: Record<string, string> = {
  user: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  message: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  tool: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  bash: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  read: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  write: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  edit: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  idle: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  compacted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  permission: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
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
        <div className="px-6 py-6">
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
      {/* Sticky header with session info */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            <h1 className="text-base font-semibold truncate flex-1">{session.title}</h1>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
              <Badge variant={session.status}>{session.status}</Badge>
              <span className="flex items-center gap-1">
                <Server className="size-3.5" />
                {session.hostname}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatDate(session.created_at)}
              </span>
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Hash className="size-3.5" />
                {(session.token_total / 1000).toFixed(1)}k
              </span>
              <span className="flex items-center gap-1 font-medium text-foreground">
                <DollarSign className="size-3.5" />
                ${session.cost_total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Timeline - full width */}
      <main className="px-6 py-6">
        {sessionTimeline.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Activity className="size-12 mx-auto mb-4 opacity-50" />
            <p>No activity in this session</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessionTimeline.map((event, index) => {
              const Icon = eventIcons[event.event_type] || Activity
              const colorClass = eventColors[event.event_type] || "bg-muted text-muted-foreground"
              const isLast = index === sessionTimeline.length - 1

              return (
                <div key={event.id} className="flex gap-4">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                      <Icon className="size-4" />
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-border min-h-[20px] my-1" />
                    )}
                  </div>

                  {/* Event content - full width */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {event.event_type}
                      </span>
                      {event.tool_name && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted font-mono">
                          {event.tool_name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>

                    <div className="bg-muted rounded-lg p-4">
                      {event.event_type === "message" || event.event_type === "user" ? (
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
                                        ? "bg-background px-1.5 py-0.5 rounded text-sm border border-border"
                                        : "block bg-background p-4 rounded-lg overflow-x-auto text-sm border border-border"
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
                        <div className="font-mono text-sm break-all">
                          <span className="text-muted-foreground mr-2">$</span>
                          {event.summary}
                        </div>
                      ) : event.event_type === "error" ? (
                        <div className="text-red-600 dark:text-red-400 text-sm">{event.summary}</div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{event.summary}</p>
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
