// frontend/src/components/sessions/session-card.tsx
import { Circle, Clock, Server, Coins } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session } from '@/store'

interface SessionCardProps {
  session: Session
  onClick: () => void
  justUpdated?: boolean
}

const statusConfig = {
  active: { color: 'text-emerald-500', bg: 'bg-emerald-500', label: 'Active' },
  idle: { color: 'text-amber-500', bg: 'bg-amber-500', label: 'Idle' },
  error: { color: 'text-rose-500', bg: 'bg-rose-500', label: 'Error' },
  old: { color: 'text-muted-foreground', bg: 'bg-muted-foreground', label: 'Old' },
}

export function SessionCard({ session, onClick, justUpdated }: SessionCardProps) {
  const status = statusConfig[session.status] || statusConfig.old
  const needsAttention = session.needs_attention === 1

  return (
    <article
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-lg border bg-card p-4 transition-all duration-150',
        'hover:bg-muted/50',
        justUpdated && 'ring-1 ring-primary',
        needsAttention ? 'border-amber-500/50' : 'border-border'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium truncate">{session.title}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Server className="size-3" />
            <span>{session.hostname}</span>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className={cn('flex items-center gap-1.5 text-xs', status.color)}>
          <Circle className={cn('size-2', status.bg, 'rounded-full')} />
          <span>{status.label}</span>
        </div>
      </div>

      {/* Attention badge */}
      {needsAttention && (
        <div className="mb-3 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">
          Needs attention
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Coins className="size-3" />
            <span>{((session.token_total || 0) / 1000).toFixed(1)}k</span>
          </div>
          <span className="text-foreground font-medium">${(session.cost_total || 0).toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="size-3" />
          <span>{formatRelativeTime(session.updated_at)}</span>
        </div>
      </div>
    </article>
  )
}
