<script lang="ts">
  import type { Session, TimelineEvent } from '$lib/types'
  import { chamberStore } from '$lib/chamber-store.svelte'
  import { store } from '$lib/store.svelte'
  import { getSession } from '$lib/api'
  import { formatTokens, formatCost, getProjectName } from '$lib/utils'
  import { StickyNote, GitBranch, GitPullRequest } from 'lucide-svelte'

  interface Props {
    session: Session
    x: number
    y: number
    placement?: 'left' | 'right' | 'top' | 'bottom'
    floatingEl?: HTMLDivElement | null
    onmouseenter?: (event: MouseEvent) => void
    onmouseleave?: (event: MouseEvent) => void
  }

  let {
    session,
    x,
    y,
    placement = 'left',
    floatingEl = $bindable(),
    onmouseenter,
    onmouseleave
  }: Props = $props()

  let fetchedTimeline = $state<TimelineEvent[] | null>(null)
  let fetchedSession = $state<Session | null>(null)
  let fetchError = $state(false)

  let displayStatus = $derived.by(() => {
    void chamberStore.tick
    return chamberStore.getEffectiveStatus(session)
  })

  let subAgents = $derived(chamberStore.tracked.filter((s) => s.parent_session_id === session.id))
  let activeSubAgents = $derived(subAgents.filter((s) => s.status === 'active').length)
  let idleSubAgents = $derived(subAgents.filter((s) => s.status !== 'active').length)
  let modelName = $derived(session.model_id || fetchedSession?.model_id || null)
  let projectName = $derived(session.directory ? getProjectName(session.directory) : 'Unknown')
  let timeline = $derived((store.timelines.get(session.id) || []).length > 0 ? (store.timelines.get(session.id) || []) : (fetchedTimeline || []))

  // Last 3 tool calls (most recent first)
  let lastToolCalls = $derived.by(() => {
    const toolEvents = timeline
      .filter((e: TimelineEvent) => e.event_type === 'tool' && e.tool_name)
      .slice(-3)
      .reverse()
    return toolEvents as { tool_name: string; summary: string }[]
  })

  let lastUserPrompt = $derived.by(() => {
    if (session.last_user_prompt) return session.last_user_prompt
    if (fetchedSession?.last_user_prompt) return fetchedSession.last_user_prompt
    const latestUser = [...timeline].reverse().find((event: TimelineEvent) => event.event_type === 'user')
    return latestUser?.summary || null
  })

  let lastAssistantMessage = $derived.by(() => {
    if (session.last_assistant_message) return session.last_assistant_message
    if (fetchedSession?.last_assistant_message) return fetchedSession.last_assistant_message
    const latestAssistant = [...timeline].reverse().find(
      (event: TimelineEvent) => event.event_type === 'message' || event.event_type === 'error' || event.event_type === 'question' || event.event_type === 'permission' || event.event_type === 'tool'
    )
    return latestAssistant?.summary || null
  })

  $effect(() => {
    if (session.last_user_prompt || session.last_assistant_message) return
    if ((store.timelines.get(session.id) || []).length > 0) return
    if (fetchedTimeline || fetchError) return

    getSession(session.id)
      .then((data) => {
        fetchedSession = data.session
        fetchedTimeline = data.timeline
      })
      .catch(() => {
        fetchError = true
      })
  })

  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      }
    }
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatDuration(ms: number): string {
    const mins = Math.round(ms / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remaining = mins % 60
    return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`
  }

  function truncateId(id: string): string {
    return id.slice(0, 12) + '...'
  }

  function truncateSummary(summary: string, maxLen: number = 100): string {
    if (!summary) return ''
    return summary.length > maxLen ? summary.slice(0, maxLen) + '...' : summary
  }

  function getStatusDotClass(status: string): string {
    if (status === 'active') return 'bg-emerald-500 animate-pulse'
    if (status === 'idle') return 'bg-amber-500'
    if (status === 'idle-with-subagents') return 'bg-blue-500'
    if (status === 'error') return 'bg-rose-500'
    return 'bg-zinc-500'
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'text-emerald-500'
      case 'idle': return 'text-amber-500'
      case 'idle-with-subagents': return 'text-blue-500'
      case 'error': return 'text-rose-500'
      case 'stale': return 'text-zinc-500'
      default: return 'text-zinc-400'
    }
  }

  async function copySessionId(event: MouseEvent) {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(session.id)
    } catch (error) {
      console.warn('Failed to copy session ID', error)
    }
  }
</script>

<div
  bind:this={floatingEl}
  class="hover-card"
  class:state-active={displayStatus === 'active'}
  class:state-idle={displayStatus === 'idle'}
  class:state-blue-idle={displayStatus === 'idle-with-subagents'}
  class:state-error={displayStatus === 'error'}
  role="tooltip"
  use:portal
  style="left:{x}px;top:{y}px;"
  data-placement={placement}
  onmouseenter={onmouseenter}
  onmouseleave={onmouseleave}
>
  <div class="hover-card-inner">
    <div class="hover-card-blur"></div>
    <div class="hover-compact-row">
      <div class="status-indicator large">
        <div class={`status-dot ${getStatusDotClass(displayStatus)}`}></div>
      </div>
      <h3 class="hover-title">{session.title || 'Untitled'}</h3>
      <div class="hover-stats">
        <span class="stat tokens">{formatTokens(session.token_total || 0)}</span>
        <span class="stat cost">{formatCost(session.cost_total || 0)}</span>
      </div>
    </div>

    <div class="hover-details">
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Session ID</span>
          <button class="detail-value copy-btn" onclick={copySessionId}>
            {truncateId(session.id)}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="copy-icon">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>

        <div class="detail-item">
          <span class="detail-label">Status</span>
          <span class={`detail-value status-badge ${getStatusColor(displayStatus)}`}>{displayStatus}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Project</span>
          <span class="detail-value">{projectName}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Created</span>
          <span class="detail-value">{formatTimestamp(session.created_at)}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{session.completed_at ? 'Completed' : 'Last Active'}</span>
          <span class="detail-value">{formatTimestamp(session.completed_at || session.updated_at)}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Duration</span>
          <span class="detail-value">{formatDuration((session.completed_at || session.updated_at) - session.created_at)}</span>
        </div>

        {#if session.directory}
          <div class="detail-item full-width">
            <span class="detail-label">Directory</span>
            <span class="detail-value truncate" title={session.directory}>{session.directory}</span>
          </div>
        {/if}

        <div class="detail-item">
          <span class="detail-label">Hostname</span>
          <span class="detail-value">{session.hostname}</span>
        </div>

        {#if modelName}
          <div class="detail-item full-width">
            <span class="detail-label">Model</span>
            <span class="detail-value model-badge">{modelName}</span>
          </div>
        {/if}

        {#if subAgents.length > 0}
          <div class="detail-item full-width">
            <span class="detail-label">Sub-agents</span>
            <div class="subagent-stats">
              {#if activeSubAgents > 0}
                <span class="subagent-active">{activeSubAgents} active</span>
              {/if}
              {#if idleSubAgents > 0}
                <span class="subagent-idle">{idleSubAgents} idle</span>
              {/if}
            </div>
          </div>
        {/if}

        {#if session.notes_count && session.notes_count > 0}
          <div class="detail-item">
            <span class="detail-label">Notes</span>
            <div class="detail-value notes-badge">
              <StickyNote class="w-3 h-3" />
              {session.notes_count}
            </div>
          </div>
        {/if}

        {#if session.completed_reason}
          <div class="detail-item full-width">
            <span class="detail-label">Reason</span>
            <span class="detail-value">{session.completed_reason}</span>
          </div>
        {/if}
      </div>

      {#if session.parent_session_id}
        <div class="hover-badge parent">
          <GitPullRequest class="badge-icon" />
          Sub-session of {truncateId(session.parent_session_id)}
        </div>
      {/if}

      {#if subAgents.length > 0}
        <div class="hover-badge subagent">
          <GitBranch class="badge-icon" />
          Has {subAgents.length} Sub-agent{subAgents.length !== 1 ? 's' : ''}
        </div>
      {/if}

      {#if session.needs_attention}
        <div class="hover-badge attention">
          <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          Needs Attention
        </div>
      {/if}

      {#if lastUserPrompt}
        <div class="hover-preview user-preview">
          <span class="preview-label">Last Prompt</span>
          <p class="preview-copy">{lastUserPrompt}</p>
        </div>
      {/if}

      {#if lastAssistantMessage}
        <div class="hover-preview assistant-preview">
          <span class="preview-label">Last Reply</span>
          <p class="preview-copy">{lastAssistantMessage}</p>
        </div>
      {/if}

      {#if lastToolCalls.length > 0}
        <div class="hover-preview tool-calls-preview">
          <span class="preview-label">Last Tool Calls</span>
          {#each lastToolCalls as event}
            <div class="tool-call-row">
              <span class="tool-name">{event.tool_name}</span>
              <span class="tool-summary">{truncateSummary(event.summary, 100)}</span>
            </div>
          {/each}
        </div>
      {:else if !lastUserPrompt && !lastAssistantMessage}
        <div class="hover-preview tool-calls-preview">
          <span class="preview-label">Last Tool Calls</span>
          <p class="preview-copy text-muted">No recent tool calls</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .hover-card {
    position: fixed;
    width: min(440px, calc(100vw - 16px));
    z-index: 10000;
    pointer-events: auto;
    animation: fade-in 0.15s ease-out;
  }

  .hover-card-inner {
    position: relative;
    background: rgba(19, 21, 26, 0.76);
    border: 1px solid var(--border-highlight, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    isolation: isolate;
    max-height: 80vh;
    overflow-y: auto;
  }

  .hover-card-blur {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(19, 21, 26, 0.85);
    border-radius: inherit;
    pointer-events: none;
    z-index: 0;
  }

  .hover-compact-row,
  .hover-details {
    position: relative;
    z-index: 1;
  }

  .hover-card.state-active .hover-card-inner {
    border-color: transparent;
  }

  .hover-card.state-active .hover-card-inner::before,
  .hover-card.state-blue-idle .hover-card-inner::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    padding: 2px;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: spin-border 2s linear infinite;
    pointer-events: none;
    z-index: -1;
  }

  .hover-card.state-active .hover-card-inner::before {
    background: conic-gradient(from var(--hover-angle, 0deg), #10b981, transparent 30%, transparent 70%, #10b981);
  }

  .hover-card.state-blue-idle .hover-card-inner {
    border-color: transparent;
  }

  .hover-card.state-blue-idle .hover-card-inner::before {
    background: conic-gradient(from var(--hover-angle, 0deg), #3b82f6, transparent 30%, transparent 70%, #3b82f6);
  }

  .hover-card.state-idle .hover-card-inner {
    animation: hover-idle-glow 3s ease-in-out infinite;
  }

  .hover-card.state-error .hover-card-inner {
    animation: hover-error-glow 2s ease-in-out infinite;
  }

  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin-border { to { --hover-angle: 360deg; } }
  @keyframes hover-idle-glow {
    0%, 100% { box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5); border-color: rgba(255, 255, 255, 0.15); }
    50% { box-shadow: 0 12px 40px rgba(234, 179, 8, 0.3); border-color: rgba(234, 179, 8, 0.5); }
  }
  @keyframes hover-error-glow {
    0%, 100% { box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5); border-color: rgba(239, 68, 68, 0.3); }
    50% { box-shadow: 0 12px 40px rgba(239, 68, 68, 0.5); border-color: rgba(239, 68, 68, 0.6); }
  }

  @property --hover-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  .hover-compact-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  }

  .hover-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #e4e4e7);
    line-height: 1.4;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hover-stats,
  .subagent-stats,
  .notes-badge {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .hover-stats .stat {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .hover-stats .stat.tokens {
    background: rgba(88, 166, 255, 0.15);
    color: var(--accent-blue, #58a6ff);
  }

  .hover-stats .stat.cost {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success, #10b981);
  }

  .hover-details { padding: 12px 14px; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .detail-item { display: flex; flex-direction: column; gap: 2px; }
  .detail-item.full-width { grid-column: 1 / -1; }
  .detail-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-muted, #71717a);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .detail-value {
    font-size: 12px;
    color: var(--text-main, #e4e4e7);
    font-family: var(--font-mono, monospace);
  }
  .detail-value.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .detail-value.model-badge {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(88, 166, 255, 0.12);
    border: 1px solid rgba(88, 166, 255, 0.3);
    border-radius: 999px;
    color: var(--accent-blue, #58a6ff);
  }
  .detail-value.status-badge { text-transform: capitalize; padding: 2px 8px; border-radius: 4px; }
  .detail-value.status-badge.text-emerald-500 { background: rgba(16, 185, 129, 0.15); }
  .detail-value.status-badge.text-amber-500 { background: rgba(234, 179, 8, 0.15); }
  .detail-value.status-badge.text-blue-500 { background: rgba(59, 130, 246, 0.15); }
  .detail-value.status-badge.text-rose-500 { background: rgba(239, 68, 68, 0.15); }
  .detail-value.status-badge.text-zinc-500 { background: rgba(113, 113, 122, 0.15); }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--accent-blue, #58a6ff);
    padding: 2px 4px;
    border-radius: 4px;
    transition: background 0.15s;
  }
  .copy-btn:hover { background: rgba(88, 166, 255, 0.1); }
  .copy-icon { width: 12px; height: 12px; opacity: 0.6; }
  .status-indicator { display: flex; align-items: center; flex-shrink: 0; }
  .status-indicator.large .status-dot { width: 10px; height: 10px; }
  .status-dot { border-radius: 50%; }
  .subagent-active { color: #10b981; }
  .subagent-idle { color: #71717a; }

  .hover-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    margin-top: 10px;
  }
  .hover-badge.parent { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }
  .hover-badge.subagent { background: rgba(88, 166, 255, 0.15); color: var(--accent-blue, #58a6ff); border: 1px solid rgba(88, 166, 255, 0.3); }
  .hover-badge.attention { background: rgba(234, 179, 8, 0.15); color: #fbbf24; border: 1px solid rgba(234, 179, 8, 0.3); }
  .badge-icon { width: 14px; height: 14px; }

  .hover-preview {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    background: rgba(255, 255, 255, 0.03);
  }
  .user-preview { border-color: rgba(168, 85, 247, 0.2); background: rgba(168, 85, 247, 0.08); }
  .assistant-preview { border-color: rgba(34, 197, 94, 0.2); background: rgba(34, 197, 94, 0.08); }
  .tool-calls-preview { border-color: rgba(88, 166, 255, 0.2); background: rgba(88, 166, 255, 0.08); }
  .preview-label {
    display: block;
    margin-bottom: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted, #71717a);
  }
  .preview-copy {
    display: -webkit-box;
    line-clamp: 3;
    margin: 0;
    overflow: hidden;
    color: var(--text-main, #e4e4e7);
    font-size: 12px;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }
  .preview-copy.text-muted { color: var(--text-muted, #71717a); font-style: italic; }

  .tool-call-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0;
  }
  .tool-call-row:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .tool-name {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-blue, #58a6ff);
    font-family: var(--font-mono, monospace);
  }
  .tool-summary {
    font-size: 11px;
    color: var(--text-secondary, #a1a1aa);
    line-height: 1.4;
  }
</style>