// frontend/src/components/sessions/session-filters.tsx
import { Search, X } from 'lucide-react'
import { useStore } from '@/store'

interface SessionFiltersProps {
  instances: string[]
}

export function SessionFilters({ instances }: SessionFiltersProps) {
  const { filters, setFilters } = useStore()
  const hasFilters = filters.hostname || filters.status || filters.search

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search sessions..."
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Hostname filter */}
      <select
        value={filters.hostname || ''}
        onChange={(e) => setFilters({ hostname: e.target.value || null })}
        className="h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">All instances</option>
        {instances.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={filters.status || ''}
        onChange={(e) => setFilters({ status: e.target.value || null })}
        className="h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">All status</option>
        <option value="active">Active</option>
        <option value="idle">Idle</option>
        <option value="error">Error</option>
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => setFilters({ hostname: null, status: null, search: '' })}
          className="h-9 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5"
        >
          <X className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  )
}
