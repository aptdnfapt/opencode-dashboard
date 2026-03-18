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

  // Crossfade for cards moving between zones
  const [send, receive] = crossfade({
    duration: 200,
    fallback: () => ({ duration: 150 })
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
  <div class="p-2 flex flex-col md:flex-row gap-0 md:items-start md:divide-x-0">
    <!-- Running zone -->
    <div class="flex-1 min-h-[80px] pr-0 md:pr-1">
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
          <div in:receive={{ key: runningSessions[0].id }} out:send={{ key: runningSessions[0].id }}>
            <ChamberCard session={runningSessions[0]} />
          </div>
        {:else}
          <div class="stack-shell">
            <div class="stack-surface" class:is-expanded={runningExpanded}>
              {#each runningSessions.slice(0, runningExpanded ? runningSessions.length : 3) as session, i (session.id)}
                <div
                  class="card-stack"
                  in:receive={{ key: session.id }}
                  out:send={{ key: session.id }}
                  style={`--stack-index:${i}; --stack-z:${runningSessions.length - i};`}
                >
                  <ChamberCard {session} />
                </div>
              {/each}
            </div>
            {#if !runningExpanded && runningSessions.length > 3}
              <div class="stack-more-indicator text-xs text-[var(--fg-muted)]">
                +{runningSessions.length - 3} more
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Idle zone -->
    <div class="flex-1 min-h-[80px] pt-2 md:pt-0 pl-0 md:pl-1 ml-0 border-0 shadow-none">
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
          <div in:receive={{ key: idleSessions[0].id }} out:send={{ key: idleSessions[0].id }}>
            <ChamberCard session={idleSessions[0]} />
          </div>
        {:else}
          <div class="stack-shell">
            <div class="stack-surface" class:is-expanded={idleExpanded}>
              {#each idleSessions.slice(0, idleExpanded ? idleSessions.length : 3) as session, i (session.id)}
                <div
                  class="card-stack"
                  in:receive={{ key: session.id }}
                  out:send={{ key: session.id }}
                  style={`--stack-index:${i}; --stack-z:${idleSessions.length - i};`}
                >
                  <ChamberCard {session} />
                </div>
              {/each}
            </div>
            {#if !idleExpanded && idleSessions.length > 3}
              <div class="stack-more-indicator text-xs text-[var(--fg-muted)]">
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
  .stack-shell {
    position: relative;
    min-height: 122px;
    padding-right: 20px;
    overflow: visible;
  }

  .stack-surface {
    position: relative;
    min-height: 110px;
    overflow: visible;
  }

  .card-stack {
    position: absolute;
    inset: 0 18px 0 0;
    z-index: var(--stack-z);
    transform: translate(calc(var(--stack-index) * 10px), calc(var(--stack-index) * 8px)) rotate(calc(var(--stack-index) * -1.4deg));
    transform-origin: bottom left;
    transition:
      transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1),
      z-index 0s 0.2s,
      filter 0.3s ease;
  }

  .stack-surface.is-expanded .card-stack {
    transform: translate(calc(var(--stack-index) * 58px), calc(var(--stack-index) * 10px)) rotate(calc(var(--stack-index) * 5deg));
  }

  .stack-surface.is-expanded .card-stack:hover {
    z-index: 30;
    transform: translate(calc(var(--stack-index) * 58px), calc((var(--stack-index) * 10px) - 18px)) rotate(calc(var(--stack-index) * 5deg)) scale(1.03);
    filter: brightness(1.04);
    transition:
      transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1),
      z-index 0s 0s,
      filter 0.3s ease;
  }

  .stack-more-indicator {
    position: absolute;
    left: 8px;
    bottom: -2px;
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
