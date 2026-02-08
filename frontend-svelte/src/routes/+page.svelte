<script lang="ts">
  import { onMount } from 'svelte'
  import { store } from '$lib/store.svelte'
  import { getSessions } from '$lib/api'
  import { formatTokens, formatCost } from '$lib/utils'
  import SessionCard from '$lib/components/SessionCard.svelte'
  import StatCard from '$lib/components/StatCard.svelte'
  import ProjectSidebar from '$lib/components/ProjectSidebar.svelte'
  import SessionFilters from '$lib/components/SessionFilters.svelte'
  
  let loading = $state(true)
  let error = $state<string | null>(null)
  
  // Derived: show active project filter label
  let activeFilter = $derived(
    store.filters.directory 
      ? store.filters.directory.split('/').pop() 
      : null
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
  
  function selectSession(id: string) {
    store.selectedSessionId = store.selectedSessionId === id ? null : id
  }
  
  function clearProjectFilter() {
    store.setFilter('directory', '')
  }
</script>

<div class="flex h-full">
  <!-- Project Sidebar -->
  <ProjectSidebar />
  
  <!-- Main Content -->
  <div class="flex-1 p-6 overflow-y-auto">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-[var(--fg-primary)]">Sessions</h1>
    <p class="text-sm text-[var(--fg-secondary)]">Monitor active OpenCode sessions</p>
  </div>

  <!-- Stats row -->
  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
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

  <!-- Filter bar -->
  <div class="mb-4">
    <SessionFilters sessions={store.sessions} />
  </div>

  <!-- Sessions grid -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <span class="text-[var(--fg-muted)]">Loading sessions...</span>
    </div>
  {:else if error}
    <div class="flex items-center justify-center py-12">
      <span class="text-[var(--accent-red)]">{error}</span>
    </div>
  {:else if store.filteredSessions.length === 0}
    <div class="flex items-center justify-center py-12">
      <span class="text-[var(--fg-muted)]">No sessions found</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {#each store.filteredSessions as session (session.id)}
        <SessionCard 
          {session} 
          selected={store.selectedSessionId === session.id}
        />
      {/each}
    </div>
  {/if}
  </div>
</div>
