<script lang="ts">
  import type { Session } from '$lib/types'
  import { store } from '$lib/store.svelte'
  
  interface Props {
    sessions: Session[]
  }
  
  let { sessions }: Props = $props()
  
  // Debounced search value
  let searchInput = $state('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  
  // Extract unique hostnames from sessions
  let hostnames = $derived(
    [...new Set(sessions.map(s => s.hostname).filter(Boolean))].sort()
  )
  
  // Count active filters (excluding directory which is handled by sidebar)
  let activeFilterCount = $derived(
    [store.filters.search, store.filters.status, store.filters.hostname]
      .filter(Boolean).length
  )
  
  // Check if any filter is active
  let hasActiveFilters = $derived(activeFilterCount > 0)
  
  // Debounced search handler
  function handleSearch(value: string) {
    searchInput = value
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      store.setFilter('search', value)
    }, 300)
  }
  
  // Clear all filters (except directory)
  function clearFilters() {
    searchInput = ''
    store.setFilter('search', '')
    store.setFilter('status', '')
    store.setFilter('hostname', '')
  }
</script>

<div class="flex items-center gap-3 flex-wrap">
  <!-- Search input with icon -->
  <div class="relative flex-1 min-w-[200px] max-w-xs">
    <!-- Search icon -->
    <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-muted)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
    <input
      type="text"
      placeholder="Search sessions..."
      bind:value={searchInput}
      oninput={(e) => handleSearch(e.currentTarget.value)}
      class="w-full pl-8 pr-8 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors duration-150"
    />
    {#if searchInput}
      <button
        type="button"
        aria-label="Clear search"
        onclick={() => { searchInput = ''; store.setFilter('search', '') }}
        class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
  </div>

  <!-- Status dropdown — styled with custom chevron -->
  <select
    value={store.filters.status}
    onchange={(e) => store.setFilter('status', e.currentTarget.value)}
    class="px-3 py-2 pr-7 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer appearance-none transition-colors duration-150"
    style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236e7681' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 8px center;"
  >
    <option value="">All status</option>
    <option value="active">Active</option>
    <option value="idle">Idle</option>
    <option value="error">Error</option>
    <option value="stale">Stale</option>
    <option value="archived">Archived</option>
  </select>

  <!-- Hostname dropdown — styled with custom chevron -->
  <select
    value={store.filters.hostname}
    onchange={(e) => store.setFilter('hostname', e.currentTarget.value)}
    class="px-3 py-2 pr-7 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer appearance-none transition-colors duration-150"
    style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236e7681' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 8px center;"
  >
    <option value="">All hosts</option>
    {#each hostnames as hostname}
      <option value={hostname}>{hostname}</option>
    {/each}
  </select>

  <!-- Clear filters button + glowing pill badge -->
  {#if hasActiveFilters}
    <button
      type="button"
      onclick={clearFilters}
      class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:border-[var(--border)] transition-all duration-150"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span>Clear</span>
      <!-- Filter count pill with subtle glow -->
      <span
        class="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20"
        style="box-shadow: 0 0 6px rgba(88, 166, 255, 0.15);"
      >
        {activeFilterCount}
      </span>
    </button>
  {/if}
</div>
