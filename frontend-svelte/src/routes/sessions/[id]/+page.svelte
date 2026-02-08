<script lang="ts">
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { getSession } from '$lib/api'
  import { formatRelativeTime, formatTokens, formatCost, getProjectName, cn } from '$lib/utils'
  import type { Session, TimelineEvent } from '$lib/types'
  import StatusDot from '$lib/components/StatusDot.svelte'
  
  // State
  let session = $state<Session | null>(null)
  let timeline = $state<TimelineEvent[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let timelineContainer: HTMLDivElement | undefined = $state()
  
  // Get session ID from route params
  let sessionId = $derived($page.params.id)
  
  // Event type icons (terminal-style)
  const eventIcons: Record<string, string> = {
    tool: '⚙',
    message: '💬',
    user: '👤',
    error: '✗',
    permission: '🔐'
  }
  
  // Event type colors
  const eventColors: Record<string, string> = {
    tool: 'text-[var(--accent-blue)]',
    message: 'text-[var(--accent-green)]',
    user: 'text-[var(--accent-purple)]',
    error: 'text-[var(--accent-red)]',
    permission: 'text-[var(--accent-amber)]'
  }
  
  // Load session data
  async function loadSession() {
    if (!sessionId) return
    loading = true
    error = null
    try {
      const data = await getSession(sessionId)
      session = data.session
      timeline = data.timeline
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load session'
    } finally {
      loading = false
    }
  }
  
  // Auto-scroll to bottom when timeline updates
  $effect(() => {
    if (timeline.length > 0 && timelineContainer) {
      timelineContainer.scrollTop = timelineContainer.scrollHeight
    }
  })
  
  onMount(() => {
    loadSession()
  })
</script>

<div class="p-6 h-full flex flex-col">
  <!-- Back link -->
  <a 
    href="/" 
    class="inline-flex items-center gap-2 text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors mb-4"
  >
    <span>←</span>
    <span>Back to sessions</span>
  </a>

  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <span class="text-[var(--fg-muted)]">Loading session...</span>
    </div>
  {:else if error}
    <div class="flex-1 flex items-center justify-center">
      <span class="text-[var(--accent-red)]">{error}</span>
    </div>
  {:else if session}
    <!-- Session Header -->
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 mb-4">
      <!-- Title & Status -->
      <div class="flex items-start justify-between gap-4 mb-3">
        <div class="flex items-center gap-3">
          <StatusDot status={session.status} size="md" />
          <h1 class="text-lg font-semibold text-[var(--fg-primary)]">
            {session.title || 'Untitled Session'}
          </h1>
        </div>
        <span class={cn(
          'px-2 py-1 text-xs font-medium rounded uppercase',
          session.status === 'active' && 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]',
          session.status === 'idle' && 'bg-[var(--accent-amber)]/20 text-[var(--accent-amber)]',
          session.status === 'error' && 'bg-[var(--accent-red)]/20 text-[var(--accent-red)]',
          session.status === 'stale' && 'bg-[var(--fg-muted)]/20 text-[var(--fg-muted)]'
        )}>
          {session.status}
        </span>
      </div>

      <!-- Meta info grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span class="block text-[var(--fg-muted)] text-xs mb-1">Hostname</span>
          <span class="mono text-[var(--fg-secondary)]">{session.hostname}</span>
        </div>
        <div>
          <span class="block text-[var(--fg-muted)] text-xs mb-1">Directory</span>
          <span class="mono text-[var(--fg-secondary)] truncate block" title={session.directory || ''}>
            {getProjectName(session.directory)}
          </span>
        </div>
        <div>
          <span class="block text-[var(--fg-muted)] text-xs mb-1">Tokens</span>
          <span class="mono text-[var(--accent-blue)]">{formatTokens(session.token_total || 0)}</span>
        </div>
        <div>
          <span class="block text-[var(--fg-muted)] text-xs mb-1">Cost</span>
          <span class="mono text-[var(--accent-green)]">{formatCost(session.cost_total || 0)}</span>
        </div>
      </div>
    </div>

    <!-- Timeline Section -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-medium text-[var(--fg-primary)]">Timeline</h2>
        <span class="text-xs text-[var(--fg-muted)] mono">{timeline.length} events</span>
      </div>

      <!-- Scrollable timeline list -->
      <div 
        bind:this={timelineContainer}
        class="flex-1 overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg"
      >
        {#if timeline.length === 0}
          <div class="flex items-center justify-center h-full py-12">
            <span class="text-[var(--fg-muted)]">No events yet</span>
          </div>
        {:else}
          <div class="divide-y divide-[var(--border-subtle)]">
            {#each timeline as event (event.id)}
              <div class="p-3 hover:bg-[var(--bg-tertiary)] transition-colors">
                <div class="flex items-start gap-3">
                  <!-- Event icon -->
                  <span class={cn('text-base shrink-0', eventColors[event.event_type] || 'text-[var(--fg-muted)]')}>
                    {eventIcons[event.event_type] || '•'}
                  </span>
                  
                  <!-- Event content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class={cn(
                        'text-xs font-medium uppercase',
                        eventColors[event.event_type] || 'text-[var(--fg-muted)]'
                      )}>
                        {event.event_type}
                      </span>
                      {#if event.tool_name}
                        <span class="text-xs text-[var(--fg-muted)] mono">
                          {event.tool_name}
                        </span>
                      {/if}
                    </div>
                    <p class="text-sm text-[var(--fg-secondary)] break-words">
                      {event.summary}
                    </p>
                    {#if event.model_id}
                      <span class="text-xs text-[var(--fg-muted)] mono mt-1 block">
                        {event.model_id}
                      </span>
                    {/if}
                  </div>
                  
                  <!-- Timestamp -->
                  <span class="text-xs text-[var(--fg-muted)] mono shrink-0">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
