<script lang="ts">
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { getSession } from '$lib/api'
  import { formatRelativeTime, formatTokens, formatCost, getProjectName, getProjectColor, cn } from '$lib/utils'
  import type { Session, TimelineEvent } from '$lib/types'
  import StatusDot from '$lib/components/StatusDot.svelte'
  import { marked } from 'marked'
  import DOMPurify from 'dompurify'
  import { store } from '$lib/store.svelte'
  import { ArrowLeft, Copy, Check, ChevronDown, ChevronRight, Cpu } from 'lucide-svelte'
  import SessionCard from '$lib/components/SessionCard.svelte'

  // State
  let apiTimeline = $state<TimelineEvent[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let timelineContainer: HTMLDivElement | undefined = $state()
  let showScrollButton = $state(false)
  let userScrolled = $state(false)
  let showFloatingHeader = $state(false)
  let showSubagentView = $state(false)
  let copyIdCopied = $state(false)
  let toolGroupExpanded = $state(new Set<number>())

  // Get session ID from route params
  let sessionId = $derived($page.params.id)

  // Derive session from store for live WebSocket updates
  let session = $derived(store.sessions.find(s => s.id === sessionId) ?? null)

  // Derive parent session (for back button when viewing sub-agent)
  let parentSession = $derived(session?.parent_session_id
    ? store.sessions.find(s => s.id === session.parent_session_id) ?? null
    : null
  )

  // Derive child sessions (subagents) for current session
  let subagents = $derived(store.sessions.filter(s => s.parent_session_id === sessionId))

  // Group timeline events into conversation turns
  let conversationTurns = $derived.by(() => {
    const turns: { user?: TimelineEvent; tools: TimelineEvent[]; message?: TimelineEvent }[] = []
    let currentTurn: { user?: TimelineEvent; tools: TimelineEvent[]; message?: TimelineEvent } = { tools: [] }

    for (const event of apiTimeline) {
      if (event.event_type === 'user') {
        if (currentTurn.user || currentTurn.tools.length > 0 || currentTurn.message) {
          turns.push(currentTurn)
        }
        currentTurn = { user: event, tools: [], message: undefined }
      } else if (event.event_type === 'tool') {
        currentTurn.tools.push(event)
      } else if (event.event_type === 'message' || event.event_type === 'error' || event.event_type === 'permission') {
        currentTurn.message = event
        turns.push(currentTurn)
        currentTurn = { tools: [] }
      }
    }

    if (currentTurn.user || currentTurn.tools.length > 0 || currentTurn.message) {
      turns.push(currentTurn)
    }

    return turns
  })

  // Get distinct models used in this session
  let distinctModels = $derived.by(() => {
    const models = new Set<string>()
    for (const event of apiTimeline) {
      if (event.model_id) {
        models.add(event.model_id)
      }
    }
    return Array.from(models)
  })

  // Check if session has active sub-agents
  let hasActiveSubAgents = $derived(session ? store.hasActiveSubAgents(session.id) : false)

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

  // Left-border colors for timeline events
  const eventBorderColors: Record<string, string> = {
    tool: 'border-l-[var(--accent-blue)]',
    message: 'border-l-[var(--accent-green)]',
    user: 'border-l-gray-500',
    error: 'border-l-[var(--accent-red)]',
    permission: 'border-l-[var(--accent-amber)]'
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

  // Format timestamp as "Feb 12, 2:19 PM"
  function formatAbsoluteTime(timestamp: number): string {
    const date = new Date(timestamp)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[date.getMonth()]
    const day = date.getDate()
    let hours = date.getHours()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month} ${day}, ${hours}:${minutes} ${ampm}`
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

  // Copy session ID to clipboard
  async function copySessionId() {
    if (!session) return
    try {
      await navigator.clipboard.writeText(session.id)
      copyIdCopied = true
      setTimeout(() => { copyIdCopied = false }, 2000)
    } catch (err) {
      console.warn('Failed to copy session ID:', err)
    }
  }

  // Toggle tool group expansion
  function toggleToolGroup(index: number) {
    const newExpanded = new Set(toolGroupExpanded)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    toolGroupExpanded = newExpanded
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
    if (apiTimeline.length > 0 && timelineContainer && !userScrolled) {
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
    .markdown-content :global(h1) {
      font-size: 1.75em;
      font-weight: 700;
      margin: 0.5em 0 0.3em 0;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 0.25em;
      color: var(--fg-primary);
    }
    .markdown-content :global(h2) {
      font-size: 1.5em;
      font-weight: 700;
      margin: 0.5em 0 0.3em 0;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 0.25em;
      color: var(--fg-primary);
    }
    .markdown-content :global(h3) {
      font-size: 1.25em;
      font-weight: 600;
      margin: 0.4em 0 0.25em 0;
      color: var(--fg-primary);
    }
    .markdown-content :global(h4) {
      font-size: 1.1em;
      font-weight: 600;
      margin: 0.3em 0 0.25em 0;
      color: var(--fg-primary);
    }
    .markdown-content :global(p) {
      margin: 0.5em 0;
      line-height: 1.6;
    }
    .markdown-content :global(code) {
      background: var(--bg-tertiary);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.85em;
      color: var(--accent-blue);
    }
    .markdown-content :global(pre) {
      background: var(--bg-primary);
      padding: 1em;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0.5em 0;
      border: 1px solid var(--border-subtle);
    }
    .markdown-content :global(pre code) {
      background: none;
      padding: 0;
      font-size: 0.9em;
      color: var(--fg-secondary);
    }
    .markdown-content :global(ul), .markdown-content :global(ol) {
      margin: 0.5em 0;
      padding-left: 1.5em;
      line-height: 1.6;
    }
    .markdown-content :global(li) {
      margin: 0.25em 0;
    }
    .markdown-content :global(blockquote) {
      border-left: 3px solid var(--accent-blue);
      margin: 0.5em 0;
      padding-left: 1em;
      color: var(--fg-muted);
      background: var(--bg-tertiary);
      padding: 0.5em 1em;
      border-radius: 0 6px 6px 0;
    }
    .markdown-content :global(a) {
      color: var(--accent-blue);
      text-decoration: underline;
    }
    .markdown-content :global(strong) {
      color: var(--fg-primary);
      font-weight: 600;
    }
    .markdown-content :global(table) {
      width: 100%;
      border-collapse: collapse;
      margin: 0.5em 0;
      font-size: 0.9em;
    }
    .markdown-content :global(th), .markdown-content :global(td) {
      border: 1px solid var(--border-subtle);
      padding: 0.5em 0.75em;
      text-align: left;
    }
    .markdown-content :global(th) {
      background: var(--bg-tertiary);
      font-weight: 600;
      color: var(--fg-primary);
    }
    .markdown-content :global(tr:nth-child(even)) {
      background: var(--bg-secondary);
    }
    .markdown-content :global(hr) {
      border: none;
      border-top: 1px solid var(--border-subtle);
      margin: 1em 0;
    }
  </style>
</svelte:head>

<div class="h-full flex flex-col bg-[var(--bg-primary)]">
  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <span class="text-[var(--fg-muted)]">Loading session...</span>
    </div>
  {:else if error}
    <div class="flex-1 flex items-center justify-center">
      <span class="text-[var(--accent-red)]">{error}</span>
    </div>
  {:else if session}
    <!-- Top bar: Back button + Floating header + Main/Sub toggle -->
    <div class="sticky top-0 z-40 px-4 py-3 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
      <div class="flex items-center justify-between gap-4">
        <!-- Back button -->
        <a
          href={session.parent_session_id ? `/sessions/${session.parent_session_id}` : '/'}
          class="flex items-center gap-2 text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>{session.parent_session_id ? 'Back to parent' : 'Back to sessions'}</span>
        </a>

        <!-- Main | Sub toggle (only show if subagents exist) -->
        {#if subagents.length > 0}
          <div class="flex items-center bg-[var(--bg-secondary)] rounded-lg p-1 border border-[var(--border-subtle)]">
            <button
              onclick={() => showSubagentView = false}
              class={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                !showSubagentView ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'
              )}
            >
              <span>Main</span>
            </button>
            <button
              onclick={() => showSubagentView = true}
              class={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                showSubagentView ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]'
              )}
            >
              <span>Sub</span>
              <span class="mono text-xs opacity-75">({subagents.length})</span>
            </button>
          </div>
        {/if}

        <!-- Floating frosted glass header -->
        <div
          class="group relative flex-1 max-w-2xl"
          onmouseenter={() => {}}
          onmouseleave={() => {}}
        >
          <!-- Compact mode (always visible) -->
          <div class="flex items-center gap-3 backdrop-blur-md bg-[var(--bg-secondary)]/80 rounded-lg px-4 py-2.5 border border-[var(--border-subtle)] transition-all duration-200 group-hover:shadow-lg">
            <!-- Status dot with glow styling -->
            <div class={cn(
              'flex items-center gap-2',
              session.status === 'active' ? 'text-emerald-500' : 
              session.status === 'idle' && hasActiveSubAgents ? 'text-blue-500' :
              session.status === 'idle' ? 'text-amber-500' :
              session.status === 'error' ? 'text-rose-500' : 'text-zinc-500'
            )}>
              <div class={cn(
                'w-2 h-2 rounded-full animate-pulse',
                session.status === 'active' ? 'bg-emerald-500' :
                session.status === 'idle' && hasActiveSubAgents ? 'bg-blue-500' :
                session.status === 'idle' ? 'bg-amber-500' :
                session.status === 'error' ? 'bg-rose-500' : 'bg-zinc-500'
              )}></div>
            </div>

            <!-- Title -->
            <h1 class="font-semibold text-[var(--fg-primary)] truncate">
              {session.title || 'Untitled Session'}
            </h1>

            <!-- Tokens and cost -->
            <div class="flex items-center gap-3 text-sm ml-auto">
              <span class="mono text-[var(--accent-blue)]">{formatTokens(session.token_total || 0)}</span>
              <span class="mono text-[var(--accent-green)]">{formatCost(session.cost_total || 0)}</span>
            </div>
          </div>

          <!-- Expanded mode (on hover) -->
          <div class="absolute top-full left-0 right-0 mt-1 backdrop-blur-md bg-[var(--bg-secondary)]/95 rounded-lg p-4 border border-[var(--border-subtle)] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <!-- Session ID with copy -->
              <div class="col-span-2 flex items-center justify-between">
                <span class="text-[var(--fg-muted)] text-xs mb-1">Session ID</span>
                <button
                  onclick={copySessionId}
                  class="flex items-center gap-1.5 px-2 py-1 text-xs mono text-[var(--accent-blue)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                >
                  {session.id.slice(0, 12)}…
                  {#if copyIdCopied}
                    <Check class="w-3 h-3 text-emerald-500" />
                  {:else}
                    <Copy class="w-3 h-3" />
                  {/if}
                </button>
              </div>

              <!-- Created time -->
              <div>
                <span class="block text-[var(--fg-muted)] text-xs mb-1">Created</span>
                <span class="mono text-[var(--fg-secondary)]">{formatAbsoluteTime(session.created_at)}</span>
              </div>

              <!-- Hostname -->
              <div>
                <span class="block text-[var(--fg-muted)] text-xs mb-1">Hostname</span>
                <span class="mono text-[var(--fg-secondary)]">{session.hostname}</span>
              </div>

              <!-- Directory -->
              <div class="col-span-2">
                <span class="block text-[var(--fg-muted)] text-xs mb-1">Directory</span>
                <span class="mono text-[var(--fg-secondary)] truncate block" title={session.directory || ''}>
                  {session.directory || 'N/A'}
                </span>
              </div>

              <!-- Models -->
              {#if distinctModels.length > 0}
                <div class="col-span-2">
                  <span class="block text-[var(--fg-muted)] text-xs mb-1">Models</span>
                  <div class="flex flex-wrap gap-2 mt-1">
                    {#each distinctModels as model}
                      <span class="px-2 py-0.5 text-xs mono bg-[var(--bg-tertiary)] text-[var(--accent-blue)] rounded-full border border-[var(--border-subtle)]">
                        {model}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main content area -->
    <div class="flex-1 overflow-hidden relative">
      {#if showSubagentView && subagents.length > 0}
        <!-- Sub-agent view: SessionCard grid -->
        <div class="p-4 h-full overflow-y-auto">
          <div class="flex items-center gap-2 mb-4">
            <Cpu class="w-5 h-5 text-[var(--accent-purple)]" />
            <h2 class="text-lg font-semibold text-[var(--fg-primary)]">Sub-agent Sessions</h2>
            <span class="px-2 py-0.5 text-xs mono bg-[var(--bg-tertiary)] text-[var(--fg-muted)] rounded-full">{subagents.length}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {#each subagents as subagent (subagent.id)}
              <SessionCard session={subagent} />
            {/each}
          </div>
        </div>
      {:else}
        <!-- Chat view: Conversation turns -->
        <div
          bind:this={timelineContainer}
          onscroll={handleScroll}
          class="h-full overflow-y-auto px-4 pb-4"
        >
          {#if conversationTurns.length === 0}
            <div class="flex items-center justify-center h-full py-12">
              <span class="text-[var(--fg-muted)]">No conversation yet</span>
            </div>
          {:else}
            <div class="max-w-4xl mx-auto space-y-4 pt-4">
              {#each conversationTurns as turn, turnIndex (turnIndex)}
                <!-- User message card -->
                {#if turn.user}
                  <div class="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-subtle)]">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-xs font-medium uppercase text-[var(--accent-purple)]">user</span>
                      <span class="text-xs text-[var(--fg-muted)] mono">
                        {formatRelativeTime(turn.user.timestamp)}
                      </span>
                    </div>
                    <div class="text-sm text-[var(--fg-secondary)] break-words markdown-content">
                      {@html renderMarkdown(turn.user.summary)}
                    </div>
                  </div>
                {/if}

                <!-- Collapsible tool calls block -->
                {#if turn.tools && turn.tools.length > 0}
                  <div class="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                    <button
                      onclick={() => toggleToolGroup(turnIndex)}
                      class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-medium uppercase text-[var(--accent-blue)]">tool calls</span>
                        <span class="text-xs text-[var(--fg-muted)] mono">
                          {turn.tools.length} {turn.tools.length === 1 ? 'call' : 'calls'}
                        </span>
                      </div>
                      {#if toolGroupExpanded.has(turnIndex)}
                        <ChevronDown class="w-4 h-4 text-[var(--fg-muted)]" />
                      {:else}
                        <ChevronRight class="w-4 h-4 text-[var(--fg-muted)]" />
                      {/if}
                    </button>

                    <div class:hidden={!toolGroupExpanded.has(turnIndex)} class="px-4 pb-3">
                      {#each turn.tools as tool (tool.id)}
                        <div class="py-2 border-b border-[var(--border-subtle)] last:border-0">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-[var(--accent-blue)]">$</span>
                            <span class="text-xs font-medium mono text-[var(--fg-secondary)]">
                              {tool.tool_name || 'unknown tool'}
                            </span>
                          </div>
                          <p class="text-sm text-[var(--fg-secondary)] mono break-words">
                            {tool.summary}
                          </p>
                          <span class="text-xs text-[var(--fg-muted)] mono mt-1 block">
                            {formatRelativeTime(tool.timestamp)}
                          </span>
                        </div>
                      {/each}
                    </div>

                    <!-- Collapsed preview: first and last tools -->
                    {#if !toolGroupExpanded.has(turnIndex)}
                      <div class="px-4 pb-2.5">
                        {#if turn.tools.length === 1}
                          <div class="text-sm text-[var(--fg-muted)]">
                            • <span class="mono">{turn.tools[0].tool_name}</span>
                          </div>
                        {:else}
                          <div class="text-sm text-[var(--fg-muted)] space-y-1">
                            <div>• <span class="mono">{turn.tools[0].tool_name}</span></div>
                            {#if turn.tools.length > 2}
                              <div class="text-xs text-[var(--fg-muted)] opacity-60">
                                … {turn.tools.length - 2} more
                              </div>
                            {/if}
                            {#if turn.tools.length > 1}
                              <div>• <span class="mono">{turn.tools[turn.tools.length - 1].tool_name}</span></div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}

                <!-- Assistant message card -->
                {#if turn.message}
                  <div class="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-subtle)]">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                      <span class="text-xs font-medium uppercase text-[var(--accent-green)]">message</span>
                      {#if turn.message.model_id}
                        <span class="px-1.5 py-0.5 text-xs mono bg-[var(--bg-tertiary)] text-[var(--accent-blue)] rounded border border-[var(--border-subtle)]">
                          {turn.message.model_id}
                        </span>
                      {/if}
                      <span class="text-xs text-[var(--fg-muted)] mono">
                        {formatRelativeTime(turn.message.timestamp)}
                      </span>
                    </div>

                    {#if turn.message.event_type === 'error'}
                      <p class="text-sm text-[var(--accent-red)] break-words">
                        {turn.message.summary}
                      </p>
                    {:else}
                      <div class="text-sm text-[var(--fg-secondary)] break-words markdown-content">
                        {@html renderMarkdown(turn.message.summary)}
                      </div>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Scroll to bottom button -->
    {#if showScrollButton}
      <button
        onclick={scrollToBottom}
        class="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--accent-blue)] text-white text-xs font-medium rounded-full shadow-lg shadow-black/25 hover:bg-[var(--accent-blue)]/80 transition-all flex items-center gap-2 z-30"
      >
        <span>↓</span>
        <span>Scroll to bottom</span>
      </button>
    {/if}
  {/if}
</div>
