// AnimatedBadge - pulsing glow effect for attention-grabbing states
import { cn } from '@/lib/utils'

interface AnimatedBadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function AnimatedBadge({ children, className, variant = 'default' }: AnimatedBadgeProps) {
  const variants = {
    default: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    success: 'bg-green-500/10 text-green-500 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    danger: 'bg-red-500/10 text-red-500 border-red-500/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border animate-pulse',
        variants[variant],
        className
      )}
      style={{
        animation: 'pulse-glow 2s ease-in-out infinite',
      }}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            variant === 'default' && 'bg-orange-400',
            variant === 'success' && 'bg-green-400',
            variant === 'warning' && 'bg-yellow-400',
            variant === 'danger' && 'bg-red-400'
          )}
        />
        <span
          className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            variant === 'default' && 'bg-orange-500',
            variant === 'success' && 'bg-green-500',
            variant === 'warning' && 'bg-yellow-500',
            variant === 'danger' && 'bg-red-500'
          )}
        />
      </span>
      {children}
    </span>
  )
}