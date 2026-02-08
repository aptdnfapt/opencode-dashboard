// frontend/src/components/sessions/session-card.tsx
import React, { useState, useEffect } from 'react'
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
  stale: { color: 'text-gray-400', bg: 'bg-gray-400', label: 'Stale' },
  old: { color: 'text-muted-foreground', bg: 'bg-muted-foreground', label: 'Old' },
}

// Memoized SessionCard - only re-renders when relevant props change
export const SessionCard = React.memo(function SessionCard({ session, onClick, justUpdated }: SessionCardProps) {
  // Live timestamp refresh - tick every minute to update relative time
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(timer)
  }, [])
  const status = statusConfig[session.status] || statusConfig.old
  const needsAttention = session.needs_attention === 1

  return (
    <article
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-lg border bg-card p-3 sm:p-4 lg:p-5 transition-all duration-150',
        'hover:bg-muted/50',
        justUpdated && 'ring-1 ring-primary',
        needsAttention ? 'border-amber-500/50' : 'border-border'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 lg:gap-3 mb-2 sm:mb-3 lg:mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm lg:text-sm font-medium truncate">{session.title}</h3>
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2 mt-1 text-[11px] sm:text-xs lg:text-xs text-muted-foreground">
            <Server className="size-2.5 sm:size-3 lg:size-3" />
            <span className="truncate">{session.hostname}</span>
          </div>
        </div>

        {/* Status indicator */}
        <div className={cn('flex items-center gap-1 sm:gap-1.5 lg:gap-1.5 text-[10px] sm:text-xs lg:text-xs', status.color)}>
          <Circle className={cn('size-1.5 sm:size-2 lg:size-2', status.bg, 'rounded-full')} />
          <span className="hidden sm:inline lg:inline">{status.label}</span>
        </div>
      </div>

      {/* Attention badge */}
      {needsAttention && (
        <div className="mb-2 sm:mb-3 lg:mb-3 px-1.5 sm:px-2 lg:px-2 py-0.5 sm:py-1 lg:py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] sm:text-xs lg:text-xs text-amber-500">
          Needs attention
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 sm:pt-3 lg:pt-3 border-t border-border text-[10px] sm:text-xs lg:text-xs text-muted-foreground">
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-3">
          <div className="flex items-center gap-1 sm:gap-1 lg:gap-1">
            <Coins className="size-2.5 sm:size-3 lg:size-3" />
            <span>{((session.token_total || 0) / 1000).toFixed(1)}k</span>
          </div>
          <span className="text-foreground font-medium">${(session.cost_total || 0).toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-1 lg:gap-1">
          <Clock className="size-2.5 sm:size-3 lg:size-3" />
          <span>{formatRelativeTime(session.updated_at)}</span>
        </div>
      </div>
    </article>
  )
}, (prev, next) => {
  // Custom comparison - only re-render if these change
  return prev.session.id === next.session.id 
    && prev.session.status === next.session.status
    && prev.session.updated_at === next.session.updated_at
    && prev.session.needs_attention === next.session.needs_attention
    && prev.session.cost_total === next.session.cost_total
    && prev.session.token_total === next.session.token_total
    && prev.justUpdated === next.justUpdated
})
