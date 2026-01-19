// frontend/src/components/sessions/session-card.tsx
// Session card - beautiful, polished component with hover effects
import { Activity, Clock, Server, AlertTriangle, Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session } from '@/store'

interface SessionCardProps {
  session: Session
  onClick: () => void
  justUpdated?: boolean
}

export function SessionCard({ session, onClick, justUpdated }: SessionCardProps) {
  const statusIcon = {
    active: <Activity className="size-3.5 text-green-500" />,
    idle: <Clock className="size-3.5 text-yellow-500" />,
    error: <AlertTriangle className="size-3.5 text-red-500" />,
    old: <Clock className="size-3.5 text-gray-400" />,
  }

  const needsAttention = session.needs_attention === 1

  return (
    <article
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-xl border border-border bg-card p-4 transition-all',
        'hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5',
        justUpdated && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background animate-in fade-in',
        needsAttention && 'border-orange-500/50 shadow-orange-500/20 shadow-lg'
      )}
      role="article"
    >
      {/* Header: Title + Attention Badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-foreground text-base line-clamp-1 group-hover:text-primary transition-colors flex-1">
          {session.title}
        </h3>
        {needsAttention && (
          <Badge variant="attention" className="shrink-0 text-xs font-semibold px-2.5">
            Needs Attention
          </Badge>
        )}
      </div>

      {/* Meta: Hostname + Status + Time */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
        <div className="flex items-center gap-1.5">
          <Server className="size-3.5" />
          <span className="font-medium">{session.hostname}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {statusIcon[session.status]}
          <Badge variant={session.status} className="font-medium">
            {session.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Clock className="size-3.5" />
          <span>{formatRelativeTime(session.updated_at)}</span>
        </div>
      </div>

      {/* Footer: Tokens + Cost */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border/50 pt-3">
        <div className="flex items-center gap-1.5">
          <Coins className="size-3.5" />
          <span className="font-medium text-foreground">{session.token_total.toLocaleString()}</span>
          <span className="text-muted-foreground">tokens</span>
        </div>
        <div className="ml-auto font-semibold text-foreground">
          ${session.cost_total.toFixed(2)}
        </div>
      </div>

      {/* Subtle glow effect on hover */}
      <div className={cn(
        'absolute inset-0 rounded-xl opacity-0 transition-opacity pointer-events-none',
        'bg-gradient-to-br from-primary/5 to-transparent',
        'group-hover:opacity-100',
        needsAttention && 'bg-orange-500/5'
      )} />
    </article>
  )
}
