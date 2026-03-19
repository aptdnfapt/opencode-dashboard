<script lang="ts">
  import type { TimelineBlock as TimelineBlockModel } from '$lib/library-store.svelte'
  import { getFloatingPosition, type FloatingPosition } from '$lib/actions/floating'

  interface Props {
    block: TimelineBlockModel
    onClick?: (sessionId: string) => void
  }

  let { block, onClick }: Props = $props()
  let isHovering = $state(false)
  let floatingPosition = $state<FloatingPosition>({ x: 0, y: 0, placement: 'top' })
  let hoverHideTimer: ReturnType<typeof setTimeout> | null = null
  let blockRef = $state<HTMLDivElement | null>(null)
  let hoverCardRef = $state<HTMLDivElement | null>(null)

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'var(--color-success)'
      case 'error':
        return 'var(--color-error)'
      case 'idle':
        return '#f59e0b'
      default:
        return 'var(--color-manual)'
    }
  }

  function getStatusDotClass(status: string): string {
    if (status === 'active') return 'bg-emerald-500 animate-pulse'
    if (status === 'error') return 'bg-rose-500'
    if (status === 'idle') return 'bg-amber-500'
    return 'bg-zinc-500'
  }

  function getFloatingBarClass(status: string): string {
    if (status === 'active') return 'floating-bar-active'
    if (status === 'idle') return 'floating-bar-idle-blink'
    return ''
  }

  function handleActivate() {
    onClick?.(block.sessionId)
  }

  function handleClick(event: MouseEvent) {
    event.stopPropagation()
    handleActivate()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleActivate()
    }
  }

  function clearHoverHideTimer() {
    if (hoverHideTimer) {
      clearTimeout(hoverHideTimer)
      hoverHideTimer = null
    }
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      }
    }
  }

  async function updateFloatingPosition() {
    if (!blockRef || !hoverCardRef) return
    const pos = await getFloatingPosition(blockRef, hoverCardRef, {
      placement: 'top',
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
    hoverHideTimer = setTimeout(() => {
      isHovering = false
    }, 120)
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

  async function copySessionId(event: MouseEvent) {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(block.sessionId)
    } catch (error) {
      console.warn('Failed to copy session ID', error)
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

  function formatTokens(tokens: number): string {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return String(tokens)
  }

  function formatCost(cost: number): string {
    return `$${cost.toFixed(2)}`
  }

  function truncate(text: string | null | undefined, len: number): string {
    if (!text) return '—'
    if (text.length <= len) return text
    return text.slice(0, len - 3) + '...'
  }

  function truncateId(id: string): string {
    return id.slice(0, 12) + '…'
  }

  // Update position when hover becomes visible
  $effect(() => {
    if (isHovering && blockRef && hoverCardRef) {
      updateFloatingPosition()
    }
  })
</script>

<div
  bind:this={blockRef}
  class="timeline-block"
  class:chamber-done={block.isCompletedViaChamber}
  class:is-overlapping={block.overlapCount > 1}
  style={`left:${block.renderLeft}px;top:${block.stackIndex * 8}px;width:${block.width}px;z-index:${block.zIndex};`}
  data-overlap={block.overlapCount > 1}
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-label={`Open session ${block.title}`}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <div class="block-header">
    <div class="status-indicator">
      <div class={`status-dot ${getStatusDotClass(block.status)}`}></div>
    </div>
    <span class="block-title">{block.displayName}</span>
    {#if block.lineageLabel}
      <span class="lineage-pill">{block.lineageLabel}</span>
    {/if}
  </div>

  <div class="block-meta">
    <span class="duration">{block.displayMeta}</span>
    {#if block.isCompletedViaChamber}
      <span class="chamber-badge">✓ Chamber</span>
    {/if}
    {#if block.hasSubagentActivity}
      <span class="subagent-pill">subagents</span>
    {/if}
  </div>

  {#if isHovering}
    <div 
      bind:this={hoverCardRef}
      class="hover-card"
      class:floating-bar-active={block.status === 'active'}
      class:floating-bar-idle-blink={block.status === 'idle'}
      role="tooltip"
      use:portal
      style="left:{floatingPosition.x}px;top:{floatingPosition.y}px;"
      onmouseenter={handleHoverCardEnter}
      onmouseleave={handleHoverCardLeave}
    >
      <div class="hover-card-inner">
        <div class="hover-card-blur"></div>
        <div class="hover-compact-row">
          <div class="status-indicator large">
            <div class={`status-dot ${getStatusDotClass(block.status)}`}></div>
          </div>
          <h3 class="hover-title">{block.title}</h3>
          <div class="hover-stats">
            <span class="stat tokens">{formatTokens(block.tokenTotal)}</span>
            <span class="stat cost">{formatCost(block.costTotal)}</span>
          </div>
        </div>

        <div class="hover-details">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Session ID</span>
              <button class="detail-value copy-btn" onclick={copySessionId}>
                {truncateId(block.sessionId)}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="copy-icon">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>

            <div class="detail-item">
              <span class="detail-label">Project</span>
              <span class="detail-value">{block.projectName}</span>
            </div>

            <div class="detail-item">
              <span class="detail-label">Created</span>
              <span class="detail-value">{formatTimestamp(block.startAt)}</span>
            </div>

            <div class="detail-item">
              <span class="detail-label">Last Active</span>
              <span class="detail-value">{formatTimestamp(block.endAt)}</span>
            </div>

            <div class="detail-item">
              <span class="detail-label">Duration</span>
              <span class="detail-value">{formatDuration(block.endAt - block.startAt)}</span>
            </div>

            {#if block.segmentCount > 1}
              <div class="detail-item">
                <span class="detail-label">Segment</span>
                <span class="detail-value">{block.segmentIndex + 1} of {block.segmentCount}</span>
              </div>
            {/if}

            {#if block.directory}
              <div class="detail-item full-width">
                <span class="detail-label">Directory</span>
                <span class="detail-value truncate" title={block.directory}>{block.directory}</span>
              </div>
            {/if}

            {#if block.hostname}
              <div class="detail-item">
                <span class="detail-label">Hostname</span>
                <span class="detail-value">{block.hostname}</span>
              </div>
            {/if}

            {#if block.modelId}
              <div class="detail-item full-width">
                <span class="detail-label">Model</span>
                <span class="detail-value model-badge">{block.modelId}</span>
              </div>
            {/if}
          </div>

          {#if block.isCompletedViaChamber}
            <div class="hover-badge chamber">
              <svg class="badge-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 22h20L12 2z" />
              </svg>
              Completed via Chamber
            </div>
          {/if}

          {#if block.hasSubagentActivity}
            <div class="hover-badge subagent">
              <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"></path>
              </svg>
              Has Subagent Activity
            </div>
          {/if}

          {#if block.lastUserPrompt}
            <div class="hover-preview user-preview">
              <span class="preview-label">Last Prompt</span>
              <p class="preview-copy">{block.lastUserPrompt}</p>
            </div>
          {/if}

          {#if block.lastAssistantMessage}
            <div class="hover-preview assistant-preview">
              <span class="preview-label">Last Reply</span>
              <p class="preview-copy">{block.lastAssistantMessage}</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .timeline-block {
    position: absolute;
    min-width: 120px;
    max-width: 420px;
    height: 58px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 7px 9px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 5px;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    transition: box-shadow 0.18s ease, border-color 0.18s ease;
    overflow: hidden;
  }

  .timeline-block:hover,
  .timeline-block:focus-visible {
    border-color: var(--border-highlight);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
    z-index: 999 !important;
    outline: none;
  }

  .timeline-block.is-overlapping {
    box-shadow: -8px 0 0 rgba(255, 255, 255, 0.02), 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  }

  .timeline-block.chamber-done {
    border-color: var(--color-ralph);
    background: linear-gradient(135deg, var(--bg-card) 0%, rgba(198, 120, 221, 0.07) 100%);
  }

  .block-header,
  .block-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .block-header {
    justify-content: flex-start;
    gap: 6px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .block-title {
    min-width: 0;
    flex: 1;
    color: var(--text-main);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .block-meta {
    color: var(--text-muted);
    font-size: 10px;
    flex-wrap: wrap;
  }

  .duration {
    font-family: var(--font-mono);
  }

  .lineage-pill,
  .subagent-pill {
    border-radius: 999px;
    padding: 1px 6px;
    font-size: 9px;
    font-family: var(--font-mono);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.03);
    flex-shrink: 0;
  }

  .subagent-pill {
    color: var(--accent-blue);
    border-color: rgba(88, 166, 255, 0.25);
  }

  .chamber-badge {
    font-size: 9px;
    color: var(--color-ralph);
    flex-shrink: 0;
  }

  /* Frosted glass hover card */
  .hover-card {
    position: fixed;
    width: min(460px, calc(100vw - 16px));
    z-index: 10000;
    pointer-events: auto;
    animation: fadeIn 0.15s ease-out;
  }

  .hover-card-inner {
    position: relative;
    background: rgba(19, 21, 26, 0.76);
    border: 1px solid var(--border-highlight);
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    isolation: isolate;
  }

  /* Blur layer behind content to prevent text blur */
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

  .hover-card.floating-bar-active .hover-card-inner {
    border-color: transparent;
  }

  .hover-card.floating-bar-active .hover-card-inner::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    padding: 2px;
    background: conic-gradient(from var(--float-angle, 0deg), #10b981, transparent 30%, transparent 70%, #10b981);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: spin-float 2s linear infinite;
    pointer-events: none;
    z-index: -1;
  }

  .hover-card.floating-bar-idle-blink .hover-card-inner {
    animation: float-idle-blink 3s ease-in-out infinite;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes spin-float {
    to { --float-angle: 360deg; }
  }

  @keyframes float-idle-blink {
    0%, 100% { box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5); }
    50% { box-shadow: 0 12px 40px rgba(234, 179, 8, 0.3); }
  }

  @property --float-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  .hover-compact-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .status-indicator.large .status-dot {
    width: 10px;
    height: 10px;
  }

  .hover-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hover-stats {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .hover-stats .stat {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .hover-stats .stat.tokens {
    background: rgba(88, 166, 255, 0.15);
    color: var(--accent-blue);
  }

  .hover-stats .stat.cost {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success);
  }

  .hover-details {
    padding: 12px 14px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-item.full-width {
    grid-column: 1 / -1;
  }

  .detail-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-value {
    font-size: 12px;
    color: var(--text-main);
    font-family: var(--font-mono);
  }

  .detail-value.truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .detail-value.model-badge {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(88, 166, 255, 0.12);
    border: 1px solid rgba(88, 166, 255, 0.3);
    border-radius: 999px;
    color: var(--accent-blue);
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--accent-blue);
    padding: 2px 4px;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .copy-btn:hover {
    background: rgba(88, 166, 255, 0.1);
  }

  .copy-icon {
    width: 12px;
    height: 12px;
    opacity: 0.6;
  }

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

  .hover-badge.chamber {
    background: rgba(198, 120, 221, 0.15);
    color: var(--color-ralph);
    border: 1px solid rgba(198, 120, 221, 0.3);
  }

  .hover-badge.subagent {
    background: rgba(88, 166, 255, 0.15);
    color: var(--accent-blue);
    border: 1px solid rgba(88, 166, 255, 0.3);
  }

  .badge-icon {
    width: 14px;
    height: 14px;
  }

  .hover-preview {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: rgba(255, 255, 255, 0.03);
  }

  .user-preview {
    border-color: rgba(168, 85, 247, 0.2);
    background: rgba(168, 85, 247, 0.08);
  }

  .assistant-preview {
    border-color: rgba(34, 197, 94, 0.2);
    background: rgba(34, 197, 94, 0.08);
  }

  .preview-label {
    display: block;
    margin-bottom: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .preview-copy {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: var(--text-main);
    font-size: 12px;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }
</style>