<script lang="ts">
  import type { Session } from '$lib/types'
  import { chamberStore } from '$lib/chamber-store.svelte'
  import { getProjectName, getProjectColor, cn } from '$lib/utils'
  import ChamberCard from '$lib/components/ChamberCard.svelte'
  import { VolumeX, Volume2 } from 'lucide-svelte'

  interface Props {
    row: {
      directory: string
      sessions: Session[]
      isHeld: boolean
    }
  }

  let { row }: Props = $props()

  // Separate sessions into running and idle zones
  let runningSessions = $derived.by(() => {
    void chamberStore.tick
    return row.sessions.filter(s => {
      const status = chamberStore.getEffectiveStatus(s)
      return status === 'active' || status === 'idle-with-subagents'
    })
  })

  let idleSessions = $derived.by(() => {
    void chamberStore.tick
    return row.sessions.filter(s => {
      const status = chamberStore.getEffectiveStatus(s)
      return status === 'idle' || status === 'stale' || status === 'error'
    })
  })

  // All dirs for consistent project colors
  let allDirs = $derived(
    [...new Set(chamberStore.tracked.map(s => s.directory).filter(Boolean))] as string[]
  )

  async function handleToggleHold(e: MouseEvent) {
    e.stopPropagation()
    await chamberStore.toggleHold(row.directory)
  }
</script>

<div 
  class={cn(
    'rounded-lg border transition-all duration-200',
    row.isHeld 
      ? 'bg-[var(--bg-secondary)]/50 border-[var(--border-subtle)] opacity-60' 
      : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]'
  )}
>
  <!-- Row header: project name + hold toggle -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
    <div class="flex items-center gap-2 min-w-0">
      <span 
        class="font-mono text-sm font-medium truncate"
        style="color: {getProjectColor(row.directory, allDirs)}"
      >
        {getProjectName(row.directory)}
      </span>
      <span class="text-xs text-[var(--fg-muted)]">
        {row.sessions.length} session{row.sessions.length !== 1 ? 's' : ''}
      </span>
    </div>
    <button
      type="button"
      onclick={handleToggleHold}
      class={cn(
        'p-1.5 rounded transition-colors',
        row.isHeld 
          ? 'text-[var(--accent-amber)] hover:text-[var(--accent-amber)]' 
          : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'
      )}
      title={row.isHeld ? 'Unmute notifications' : 'Mute notifications'}
    >
      {#if row.isHeld}
        <VolumeX class="w-4 h-4" />
      {:else}
        <Volume2 class="w-4 h-4" />
      {/if}
    </button>
  </div>

  <!-- Running / Idle zones -->
  <div class="p-2 flex flex-col md:flex-row gap-0 md:items-start md:divide-x-0">
    <!-- Running zone -->
    <div class="flex-1 min-h-[80px] pr-0 md:pr-1">
      <div class="text-[10px] uppercase tracking-wide text-emerald-500 mb-1 font-medium">
        Running
      </div>
      <div role="group" aria-label="Running sessions" class="cards-container">
        {#if runningSessions.length === 0}
          <div class="text-xs text-[var(--fg-muted)] italic py-2">No active</div>
        {:else}
          {#each runningSessions as session (session.id)}
            <div class="card-wrapper">
              <ChamberCard {session} />
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Idle zone -->
    <div class="flex-1 min-h-[80px] pt-2 md:pt-0 pl-0 md:pl-1 ml-0 border-0 shadow-none">
      <div class="text-[10px] uppercase tracking-wide text-amber-500 mb-1 font-medium">
        Idle
      </div>
      <div role="group" aria-label="Idle sessions" class="cards-container">
        {#if idleSessions.length === 0}
          <div class="text-xs text-[var(--fg-muted)] italic py-2">No idle</div>
        {:else}
          {#each idleSessions as session (session.id)}
            <div class="card-wrapper">
              <ChamberCard {session} />
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .cards-container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    padding: 4px;
    min-height: 100px;
  }

  .card-wrapper {
    flex: 1 1 180px;
    min-width: 180px;
    max-width: 100%;
    position: relative;
  }

  /* Zone transition: smooth fade + scale for cards moving between zones */
  :global(.chamber-zone-transition) {
    animation: zone-move 0.25s ease-out;
  }
  @keyframes zone-move {
    0% { opacity: 0.6; transform: scale(0.98); }
    100% { opacity: 1; transform: scale(1); }
  }
</style>
