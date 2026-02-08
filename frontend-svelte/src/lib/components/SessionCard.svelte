<script lang="ts">
  import type { Session } from '$lib/types'
  import { store } from '$lib/store.svelte'
  import { formatRelativeTime, formatTokens, formatCost, getProjectName, cn } from '$lib/utils'
  import { Activity, Clock, CircleCheck, Moon, AlertCircle } from 'lucide-svelte'
  
  interface Props {
    session: Session
    selected?: boolean
  }
  
  let { session, selected = false }: Props = $props()
  
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
  
  // Status icon component mapping
  function getStatusIcon(status: string) {
    switch (status) {
      case 'active': return Activity
      case 'idle': return Moon
      case 'error': return AlertCircle
      case 'stale': return Clock
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
      default: return 'text-zinc-400'
    }
  }
  
  let StatusIcon = $derived(getStatusIcon(session.status))
  let statusColor = $derived(getStatusColor(session.status))
</script>

<a
  href="/sessions/{session.id}"
  class={cn(
    'block w-full text-left p-3 rounded-lg border transition-all duration-150',
    'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border)]',
    selected 
      ? 'bg-[var(--bg-tertiary)] border-[var(--accent-blue)]' 
      : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]',
    session.needs_attention ? 'ring-1 ring-[var(--accent-amber)]' : '',
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
    {#if session.needs_attention}
      <span class="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent-amber)]/20 text-[var(--accent-amber)]">
        ATTENTION
      </span>
    {/if}
  </div>

  <!-- Project, host & model -->
  <div class="flex items-center gap-2 text-xs text-[var(--fg-secondary)] mb-2 flex-wrap">
    <span class="mono truncate">{getProjectName(session.directory)}</span>
    <span class="text-[var(--fg-muted)]">•</span>
    <span class="mono">{session.hostname}</span>
    {#if modelName()}
      <span class="text-[var(--fg-muted)]">•</span>
      <span class="mono text-[var(--accent-blue)]">{modelName()}</span>
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
  <div class="flex items-center justify-between text-xs">
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
    0%, 100% { border-color: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.3); }
    50% { border-color: #34d399; box-shadow: 0 0 12px rgba(52, 211, 153, 0.5); }
  }
  
  .active-border {
    animation: border-glow 2s ease-in-out infinite;
    border-color: #10b981;
  }
</style>
