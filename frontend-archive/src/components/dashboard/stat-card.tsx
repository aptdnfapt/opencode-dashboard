// frontend/src/components/dashboard/stat-card.tsx
// Stat card for analytics - Flexoki themed
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
  change?: number
  className?: string
}

export function StatCard({ title, value, icon, subtitle, change, className }: StatCardProps) {
  const Icon = iconMap[icon]

  return (
    <div className={cn(
      'rounded-lg border border-border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold mt-2">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
      {change !== undefined && (
        <p className={cn(
          "text-xs mt-1",
          change >= 0 ? "text-[#879A39]" : "text-[#D14D41]"
        )}>
          {change >= 0 ? "+" : ""}{change}% from last period
        </p>
      )}
    </div>
  )
}
