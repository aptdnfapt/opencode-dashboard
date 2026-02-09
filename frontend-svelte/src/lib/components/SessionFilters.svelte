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
  <!-- Search input -->
  <div class="relative flex-1 min-w-[200px] max-w-xs">
    <input
      type="text"
      placeholder="Search sessions..."
      bind:value={searchInput}
      oninput={(e) => handleSearch(e.currentTarget.value)}
      class="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent-blue)] pr-8"
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

  <!-- Status dropdown -->
  <select
    value={store.filters.status}
    onchange={(e) => store.setFilter('status', e.currentTarget.value)}
    class="px-3 py-2 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
  >
    <option value="">All status</option>
    <option value="active">Active</option>
    <option value="idle">Idle</option>
    <option value="error">Error</option>
    <option value="stale">Stale</option>
    <option value="archived">Archived</option>
  </select>

  <!-- Hostname dropdown -->
  <select
    value={store.filters.hostname}
    onchange={(e) => store.setFilter('hostname', e.currentTarget.value)}
    class="px-3 py-2 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
  >
    <option value="">All hosts</option>
    {#each hostnames as hostname}
      <option value={hostname}>{hostname}</option>
    {/each}
  </select>

  <!-- Clear filters button + badge -->
  {#if hasActiveFilters}
    <button
      type="button"
      onclick={clearFilters}
      class="flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:border-[var(--border)] transition-all"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span>Clear</span>
      <!-- Filter count badge -->
      <span class="px-1.5 py-0.5 text-xs font-medium rounded-full bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]">
        {activeFilterCount}
      </span>
    </button>
  {/if}
</div>
