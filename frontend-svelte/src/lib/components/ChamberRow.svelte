<script lang="ts">
  import type { Session } from '$lib/types'
  import { chamberStore } from '$lib/chamber-store.svelte'
  import { getProjectName, getProjectColor, cn } from '$lib/utils'
  import ChamberCard from '$lib/components/ChamberCard.svelte'
  import { VolumeX, Volume2 } from 'lucide-svelte'
  import { crossfade } from 'svelte/transition'

  interface Props {
    row: {
      directory: string
      sessions: Session[]
      isHeld: boolean
    }
  }

  let { row }: Props = $props()
  let runningExpanded = $state(false)
  let idleExpanded = $state(false)

  const [send, receive] = crossfade({
    duration: 180,
    fallback: () => ({ duration: 120 })
  })

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
  <div class="p-2 flex flex-col md:flex-row gap-2">
    <!-- Running zone -->
    <div class="flex-1 min-h-[80px]">
      <div class="text-[10px] uppercase tracking-wide text-emerald-500 mb-1 font-medium">
        Running
      </div>
      <div 
        class="relative"
        role="group"
        aria-label="Running sessions"
        onmouseenter={() => runningExpanded = true}
        onmouseleave={() => runningExpanded = false}
      >
        {#if runningSessions.length === 0}
          <div class="text-xs text-[var(--fg-muted)] italic py-2">No active</div>
        {:else if runningSessions.length === 1}
          <ChamberCard session={runningSessions[0]} />
        {:else}
          <!-- Stacked cards: pages in a book metaphor -->
          <div class="relative">
            {#each runningSessions.slice(0, runningExpanded ? runningSessions.length : 3) as session, i (session.id)}
              <div 
                class="card-stack"
                in:receive={{ key: session.id }}
                out:send={{ key: session.id }}
                style={runningExpanded
                  ? `margin-top: 8px; z-index: ${runningSessions.length - i}`
                  : `transform: translateX(${i * 5}px) translateY(${i * 1}px) rotate(${-0.2 * i}deg); z-index: ${runningSessions.length - i}`
                }
              >
                <ChamberCard {session} />
              </div>
            {/each}
            {#if !runningExpanded && runningSessions.length > 3}
              <div class="text-xs text-[var(--fg-muted)] mt-1 pl-2">
                +{runningSessions.length - 3} more
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Idle zone -->
    <div class="flex-1 min-h-[80px] md:pl-2 pt-2 md:pt-0">
      <div class="text-[10px] uppercase tracking-wide text-amber-500 mb-1 font-medium">
        Idle
      </div>
      <div 
        class="relative"
        role="group"
        aria-label="Idle sessions"
        onmouseenter={() => idleExpanded = true}
        onmouseleave={() => idleExpanded = false}
      >
        {#if idleSessions.length === 0}
          <div class="text-xs text-[var(--fg-muted)] italic py-2">No idle</div>
        {:else if idleSessions.length === 1}
          <ChamberCard session={idleSessions[0]} />
        {:else}
          <!-- Stacked cards: pages in a book metaphor -->
          <div class="relative">
            {#each idleSessions.slice(0, idleExpanded ? idleSessions.length : 3) as session, i (session.id)}
              <div 
                class="card-stack"
                in:receive={{ key: session.id }}
                out:send={{ key: session.id }}
                style={idleExpanded
                  ? `margin-top: 8px; z-index: ${idleSessions.length - i}`
                  : `transform: translateX(${i * 5}px) translateY(${i * 1}px) rotate(${-0.2 * i}deg); z-index: ${idleSessions.length - i}`
                }
              >
                <ChamberCard {session} />
              </div>
            {/each}
            {#if !idleExpanded && idleSessions.length > 3}
              <div class="text-xs text-[var(--fg-muted)] mt-1 pl-2">
                +{idleSessions.length - 3} more
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .card-stack {
    transition: transform 0.15s ease-out, margin 0.15s ease-out;
  }
</style>
