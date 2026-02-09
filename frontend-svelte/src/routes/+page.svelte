<script lang="ts">
  import { onMount } from 'svelte'
  import { store } from '$lib/store.svelte'
  import { getSessions } from '$lib/api'
  import { formatTokens, formatCost } from '$lib/utils'
  import SessionCard from '$lib/components/SessionCard.svelte'
  import StatCard from '$lib/components/StatCard.svelte'
  import SessionFilters from '$lib/components/SessionFilters.svelte'
  
  let loading = $state(true)
  let error = $state<string | null>(null)
  
  // Get main sessions only (no parent_session_id = not a subagent)
  let mainSessions = $derived(
    store.filteredSessions.filter(s => !s.parent_session_id)
  )
  
  // Check if showing filtered view
  let hasFilters = $derived(
    store.filters.status || store.filters.hostname || store.filters.directory || store.filters.search
  )
  
  onMount(async () => {
    try {
      const sessions = await getSessions()
      store.setSessions(sessions)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load sessions'
    } finally {
      loading = false
    }
  })
  
  function clearFilters() {
    store.clearFilters()
  }
</script>

<div class="p-6 h-full overflow-y-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-[var(--fg-primary)]">Sessions</h1>
        {#if !loading && !error}
          <span class="text-xs font-medium mono px-2 py-0.5 rounded-full bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
            {mainSessions.length}
          </span>
        {/if}
      </div>
      <p class="text-sm text-[var(--fg-secondary)]">
        {#if hasFilters}
          Filtered view
          <button 
            class="ml-2 text-[var(--accent-blue)] hover:underline"
            onclick={clearFilters}
          >
            Clear filters
          </button>
        {:else}
          Monitor active OpenCode sessions
        {/if}
      </p>
    </div>
  </div>

  <!-- Filters -->
  <div class="mb-4">
    <SessionFilters sessions={store.sessions} />
  </div>

  <!-- Stats row -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
    <StatCard label="Total" value={store.stats.total} />
    <StatCard label="Active" value={store.stats.active} color="green" />
    <StatCard label="Idle" value={store.stats.idle} color="amber" />
    <StatCard label="Attention" value={store.stats.attention} color="red" />
    <StatCard 
      label="Tokens" 
      value={formatTokens(store.stats.totalTokens)} 
      subvalue={formatCost(store.stats.totalCost)}
      color="blue" 
    />
  </div>

  <!-- Content -->
  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {#each Array(6) as _}
        <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-3 h-32 animate-pulse"></div>
      {/each}
    </div>
  {:else if error}
    <div class="flex items-center justify-center py-12">
      <span class="text-[var(--accent-red)]">{error}</span>
    </div>
  {:else if store.filteredSessions.length === 0}
    <div class="flex flex-col items-center justify-center py-16 gap-3">
      <!-- Empty state icon -->
      <svg class="w-12 h-12 text-[var(--fg-muted)] opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      <span class="text-[var(--fg-muted)] text-sm">No sessions found</span>
      {#if hasFilters}
        <button 
          class="text-sm text-[var(--accent-blue)] hover:underline"
          onclick={clearFilters}
        >
          Clear filters
        </button>
      {:else}
        <span class="text-xs text-[var(--fg-muted)]">Sessions will appear when OpenCode instances connect</span>
      {/if}
    </div>
  {:else}
    <!-- Grid view - main sessions only (no subagents) -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {#each mainSessions as session, i (session.id)}
        <div style="animation-delay: {Math.min(i * 50, 500)}ms" class="animate-fade-in-up">
          <SessionCard 
            {session} 
            selected={store.selectedSessionId === session.id}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in-up {
    animation: fade-in-up 0.3s ease-out both;
  }
</style>
