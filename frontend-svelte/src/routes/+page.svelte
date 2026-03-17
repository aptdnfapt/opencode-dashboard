<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { store } from '$lib/store.svelte'
  import { getSessions, getAnalyticsSummary } from '$lib/api'
  import { formatTokens, formatCost } from '$lib/utils'
  import SessionCard from '$lib/components/SessionCard.svelte'
  import StatCard from '$lib/components/StatCard.svelte'
  import SessionFilters from '$lib/components/SessionFilters.svelte'

  const PAGE_SIZE = 50

  let loading = $state(true)
  let loadingMore = $state(false)
  let error = $state<string | null>(null)
  let nextCursor = $state<string | null>(null)
  let hasMore = $state(false)
  let sentinel = $state<HTMLElement | null>(null)

  let mainSessions = $derived(
    store.filteredSessions.filter(s => !s.parent_session_id)
  )

  let hasFilters = $derived(
    store.filters.status || store.filters.hostname || store.filters.directory || store.filters.search
  )

  async function loadSessions(cursor?: string) {
    const result = await getSessions({ cursor, limit: PAGE_SIZE })
    store.setSessions(cursor ? [...store.sessions, ...result.sessions] : result.sessions)
    hasMore = result.hasMore
    nextCursor = result.nextCursor
  }

  async function loadMore() {
    if (loadingMore || !hasMore || !nextCursor) return
    loadingMore = true
    try {
      await loadSessions(nextCursor)
    } catch (err) {
      console.warn('Failed to load more sessions', err)
    } finally {
      loadingMore = false
    }
  }

  $effect(() => {
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  })

  onMount(async () => {
    try {
      await Promise.all([
        loadSessions(),
        getAnalyticsSummary().then(s => store.setGlobalStats(s)).catch(() => {})
      ])
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load sessions'
    } finally {
      loading = false
    }
  })

  function clearFilters() {
    store.clearFilters()
  }

  function goToChamber() {
    goto('/chamber')
  }
</script>

<div class="p-6 h-full overflow-y-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6 gap-3">
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-[var(--fg-primary)]">Library</h1>
        {#if !loading && !error}
          <span class="text-xs font-medium mono px-2 py-0.5 rounded-full bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
            {store.globalStats.total}
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
          Explore session history
        {/if}
      </p>
    </div>
    <div class="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      <button
        onclick={goToChamber}
        class="px-3 py-1.5 text-sm bg-[var(--bg-secondary)] text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)]"
      >
        Chamber
      </button>
      <button class="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--fg-primary)]">Library</button>
    </div>
  </div>

  <!-- Filters -->
  <div class="mb-4">
    <SessionFilters sessions={store.sessions} />
  </div>

  <!-- Stats row — global counts from DB, independent of pagination -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
    <StatCard label="Total" value={store.globalStats.total} />
    <StatCard label="Active" value={store.globalStats.active} color="green" />
    <StatCard label="Idle" value={store.globalStats.idle} color="amber" />
    <StatCard label="Attention" value={store.globalStats.attention} color="red" />
    <StatCard
      label="Tokens"
      value={formatTokens(store.globalStats.totalTokens)}
      subvalue={formatCost(store.globalStats.totalCost)}
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
  {:else if mainSessions.length === 0}
    <div class="flex flex-col items-center justify-center py-16 gap-3">
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
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {#each mainSessions as session (session.id)}
        <SessionCard
          {session}
          selected={store.selectedSessionId === session.id}
        />
      {/each}
    </div>

    <!-- Sentinel: when visible, triggers loadMore -->
    {#if hasMore}
      <div bind:this={sentinel} class="h-8 mt-3 flex items-center justify-center">
        {#if loadingMore}
          <span class="text-xs text-[var(--fg-muted)]">Loading more...</span>
        {/if}
      </div>
    {/if}
  {/if}
</div>
