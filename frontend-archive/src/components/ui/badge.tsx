// frontend/src/components/ui/badge.tsx
// Status badge with color variants
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
variants: {
        variant: {
          default: 'bg-muted text-muted-foreground',
          outline: 'border border-border bg-transparent text-foreground',
          active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
          idle: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
          error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
          attention: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse',
          old: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
        },
      },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
)
Badge.displayName = 'Badge'

export { Badge, badgeVariants }
