<script lang="ts">
  import { onMount } from 'svelte'
  import { getAllSessions, getLibraryActivityRange } from '$lib/api'
  import { libraryStore } from '$lib/library-store.svelte'
  import DatabaseView from '$lib/components/DatabaseView.svelte'
  import LibraryFilters from '$lib/components/LibraryFilters.svelte'
  import SessionViewer from '$lib/components/SessionViewer.svelte'
  import TimelineView from '$lib/components/TimelineView.svelte'

  let loading = $state(true)
  let errorMessage = $state<string | null>(null)

  async function loadLibraryRange() {
    loading = true
    errorMessage = null

    try {
      const since = libraryStore.getFetchSince()
      const [sessions, activity] = await Promise.all([
        getAllSessions({ since: since ?? undefined }),
        getLibraryActivityRange({
          gapMinutes: libraryStore.activityGapMinutes,
          since: since ?? undefined
        })
      ])
      libraryStore.setSessions(sessions)
      libraryStore.setActivities(activity.activities, Math.round(activity.splitGapMs / 60000))
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load Library'
      console.warn('Failed to load Library', error)
    } finally {
      loading = false
    }
  }

  onMount(async () => {
    libraryStore.hydrateFromBrowser()
    await loadLibraryRange()
  })

  let lastFetchKey = ''
  $effect(() => {
    if (!libraryStore.initializedFromBrowser) return
    const fetchKey = `${libraryStore.filters.timeRange}:${libraryStore.activityGapMinutes}`
    if (fetchKey === lastFetchKey) return
    lastFetchKey = fetchKey
    loadLibraryRange()
  })
</script>

<div class="library-page">
  <header class="library-header">
    <div class="header-left">
      <h1 class="header-title">Session Library</h1>
      <div class="filter-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
        {libraryStore.timelineModel.totalProjects} projects • {libraryStore.databaseRows.length} sessions
      </div>
    </div>

    <div class="header-center">
      <div class="time-filter">
        <select 
          value={libraryStore.filters.timeRange}
          onchange={(e) => libraryStore.setTimeRange((e.target as HTMLSelectElement).value as any)}
        >
          <option value="1h">Last 1 hour</option>
          <option value="6h">Last 6 hours</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>
    </div>

    <div class="header-right">
      <LibraryFilters />

      <div class="view-toggle">
        <button class="toggle-btn" class:active={libraryStore.activeView === 'timeline'} onclick={() => libraryStore.setView('timeline')}>
          <svg viewBox="0 0 24 24"><path d="M3 3v18h18M3 10h18M3 16h18M7 6v12M13 6v12M19 6v12" stroke="currentColor" stroke-width="2" fill="none" /></svg>
          Timeline
        </button>
        <button class="toggle-btn" class:active={libraryStore.activeView === 'database'} onclick={() => libraryStore.setView('database')}>
          <svg viewBox="0 0 24 24"><path d="M3 4h18v16H3zM3 10h18M9 4v16" stroke="currentColor" stroke-width="2" fill="none" /></svg>
          Database
        </button>
      </div>
    </div>
  </header>

  <main class="library-content">
    {#if loading}
      <div class="empty-state">Loading Library…</div>
    {:else if errorMessage}
      <div class="empty-state error">{errorMessage}</div>
    {:else if libraryStore.databaseRows.length === 0}
      <div class="empty-state">No sessions match the current filters.</div>
    {:else if libraryStore.activeView === 'timeline'}
      <TimelineView onBlockClick={(id) => libraryStore.setSelected(id)} />
    {:else}
      <DatabaseView onRowClick={(id) => libraryStore.setSelected(id)} />
    {/if}
  </main>
</div>

{#if libraryStore.selectedSessionId}
  <SessionViewer sessionId={libraryStore.selectedSessionId} onClose={() => libraryStore.setSelected(null)} />
{/if}

<style>
  .library-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }

  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
    gap: 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .header-title {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.5px;
    color: var(--text-main);
    white-space: nowrap;
  }

  .filter-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: var(--text-muted);
    font-size: 11px;
    white-space: nowrap;
  }

  .filter-badge svg {
    width: 12px;
    height: 12px;
  }

  .time-filter select {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: var(--text-main);
    font-size: 12px;
    cursor: pointer;
    outline: none;
    white-space: nowrap;
  }

  .time-filter select:hover {
    border-color: var(--border-highlight);
  }

  .view-toggle {
    display: flex;
    padding: 3px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-canvas);
  }

  .toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .toggle-btn.active {
    background: var(--bg-card);
    color: var(--text-main);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .toggle-btn svg {
    width: 14px;
    height: 14px;
  }

  .library-content {
    position: relative;
    flex: 1;
    overflow: hidden;
  }

  .empty-state {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 14px;
  }

  .empty-state.error {
    color: var(--accent-red);
  }

  @media (max-width: 900px) {
    .library-header {
      flex-wrap: wrap;
      padding: 12px 16px;
    }
    
    .header-center {
      order: 3;
      width: 100%;
      justify-content: center;
      margin-top: 8px;
    }
  }
</style>