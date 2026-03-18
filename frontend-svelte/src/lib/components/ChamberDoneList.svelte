<script lang="ts">
  import type { Session } from '$lib/types'
  import { chamberStore } from '$lib/chamber-store.svelte'
  import { formatRelativeTime, getProjectName, getProjectColor } from '$lib/utils'
  import SessionHoverCard from '$lib/components/SessionHoverCard.svelte'

  let allDirs = $derived(
    [...new Set(chamberStore.recentDone.map(s => s.directory).filter(Boolean))] as string[]
  )

  function openViewer(sessionId: string) {
    chamberStore.setSelected(sessionId)
  }

  let isHovering = $state<{ sessionId: string | null; top: number; left: number; direction: 'left' | 'right' }>({
    sessionId: null,
    top: 0,
    left: 0,
    direction: 'left'
  })
  let hoverHideTimer: ReturnType<typeof setTimeout> | null = null
  const HOVER_CARD_WIDTH = 440
  const HOVER_CARD_HEIGHT = 560

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

  function updateHoverPosition(target: HTMLElement) {
    const rect = target.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const spaceOnLeft = rect.left
    const centerY = rect.top + rect.height / 2
    const minTop = HOVER_CARD_HEIGHT / 2 + 16
    const maxTop = viewportHeight - HOVER_CARD_HEIGHT / 2 - 16

    if (spaceOnLeft > HOVER_CARD_WIDTH + 32) {
      isHovering.direction = 'left'
      isHovering.left = rect.left
      isHovering.top = Math.max(minTop, Math.min(maxTop, centerY))
    } else {
      isHovering.direction = 'right'
      isHovering.left = rect.right
      isHovering.top = Math.max(minTop, Math.min(maxTop, centerY))
    }
  }

  function showHoverCard(target: HTMLElement, sessionId: string) {
    clearHoverHideTimer()
    updateHoverPosition(target)
    isHovering.sessionId = sessionId
  }

  function handleMouseEnter(event: MouseEvent, sessionId: string) {
    showHoverCard(event.currentTarget as HTMLElement, sessionId)
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
          class="block p-2 rounded border transition-colors bg-[var(--bg-tertiary)] border-[var(--border-subtle)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)] w-full min-w-0"
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
    left={isHovering.left}
    top={isHovering.top}
    placement={isHovering.direction}
    onmouseenter={handleHoverCardEnter}
    onmouseleave={handleHoverCardLeave}
  />
{/if}
