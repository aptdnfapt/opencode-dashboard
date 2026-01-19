// frontend/src/components/dashboard/stat-card.tsx
// Stat card for analytics - beautiful, polished square-ui pattern
import { Coins, DollarSign, Activity, Server, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconMap: Record<string, LucideIcon> = {
  tokens: Coins,
  cost: DollarSign,
  sessions: Activity,
  instances: Server,
}

interface StatCardProps {
  title: string
  value: string | number
  icon: keyof typeof iconMap
  subtitle?: string
  className?: string
}

export function StatCard({ title, value, icon, subtitle, className }: StatCardProps) {
  const Icon = iconMap[icon]

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="flex size-14 items-center justify-center rounded-xl bg-muted border border-border">
          <Icon className="size-6 text-primary" />
        </div>
      </div>
    </div>
  )
}
