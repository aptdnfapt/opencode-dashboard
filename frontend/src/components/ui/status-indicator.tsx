import { cn } from '@/lib/utils'

interface StatusIndicatorProps {
  status: 'active' | 'idle' | 'error' | 'stale' | 'old'
  size?: 'sm' | 'md'
}

export function StatusIndicator({ status, size = 'sm' }: StatusIndicatorProps) {
  const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3'
  
  const colors = {
    active: 'bg-emerald-500',
    idle: 'bg-amber-500',
    error: 'bg-rose-500',
    stale: 'bg-gray-400',
    old: 'bg-gray-400',
  }

  // Active status gets pulsing animation
  if (status === 'active') {
    return (
      <span className={cn('relative flex', sizeClass)}>
        <span className={cn('animate-ping absolute h-full w-full rounded-full opacity-75', colors[status])} />
        <span className={cn('relative rounded-full', sizeClass, colors[status])} />
      </span>
    )
  }

  return <span className={cn('rounded-full', sizeClass, colors[status])} />
}
