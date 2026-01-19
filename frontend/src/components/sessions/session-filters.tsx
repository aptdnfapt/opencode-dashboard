// frontend/src/components/sessions/session-filters.tsx
// Beautiful filter bar for sessions list
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import { cn } from '@/lib/utils'

interface SessionFiltersProps {
  instances: string[]
}

export function SessionFilters({ instances }: SessionFiltersProps) {
  const { filters, setFilters } = useStore()
  const hasFilters = filters.hostname || filters.status || filters.search

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border bg-card mb-6 shadow-sm">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search sessions..."
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="pl-9 bg-background"
        />
      </div>

      {/* Hostname filter */}
      <select
        value={filters.hostname || ''}
        onChange={(e) => setFilters({ hostname: e.target.value || null })}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm min-w-[150px] focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
      >
        <option value="">All Instances</option>
        {instances.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={filters.status || ''}
        onChange={(e) => setFilters({ status: e.target.value || null })}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm min-w-[130px] focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="idle">Idle</option>
        <option value="error">Error</option>
        <option value="old">Old</option>
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ hostname: null, status: null, search: '' })}
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
