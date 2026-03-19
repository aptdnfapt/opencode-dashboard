<script lang="ts">
  import type { Session } from '$lib/types'
  import { chamberStore } from '$lib/chamber-store.svelte'
  import { store } from '$lib/store.svelte'
  import { formatRelativeTime, formatTokens, formatCost, cn } from '$lib/utils'
  import { Archive, CheckCircle, X, GitBranch, StickyNote, Activity, Moon, AlertCircle, Clock } from 'lucide-svelte'
  import { markSessionDone, setSessionTracked, archiveSession } from '$lib/api'
  import SessionHoverCard from '$lib/components/SessionHoverCard.svelte'
  import { getFloatingPosition, type FloatingPosition } from '$lib/actions/floating'

  interface Props {
    session: Session
  }

  let { session }: Props = $props()
  let menuOpen = $state(false)
  let isHovering = $state(false)
  let floatingPosition = $state<FloatingPosition>({ x: 0, y: 0, placement: 'left' })
  let hoverHideTimer: ReturnType<typeof setTimeout> | null = null
  let cardRef = $state<HTMLElement | null>(null)
  let hoverCardRef = $state<HTMLDivElement | null>(null)

  // Compute effective status
  let displayStatus = $derived.by(() => {
    void chamberStore.tick
    return chamberStore.getEffectiveStatus(session)
  })

  // Sub-agents
  let subAgents = $derived(
    chamberStore.tracked.filter(s => s.parent_session_id === session.id)
  )
  let activeSubAgents = $derived(subAgents.filter(s => s.status === 'active').length)
  let idleSubAgents = $derived(subAgents.filter(s => s.status !== 'active').length)

  // Model name from session
  let modelName = $derived((session as unknown as { model_id?: string | null }).model_id || null)

  let timeline = $derived(store.timelines.get(session.id) || [])
  let latestMessage = $derived.by(() => {
    const last = timeline[timeline.length - 1]
    if (!last?.summary) return ''
    return last.summary.length > 60 ? `${last.summary.slice(0, 60)}...` : last.summary
  })

  // Status icon component mapping
  function getStatusIcon(status: string) {
    switch (status) {
      case 'active': return Activity
      case 'idle': return Moon
      case 'idle-with-subagents': return Moon
      case 'error': return AlertCircle
      case 'stale': return Clock
      default: return Activity
    }
  }

  // Status color classes
  function getStatusColor(status: string) {
    switch (status) {
      case 'active': return 'text-emerald-500'
      case 'idle': return 'text-amber-500'
      case 'idle-with-subagents': return 'text-blue-500'
      case 'error': return 'text-rose-500'
      case 'stale': return 'text-zinc-500'
      default: return 'text-zinc-400'
    }
  }

  let StatusIcon = $derived(getStatusIcon(displayStatus))
  let statusColor = $derived(getStatusColor(displayStatus))

  function clearHoverHideTimer() {
    if (hoverHideTimer) {
      clearTimeout(hoverHideTimer)
      hoverHideTimer = null
    }
  }

  async function updateFloatingPosition() {
    if (!cardRef || !hoverCardRef) return
    const pos = await getFloatingPosition(cardRef, hoverCardRef, {
      placement: 'left-start',
      offset: 8,
      padding: 8
    })
    floatingPosition = pos
  }

  function showHoverCard() {
    clearHoverHideTimer()
    isHovering = true
  }

  function handleMouseEnter() {
    showHoverCard()
  }

  function scheduleHoverHide() {
    clearHoverHideTimer()
    hoverHideTimer = setTimeout(() => { isHovering = false }, 120)
  }

  function handleMouseLeave() {
    scheduleHoverHide()
  }

  function handleHoverCardEnter() {
    clearHoverHideTimer()
    isHovering = true
  }

  function handleHoverCardLeave() {
    scheduleHoverHide()
  }

  // Context menu actions
  async function handleDone(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = false
    try {
      await markSessionDone(session.id)
      chamberStore.removeTracked(session.id)
      chamberStore.addToRecentDone(session)
    } catch (err) {
      console.warn('Failed to mark done:', err)
    }
  }

  async function handleRemove(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = false
    try {
      await setSessionTracked(session.id, { isTracked: false })
      chamberStore.removeTracked(session.id)
    } catch (err) {
      console.warn('Failed to remove:', err)
    }
  }

  async function handleArchive(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = false
    try {
      await archiveSession(session.id)
      chamberStore.removeTracked(session.id)
    } catch (err) {
      console.warn('Failed to archive:', err)
    }
  }

  function toggleMenu(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = !menuOpen
  }

  function openViewer() {
    chamberStore.setSelected(session.id)
  }

  // Update position when hover becomes visible
  $effect(() => {
    if (isHovering && cardRef && hoverCardRef) {
      updateFloatingPosition()
    }
  })
</script>

<!-- ChamberCard: card for Chamber live board with SessionCard-style layout -->
<div
  bind:this={cardRef}
  role="button"
  tabindex="0"
  onclick={openViewer}
  onkeydown={(e) => e.key === 'Enter' && openViewer()}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  class={cn(
    'chamber-card flex flex-col w-full text-left p-2.5 rounded-lg border relative',
    'hover:bg-[var(--bg-hover)] hover:border-[var(--border)]',
    displayStatus === 'active' && 'bg-[var(--bg-secondary)] border-emerald-500/50 chamber-running',
    displayStatus === 'idle' && 'bg-[var(--bg-secondary)] border-amber-500/50 chamber-idle',
    displayStatus === 'idle-with-subagents' && 'bg-[var(--bg-secondary)] border-blue-500/50 chamber-blue-idle',
    displayStatus === 'error' && 'bg-[var(--bg-secondary)] border-rose-500/50 chamber-error',
    displayStatus === 'stale' && 'bg-[var(--bg-secondary)] border-zinc-500/50',
    session.needs_attention ? 'ring-1 ring-amber-400 attention-ring' : ''
  )}
>
  <!-- Header: status icon + title + menu -->
  <div class="flex items-start justify-between gap-2 mb-1.5">
    <div class="flex items-center gap-1.5 min-w-0">
      <StatusIcon class="w-3.5 h-3.5 shrink-0 {statusColor}" />
      <span class="font-medium text-xs truncate text-[var(--fg-primary)]">
        {session.title || 'Untitled'}
      </span>
    </div>
    <div class="relative shrink-0">
      <button
        type="button"
        onclick={toggleMenu}
        title="Session actions"
        class="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] transition-colors"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
      {#if menuOpen}
        <div 
          role="menu"
          tabindex="-1"
          class="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg py-1 min-w-[120px]"
          style="box-shadow: var(--shadow-lg);"
        >
          <button
            type="button"
            onclick={handleDone}
            class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <CheckCircle class="w-3.5 h-3.5" />
            Mark Done
          </button>
          <button
            type="button"
            onclick={handleRemove}
            class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X class="w-3.5 h-3.5" />
            Remove
          </button>
          <button
            type="button"
            onclick={handleArchive}
            class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <Archive class="w-3.5 h-3.5" />
            Archive
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if session.needs_attention}
    <div class="mb-1.5">
      <span class="shrink-0 px-1.5 py-0.5 text-[9px] font-medium rounded bg-[var(--accent-amber)]/20 text-[var(--accent-amber)]">
        ATTENTION
      </span>
    </div>
  {/if}

  <!-- Meta: hostname + model + subagents + notes -->
  <div class="flex items-center gap-1.5 text-[10px] text-[var(--fg-secondary)] mb-1.5 flex-wrap">
    <span class="mono truncate">{session.hostname}</span>
    {#if modelName}
      <span class="text-[var(--fg-muted)]">•</span>
      <span class="mono text-[var(--accent-blue)]">{modelName}</span>
    {/if}
    {#if subAgents.length > 0}
      <span class="text-[var(--fg-muted)]">•</span>
      <span class="inline-flex items-center gap-0.5 mono">
        <GitBranch class="w-2.5 h-2.5 text-[var(--fg-secondary)]" />
        {#if activeSubAgents > 0}
          <span class="text-emerald-500">{activeSubAgents}↑</span>
        {/if}
        {#if idleSubAgents > 0}
          <span class="text-[var(--fg-muted)]">{idleSubAgents}✓</span>
        {/if}
      </span>
    {/if}
    {#if session.notes_count && session.notes_count > 0}
      <span class="text-[var(--fg-muted)]">•</span>
      <span class="inline-flex items-center gap-0.5 mono text-[var(--accent-amber)]">
        <StickyNote class="w-2.5 h-2.5" />
        <span>{session.notes_count}</span>
      </span>
    {/if}
  </div>

  <!-- Message preview -->
  {#if latestMessage}
    <div class="mb-1.5 h-4 overflow-hidden">
      <p class="text-[10px] truncate text-[var(--fg-secondary)]">
        {latestMessage}
      </p>
    </div>
  {/if}

  <!-- Footer: tokens + cost + time -->
  <div class="flex items-center justify-between text-[10px] mt-auto">
    <div class="flex items-center gap-2 text-[var(--fg-muted)]">
      <span class="mono">{formatTokens(session.token_total || 0)} tok</span>
      <span class="mono">{formatCost(session.cost_total || 0)}</span>
    </div>
    <span class="mono text-[var(--fg-muted)]">{formatRelativeTime(session.updated_at)}</span>
  </div>
</div>

{#if isHovering}
  <SessionHoverCard
    {session}
    bind:floatingEl={hoverCardRef}
    x={floatingPosition.x}
    y={floatingPosition.y}
    placement={floatingPosition.placement}
    onmouseenter={handleHoverCardEnter}
    onmouseleave={handleHoverCardLeave}
  />
{/if}

<style>
  /* Running: green spinning border */
  .chamber-running {
    position: relative;
  }
  .chamber-running::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    padding: 2px;
    background: conic-gradient(
      from var(--chamber-angle, 0deg),
      #10b981,
      transparent 30%,
      transparent 70%,
      #10b981
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: chamber-spin 2s linear infinite;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes chamber-spin {
    to { --chamber-angle: 360deg; }
  }
  @property --chamber-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  /* Idle: yellow pulse */
  .chamber-idle {
    animation: chamber-idle-glow 2.5s ease-in-out infinite;
  }
  @keyframes chamber-idle-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(234, 179, 8, 0.2); }
    50% { box-shadow: 0 0 8px rgba(234, 179, 8, 0.4); }
  }

  /* Idle + subagents: blue spinning */
  .chamber-blue-idle {
    position: relative;
  }
  .chamber-blue-idle::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    padding: 2px;
    background: conic-gradient(
      from var(--blue-angle, 0deg),
      #3b82f6,
      transparent 30%,
      transparent 70%,
      #3b82f6
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: chamber-blue-spin 2s linear infinite;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes chamber-blue-spin {
    to { --blue-angle: 360deg; }
  }
  @property --blue-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  /* Error: red pulse */
  .chamber-error {
    animation: chamber-error-glow 2s ease-in-out infinite;
  }
  @keyframes chamber-error-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); }
    50% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
  }

  /* Attention ring pulse */
  .attention-ring::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 0 0 1px var(--accent-amber), 0 0 8px rgba(210, 153, 34, 0.3);
    pointer-events: none;
    animation: attention-glow 2.5s ease-in-out infinite;
  }
  @keyframes attention-glow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  /* Fade wave effect on hover */
  .chamber-card {
    transition: background-color 0.5s ease, border-color 0.5s ease;
  }

  .chamber-card:hover {
    transition: background-color 0s, border-color 0s;
  }
</style>