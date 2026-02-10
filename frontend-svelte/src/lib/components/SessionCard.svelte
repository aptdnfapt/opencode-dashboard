<script lang="ts">
  import type { Session } from '$lib/types'
  import { store } from '$lib/store.svelte'
  import { formatRelativeTime, formatTokens, formatCost, getProjectName, cn } from '$lib/utils'
  import { archiveSession, unarchiveSession } from '$lib/api'
  import { Activity, Clock, CircleCheck, Moon, AlertCircle, MoreVertical, Archive, ArchiveRestore, GitBranch } from 'lucide-svelte'
  
  // Idle > 3 min becomes stale
  const STALE_THRESHOLD_MS = 3 * 60 * 1000
  
  // Menu state
  let menuOpen = $state(false)
  
  interface Props {
    session: Session
    selected?: boolean
  }
  
  let { session, selected = false }: Props = $props()
  
  // Compute effective status: idle > 3min → stale (unless sub-agents are active)
  // Note: directly access store.sessions for Svelte reactivity tracking
  let displayStatus = $derived(() => {
    if (session.status === 'archived') return 'archived'
    if (session.status !== 'idle') return session.status
    const updatedAt = new Date(session.updated_at).getTime()
    const now = Date.now()
    const hasActiveSubs = store.sessions.some(s => s.parent_session_id === session.id && s.status === 'active')
    return (now - updatedAt) > STALE_THRESHOLD_MS && !hasActiveSubs ? 'stale' : 'idle'
  })
  
  // Archive/unarchive handlers
  async function handleArchive(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = false
    try {
      await archiveSession(session.id)
      store.updateSession({ id: session.id, status: 'archived' })
    } catch (err) {
      console.warn('Failed to archive:', err)
    }
  }
  
  async function handleUnarchive(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = false
    try {
      await unarchiveSession(session.id)
      store.updateSession({ id: session.id, status: 'idle' })
    } catch (err) {
      console.warn('Failed to unarchive:', err)
    }
  }
  
  function toggleMenu(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = !menuOpen
  }
  
  // Close menu when clicking outside
  function handleClickOutside(e: MouseEvent) {
    menuOpen = false
  }
  
  // Get timeline events for this session
  let timeline = $derived(store.timelines.get(session.id) || [])
  
  // Get latest message
  let latestMessage = $derived(() => {
    const last = timeline[timeline.length - 1]
    if (!last?.summary) return ''
    return last.summary.length > 50 ? last.summary.slice(0, 50) + '...' : last.summary
  })
  
  // Get model name from session (set by backend from token_usage)
  let modelName = $derived(() => {
    return (session as unknown as { model_id?: string | null }).model_id || null
  })
  
  // Track message changes for animation (only active sessions)
  let lastMessageId = $state<number | null>(null)
  let shouldAnimate = $state(false)
  
  // Trigger animation when new message arrives for active sessions
  $effect(() => {
    const last = timeline[timeline.length - 1]
    if (last && last.id !== lastMessageId) {
      lastMessageId = last.id
      if (session.status === 'active') {
        shouldAnimate = true
        // Reset animation flag after animation completes
        setTimeout(() => { shouldAnimate = false }, 300)
      }
    }
  })
  
  // Project color palette - consistent color per project name
  // Avoiding blue (model) and green (active status)
  const projectColors = [
    'var(--accent-amber)',
    'var(--accent-purple)',
    '#f97583',  // pink
    '#ff7b72',  // coral
    '#ffa657',  // orange
    '#d2a8ff',  // light purple
    '#e6b450',  // gold
    '#ffc0cb',  // light pink
  ]
  
  function getProjectColor(directory: string | null): string {
    if (!directory) return 'var(--fg-secondary)'
    // Simple hash to get consistent color per project
    let hash = 0
    for (let i = 0; i < directory.length; i++) {
      hash = ((hash << 5) - hash) + directory.charCodeAt(i)
      hash = hash & hash
    }
    return projectColors[Math.abs(hash) % projectColors.length]
  }

  // Status icon component mapping
  function getStatusIcon(status: string) {
    switch (status) {
      case 'active': return Activity
      case 'idle': return Moon
      case 'error': return AlertCircle
      case 'stale': return Clock
      case 'archived': return Archive
      default: return CircleCheck
    }
  }
  
  // Status color classes
  function getStatusColor(status: string) {
    switch (status) {
      case 'active': return 'text-emerald-500'
      case 'idle': return 'text-amber-500'
      case 'error': return 'text-rose-500'
      case 'stale': return 'text-zinc-500'
      case 'archived': return 'text-zinc-600'
      default: return 'text-zinc-400'
    }
  }
  
  // Count sub-agents for this session
  let subAgents = $derived(store.sessions.filter(s => s.parent_session_id === session.id))
  let activeSubAgents = $derived(subAgents.filter(s => s.status === 'active').length)
  let idleSubAgents = $derived(subAgents.filter(s => s.status !== 'active').length)

  let StatusIcon = $derived(getStatusIcon(displayStatus()))
  let statusColor = $derived(getStatusColor(displayStatus()))
</script>

<a
  href="/sessions/{session.id}"
  class={cn(
    'flex flex-col w-full h-full text-left p-3 rounded-lg border transition-all duration-200',
    'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border)]',
    selected 
      ? 'bg-[var(--bg-tertiary)] border-[var(--accent-blue)]' 
      : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]',
    session.needs_attention ? 'ring-1 ring-[var(--accent-amber)] attention-pulse' : '',
    session.status === 'active' ? 'active-border' : ''
  )}

>
  <!-- Header row -->
  <div class="flex items-start justify-between gap-2 mb-2">
    <div class="flex items-center gap-2 min-w-0">
      <StatusIcon class="w-4 h-4 shrink-0 {statusColor}" />
      <span class="font-medium text-sm truncate text-[var(--fg-primary)]">
        {session.title || 'Untitled'}
      </span>
    </div>
    <div class="flex items-center gap-1">
      {#if session.needs_attention}
        <span class="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent-amber)]/20 text-[var(--accent-amber)]">
          ATTENTION
        </span>
      {/if}
      <!-- 3-dot menu -->
      <div class="relative">
        <button
          type="button"
          onclick={toggleMenu}
          class="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors"
        >
          <MoreVertical class="w-4 h-4" />
        </button>
        {#if menuOpen}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg py-1 min-w-[130px]"
            style="box-shadow: var(--shadow-md);"
            onclick={(e) => e.stopPropagation()}
          >
            {#if session.status === 'archived'}
              <button
                type="button"
                onclick={handleUnarchive}
                class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <ArchiveRestore class="w-4 h-4" />
                Restore
              </button>
            {:else}
              <button
                type="button"
                onclick={handleArchive}
                class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Archive class="w-4 h-4" />
                Archive
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Project, host & model -->
  <div class="flex items-center gap-2 text-xs text-[var(--fg-secondary)] mb-2 flex-wrap">
    <span class="mono truncate" style="color: {getProjectColor(session.directory)}">{getProjectName(session.directory)}</span>
    <span class="text-[var(--fg-muted)]">•</span>
    <span class="mono">{session.hostname}</span>
    {#if modelName()}
      <span class="text-[var(--fg-muted)]">•</span>
      <span class="mono text-[var(--accent-blue)]">{modelName()}</span>
    {/if}
    {#if subAgents.length > 0}
      <span class="text-[var(--fg-muted)]">•</span>
      <span class="inline-flex items-center gap-1 mono">
        <GitBranch class="w-3 h-3 text-[var(--fg-secondary)]" />
        {#if activeSubAgents > 0}
          <span class="text-emerald-500">{activeSubAgents}↑</span>
        {/if}
        {#if idleSubAgents > 0}
          <span class="text-[var(--fg-muted)]">{idleSubAgents}✓</span>
        {/if}
      </span>
    {/if}
  </div>

  <!-- Message preview: live animation for active, static for idle -->
  {#if latestMessage()}
    <div class="mb-2 h-5 overflow-hidden">
      <p 
        class="text-xs truncate {session.status === 'active' ? 'text-[var(--fg-secondary)]' : 'text-[var(--fg-muted)]'}"
        class:animate-fade-in={shouldAnimate}
      >
        {latestMessage()}
      </p>
    </div>
  {/if}

  <!-- Footer: tokens, cost, time -->
  <div class="flex items-center justify-between text-xs mt-auto">
    <div class="flex items-center gap-3 text-[var(--fg-muted)]">
      <span class="mono">{formatTokens(session.token_total || 0)} tok</span>
      <span class="mono">{formatCost(session.cost_total || 0)}</span>
    </div>
    <span class="mono text-[var(--fg-muted)]">{formatRelativeTime(session.updated_at)}</span>
  </div>
</a>

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
  
  /* Animated gradient border for active sessions */
  @keyframes border-glow {
    0%, 100% { border-color: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.2); }
    50% { border-color: #34d399; box-shadow: 0 0 10px rgba(52, 211, 153, 0.35); }
  }
  
  .active-border {
    animation: border-glow 2.5s ease-in-out infinite;
    border-color: #10b981;
  }

  /* Subtle pulsing ring for attention state */
  @keyframes attention-ring {
    0%, 100% { box-shadow: 0 0 0 1px var(--accent-amber), 0 0 4px rgba(210, 153, 34, 0.15); }
    50% { box-shadow: 0 0 0 1px var(--accent-amber), 0 0 8px rgba(210, 153, 34, 0.3); }
  }

  .attention-pulse {
    animation: attention-ring 2.5s ease-in-out infinite;
  }
</style>
