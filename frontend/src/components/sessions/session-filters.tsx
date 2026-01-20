import { useState } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useStore } from '@/store'

interface SessionFiltersProps {
  instances: string[]
}

export function SessionFilters({ instances }: SessionFiltersProps) {
  const { filters, setFilters } = useStore()
  const [showFilters, setShowFilters] = useState(false)
  const hasFilters = filters.hostname || filters.status || filters.search

  const activeFilterCount = [
    filters.hostname ? 1 : 0,
    filters.status ? 1 : 0,
    filters.search ? 1 : 0
  ].filter(Boolean).length

  const handleClear = () => {
    setFilters({ hostname: null, status: null, search: '' })
  }

  return (
    <div className="space-y-3">
      {/* Mobile: Compact search with filter toggle */}
      <div className="lg:hidden space-y-3">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 px-2 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 relative"
            aria-label={showFilters ? 'Hide filters' : 'Show filters'}
          >
            <SlidersHorizontal className="size-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {hasFilters && (
          <button
            onClick={handleClear}
            className="h-8 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <X className="size-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Collapsible filters - mobile only */}
      {showFilters && (
        <div className="lg:hidden space-y-3 pt-2 border-t">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.hostname || ''}
              onChange={(e) => setFilters({ hostname: e.target.value || null })}
              className="h-8 px-2.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All instances</option>
              {instances.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ status: e.target.value || null })}
              className="h-8 px-2.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
      )}

      {/* Desktop: Full filters always visible */}
      <div className="hidden lg:flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

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

        {hasFilters && (
          <button
            onClick={handleClear}
            className="h-9 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5"
          >
            <X className="size-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
