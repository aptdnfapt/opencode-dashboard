<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { chamberStore } from '$lib/chamber-store.svelte'
  import ChamberRow from '$lib/components/ChamberRow.svelte'
  import ChamberDoneList from '$lib/components/ChamberDoneList.svelte'
  import SessionViewer from '$lib/components/SessionViewer.svelte'

  function goToLibrary() {
    goto('/')
  }

  function closeViewer() {
    chamberStore.setSelected(null)
  }

  onMount(async () => {
    await Promise.all([
      chamberStore.load(),
      chamberStore.loadRecentDone()
    ])
  })
</script>

<div class="flex h-full flex-col xl:flex-row">
  <!-- Left: Chamber live board -->
  <div class="flex-1 p-4 overflow-y-auto">
    <div class="flex items-center justify-between mb-4 gap-3">
      <div>
        <h1 class="text-xl font-bold text-[var(--fg-primary)]">Captain's Chamber</h1>
        <p class="text-sm text-[var(--fg-secondary)]">
          Live tracked sessions requiring attention
        </p>
      </div>
      <div class="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
        <button class="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--fg-primary)]">Chamber</button>
        <button
          onclick={goToLibrary}
          class="px-3 py-1.5 text-sm bg-[var(--bg-secondary)] text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)]"
        >
          Library
        </button>
      </div>
    </div>

    {#if chamberStore.loading}
      <div class="space-y-3">
        {#each Array(3) as _}
          <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 h-24 animate-pulse"></div>
        {/each}
      </div>
    {:else if chamberStore.projectRows.length === 0}
      <div class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-12 h-12 text-[var(--fg-muted)] opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span class="text-[var(--fg-muted)] text-sm">
          No tracked sessions. Use <code class="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--fg-secondary)]">/cc-add</code> to track a session.
        </span>
      </div>
    {:else}
      <div class="space-y-3">
        {#each chamberStore.projectRows as row (row.directory)}
          <ChamberRow {row} />
        {/each}
      </div>
    {/if}
  </div>

  <!-- Right: Recently completed -->
  <div class="w-full xl:w-80 border-t xl:border-t-0 xl:border-l border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-y-auto max-h-[40vh] xl:max-h-none">
    <ChamberDoneList />
  </div>
</div>

<SessionViewer sessionId={chamberStore.selectedSessionId} onClose={closeViewer} />
