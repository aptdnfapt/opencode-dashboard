<script lang="ts">
  import { chamberStore } from '$lib/chamber-store.svelte'
  import { formatRelativeTime, getProjectName, getProjectColor } from '$lib/utils'
  import SessionHoverCard from '$lib/components/SessionHoverCard.svelte'
  import { getFloatingPositionSideOnly, type FloatingPosition } from '$lib/actions/floating'

  let allDirs = $derived(
    [...new Set(chamberStore.recentDone.map(s => s.directory).filter(Boolean))] as string[]
  )

  function openViewer(sessionId: string) {
    chamberStore.setSelected(sessionId)
  }

  let isHovering = $state<{ sessionId: string | null }>({ sessionId: null })
  let floatingPosition = $state<FloatingPosition>({ x: 0, y: 0, placement: 'left' })
  let hoverHideTimer: ReturnType<typeof setTimeout> | null = null
  let buttonRefs = $state<Map<string, HTMLButtonElement>>(new Map())
  let hoverCardRef = $state<HTMLDivElement | null>(null)

  let hoverSession = $derived.by(() => {
    if (!isHovering.sessionId) return null
    return chamberStore.recentDone.find(s => s.id === isHovering.sessionId)
  })

  function clearHoverHideTimer() {
    if (hoverHideTimer) {
      clearTimeout(hoverHideTimer)
      hoverHideTimer = null
    }
  }

  async function updateFloatingPosition(sessionId: string) {
    const buttonEl = buttonRefs.get(sessionId)
    if (!buttonEl || !hoverCardRef) return
    const pos = await getFloatingPositionSideOnly(buttonEl, hoverCardRef, {
      placement: 'left-start',
      offset: 8,
      padding: 8
    })
    floatingPosition = pos
  }

  function showHoverCard(sessionId: string) {
    clearHoverHideTimer()
    isHovering.sessionId = sessionId
  }

  function handleMouseEnter(event: MouseEvent, sessionId: string) {
    const target = event.currentTarget as HTMLButtonElement
    buttonRefs.set(sessionId, target)
    showHoverCard(sessionId)
  }

  function scheduleHoverHide() {
    clearHoverHideTimer()
    hoverHideTimer = setTimeout(() => { isHovering.sessionId = null }, 120)
  }

  function handleMouseLeave() {
    scheduleHoverHide()
  }

  function handleHoverCardEnter() {
    clearHoverHideTimer()
  }

  function handleHoverCardLeave() {
    scheduleHoverHide()
  }

  // Update position when hover becomes visible
  $effect(() => {
    if (isHovering.sessionId) {
      updateFloatingPosition(isHovering.sessionId)
    }
  })
</script>

<div class="p-4">
  <h2 class="text-sm font-semibold text-[var(--fg-primary)] mb-3">
    Recently Completed
  </h2>

  {#if chamberStore.loadingDone}
    <div class="space-y-2">
      {#each Array(3) as _, i (i)}
        <div class="bg-[var(--bg-tertiary)] rounded p-2 h-16 animate-pulse"></div>
      {/each}
    </div>
  {:else if chamberStore.recentDone.length === 0}
    <div class="text-xs text-[var(--fg-muted)] text-center py-4">
      No completed sessions
    </div>
  {:else}
    <div class="space-y-2 overflow-x-hidden">
      {#each chamberStore.recentDone as session (session.id)}
        <button
          type="button"
          onclick={() => openViewer(session.id)}
          onmouseenter={(e) => handleMouseEnter(e, session.id)}
          onmouseleave={handleMouseLeave}
          class="done-item block p-2 rounded border bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:bg-[#2a2a2a] w-full min-w-0"
        >
          <div class="flex items-start justify-between gap-2 mb-1">
            <span class="text-sm font-medium truncate text-[var(--fg-primary)] max-w-[60%]">
              {session.title || 'Untitled'}
            </span>
            <span class="text-[10px] mono text-[var(--fg-muted)] shrink-0">
              {formatRelativeTime(session.completed_at || session.updated_at)}
            </span>
          </div>
          <div class="flex items-center gap-2 text-[10px] overflow-hidden">
            <span 
              class="mono truncate"
              style="color: {getProjectColor(session.directory || '', allDirs)}"
            >
              {getProjectName(session.directory)}
            </span>
            {#if session.group_tag}
              <span class="px-1 py-0.5 rounded bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] shrink-0">
                {session.group_tag}
              </span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if isHovering.sessionId && hoverSession}
  <SessionHoverCard
    session={hoverSession}
    bind:floatingEl={hoverCardRef}
    x={floatingPosition.x}
    y={floatingPosition.y}
    placement={floatingPosition.placement}
    onmouseenter={handleHoverCardEnter}
    onmouseleave={handleHoverCardLeave}
  />
{/if}

<style>
  .done-item {
    transition: background-color 0.6s ease;
    cursor: pointer;
  }

  .done-item:hover {
    background-color: #2a2a2a;
    transition: background-color 0s;
  }
</style>