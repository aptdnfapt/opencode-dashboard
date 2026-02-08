<script lang="ts">
  import type { Session } from '$lib/types'
  import { formatRelativeTime, formatTokens, formatCost, getProjectName, cn } from '$lib/utils'
  import StatusDot from './StatusDot.svelte'
  
  interface Props {
    session: Session
    selected?: boolean
  }
  
  let { session, selected = false }: Props = $props()
</script>

<a
  href="/sessions/{session.id}"
  class={cn(
    'block w-full text-left p-3 rounded-lg border transition-all duration-150',
    'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border)]',
    selected 
      ? 'bg-[var(--bg-tertiary)] border-[var(--accent-blue)]' 
      : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]',
    session.needs_attention ? 'ring-1 ring-[var(--accent-amber)]' : ''
  )}
>
  <!-- Header row -->
  <div class="flex items-start justify-between gap-2 mb-2">
    <div class="flex items-center gap-2 min-w-0">
      <StatusDot status={session.status} />
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

  <!-- Project & host -->
  <div class="flex items-center gap-2 text-xs text-[var(--fg-secondary)] mb-2">
    <span class="mono truncate">{getProjectName(session.directory)}</span>
    <span class="text-[var(--fg-muted)]">•</span>
    <span class="mono">{session.hostname}</span>
  </div>

  <!-- Footer: tokens, cost, time -->
  <div class="flex items-center justify-between text-xs">
    <div class="flex items-center gap-3 text-[var(--fg-muted)]">
      <span class="mono">{formatTokens(session.token_total || 0)} tok</span>
      <span class="mono">{formatCost(session.cost_total || 0)}</span>
    </div>
    <span class="mono text-[var(--fg-muted)]">{formatRelativeTime(session.updated_at)}</span>
  </div>
</a>
