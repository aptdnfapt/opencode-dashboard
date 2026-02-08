<script lang="ts">
  import { onMount } from 'svelte'
  import { store } from '$lib/store.svelte'
  import { getSessions } from '$lib/api'
  import { formatTokens, formatCost } from '$lib/utils'
  import SessionCard from '$lib/components/SessionCard.svelte'
  import StatCard from '$lib/components/StatCard.svelte'
  
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
      <h1 class="text-xl font-semibold text-[var(--fg-primary)]">Sessions</h1>
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
    <div class="flex items-center justify-center py-12">
      <span class="text-[var(--fg-muted)]">Loading sessions...</span>
    </div>
  {:else if error}
    <div class="flex items-center justify-center py-12">
      <span class="text-[var(--accent-red)]">{error}</span>
    </div>
  {:else if store.filteredSessions.length === 0}
    <div class="flex flex-col items-center justify-center py-12 gap-2">
      <span class="text-[var(--fg-muted)]">No sessions found</span>
      {#if hasFilters}
        <button 
          class="text-sm text-[var(--accent-blue)] hover:underline"
          onclick={clearFilters}
        >
          Clear filters
        </button>
      {/if}
    </div>
  {:else}
    <!-- Grid view - main sessions only (no subagents) -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {#each mainSessions as session (session.id)}
        <SessionCard 
          {session} 
          selected={store.selectedSessionId === session.id}
        />
      {/each}
    </div>
  {/if}
</div>
