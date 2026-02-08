<script lang="ts">
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { getSession } from '$lib/api'
  import { formatRelativeTime, formatTokens, formatCost, getProjectName, cn } from '$lib/utils'
  import type { Session, TimelineEvent } from '$lib/types'
  import StatusDot from '$lib/components/StatusDot.svelte'
  import { marked } from 'marked'
  import DOMPurify from 'dompurify'
  import { store } from '$lib/store.svelte'
  import { PanelRight, ChevronRight, Users, Cpu } from 'lucide-svelte'
  
  // State
  let apiTimeline = $state<TimelineEvent[]>([]) // Initial data from API
  let loading = $state(true)
  let error = $state<string | null>(null)
  let timelineContainer: HTMLDivElement | undefined = $state()
  let showScrollButton = $state(false)
  let userScrolled = $state(false) // Track if user manually scrolled away
  let showSubagents = $state(false) // Toggle for subagent sidebar
  
  // Get session ID from route params
  let sessionId = $derived($page.params.id)
  
  // Derive session from store for live WebSocket updates
  let session = $derived(store.sessions.find(s => s.id === sessionId) ?? null)
  
  // Derive child sessions (subagents) for current session
  let subagents = $derived(store.sessions.filter(s => s.parent_session_id === sessionId))
  
  // Merge API timeline with store timeline (WebSocket updates)
  // Store events take priority for real-time updates
  let timeline = $derived.by(() => {
    if (!sessionId) return apiTimeline
    const storeEvents = store.timelines.get(sessionId) || []
    if (storeEvents.length === 0) return apiTimeline
    // Merge: API events + any new store events not in API
    const apiIds = new Set(apiTimeline.map(e => e.id))
    const newEvents = storeEvents.filter(e => !apiIds.has(e.id))
    return [...apiTimeline, ...newEvents].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  })
  
  // Event type icons (terminal-style)
  const eventIcons: Record<string, string> = {
    tool: '$',
    message: '>',
    user: '#',
    error: '!',
    permission: '*'
  }
  
  // Event type colors
  const eventColors: Record<string, string> = {
    tool: 'text-[var(--accent-blue)]',
    message: 'text-[var(--accent-green)]',
    user: 'text-[var(--accent-purple)]',
    error: 'text-[var(--accent-red)]',
    permission: 'text-[var(--accent-amber)]'
  }
  
  // Configure marked for safe rendering
  marked.setOptions({
    breaks: true,  // Convert \n to <br>
    gfm: true      // GitHub Flavored Markdown
  })
  
  // Render markdown to HTML with XSS sanitization
  function renderMarkdown(text: string): string {
    if (!text) return ''
    return DOMPurify.sanitize(marked.parse(text) as string)
  }
  
  // Check if near bottom of scroll container
  function isNearBottom(): boolean {
    if (!timelineContainer) return true
    const threshold = 200
    const { scrollTop, scrollHeight, clientHeight } = timelineContainer
    return scrollHeight - scrollTop - clientHeight < threshold
  }
  
  // Handle scroll events to show/hide button
  function handleScroll() {
    const nearBottom = isNearBottom()
    showScrollButton = !nearBottom
    // If user scrolled away from bottom, mark as user-scrolled
    if (!nearBottom) {
      userScrolled = true
    }
  }
  
  // Smooth scroll to bottom
  function scrollToBottom() {
    if (!timelineContainer) return
    userScrolled = false
    timelineContainer.scrollTo({
      top: timelineContainer.scrollHeight,
      behavior: 'smooth'
    })
  }
  
  // Load session data
  async function loadSession() {
    if (!sessionId) return
    loading = true
    error = null
    try {
      const data = await getSession(sessionId)
      // Seed session into store if not present
      if (!store.sessions.find(s => s.id === sessionId)) {
        store.addSession(data.session)
      }
      apiTimeline = data.timeline
      // Also seed store timeline for merging with WebSocket updates
      store.setTimeline(sessionId, data.timeline)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load session'
    } finally {
      loading = false
    }
  }
  
  // Auto-scroll to bottom when timeline updates (only if user hasn't scrolled away)
  $effect(() => {
    if (timeline.length > 0 && timelineContainer && !userScrolled) {
      timelineContainer.scrollTop = timelineContainer.scrollHeight
    }
  })
  
  onMount(() => {
    loadSession()
  })
</script>

<!-- Markdown styles for rendered content -->
<svelte:head>
  <style>
    /* Markdown content styling */
    .markdown-content :global(p) {
      margin: 0.25em 0;
    }
    .markdown-content :global(code) {
      background: var(--bg-tertiary);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.85em;
    }
    .markdown-content :global(pre) {
      background: var(--bg-primary);
      padding: 0.75em 1em;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0.5em 0;
      border: 1px solid var(--border-subtle);
    }
    .markdown-content :global(pre code) {
      background: none;
      padding: 0;
      font-size: 0.9em;
    }
    .markdown-content :global(ul), .markdown-content :global(ol) {
      margin: 0.25em 0;
      padding-left: 1.5em;
    }
    .markdown-content :global(li) {
      margin: 0.1em 0;
    }
    .markdown-content :global(blockquote) {
      border-left: 3px solid var(--accent-blue);
      margin: 0.5em 0;
      padding-left: 1em;
      color: var(--fg-muted);
    }
    .markdown-content :global(a) {
      color: var(--accent-blue);
      text-decoration: underline;
    }
    .markdown-content :global(strong) {
      color: var(--fg-primary);
    }
  </style>
</svelte:head>

<div class="h-full flex">
  <!-- Main content area -->
  <div class="flex-1 p-6 flex flex-col overflow-hidden">
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
          <div class="flex items-center gap-2">
            <!-- Subagent toggle button -->
            {#if subagents.length > 0}
              <button
                onclick={() => showSubagents = !showSubagents}
                class={cn(
                  'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors',
                  showSubagents 
                    ? 'bg-[var(--accent-purple)]/20 text-[var(--accent-purple)]' 
                    : 'bg-[var(--bg-tertiary)] text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'
                )}
              >
                <Users class="w-3.5 h-3.5" />
                <span>{subagents.length} subagent{subagents.length > 1 ? 's' : ''}</span>
              </button>
            {/if}
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
      <div class="flex-1 flex flex-col min-h-0 relative">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-medium text-[var(--fg-primary)]">Timeline</h2>
          <span class="text-xs text-[var(--fg-muted)] mono">{timeline.length} events</span>
        </div>

        <!-- Scrollable timeline list -->
        <div 
          bind:this={timelineContainer}
          onscroll={handleScroll}
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
                    <span class={cn('text-base shrink-0 mono font-bold', eventColors[event.event_type] || 'text-[var(--fg-muted)]')}>
                      {eventIcons[event.event_type] || '.'}
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
                      
                      <!-- Render content based on event type -->
                      {#if event.event_type === 'tool'}
                        <!-- Tool events: monospace with $ prefix -->
                        <p class="text-sm text-[var(--fg-secondary)] mono break-words">
                          <span class="text-[var(--accent-blue)]">$</span> {event.summary}
                        </p>
                      {:else if event.event_type === 'error'}
                        <!-- Error events: red text -->
                        <p class="text-sm text-[var(--accent-red)] break-words">
                          {event.summary}
                        </p>
                      {:else if event.event_type === 'message' || event.event_type === 'user'}
                        <!-- Message/User events: render as markdown -->
                        <div class="text-sm text-[var(--fg-secondary)] break-words markdown-content">
                          {@html renderMarkdown(event.summary)}
                        </div>
                      {:else}
                        <!-- Default: plain text -->
                        <p class="text-sm text-[var(--fg-secondary)] break-words">
                          {event.summary}
                        </p>
                      {/if}
                      
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
        
        <!-- Scroll to bottom button -->
        {#if showScrollButton}
          <button
            onclick={scrollToBottom}
            class="absolute bottom-4 right-4 px-3 py-2 bg-[var(--accent-blue)] text-white text-xs font-medium rounded-lg shadow-lg hover:bg-[var(--accent-blue)]/80 transition-all flex items-center gap-2"
          >
            <span>↓</span>
            <span>Scroll to bottom</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Right sidebar: Subagents -->
  {#if showSubagents && subagents.length > 0}
    <aside class="w-64 h-full flex flex-col bg-[var(--bg-secondary)] border-l border-[var(--border-subtle)] overflow-hidden transition-all duration-300 ease-in-out">
      <!-- Header -->
      <div class="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Cpu class="w-4 h-4 text-[var(--accent-purple)]" />
          <span class="text-sm font-medium text-[var(--fg-primary)]">Subagents</span>
        </div>
        <button
          onclick={() => showSubagents = false}
          class="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] transition-colors"
        >
          <PanelRight class="w-4 h-4" />
        </button>
      </div>
      
      <!-- Subagent list -->
      <div class="flex-1 overflow-y-auto py-2">
        {#each subagents as subagent}
          <a
            href="/sessions/{subagent.id}"
            class="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <StatusDot status={subagent.status} size="sm" />
            <div class="flex-1 min-w-0">
              <div class="text-sm text-[var(--fg-primary)] truncate">
                {subagent.title || 'Subagent'}
              </div>
              <div class="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                <span class="mono">{formatTokens(subagent.token_total || 0)}</span>
                <span>tokens</span>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-[var(--fg-muted)]" />
          </a>
        {/each}
      </div>
    </aside>
  {/if}
</div>
