<script lang="ts">
  import type { TimelineBlock as TimelineBlockModel } from '$lib/library-store.svelte'

  interface Props {
    block: TimelineBlockModel
    onClick?: (sessionId: string) => void
  }

  let { block, onClick }: Props = $props()
  let isHovering = $state(false)
  let hoverPosition = $state({ top: 0, left: 0, direction: 'up' as 'up' | 'down' })

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

  function handleMouseEnter(event: MouseEvent) {
    isHovering = true
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    
    const distanceFromTop = rect.top
    const distanceFromBottom = viewportHeight - rect.bottom
    hoverPosition.direction = distanceFromTop > distanceFromBottom ? 'up' : 'down'
    hoverPosition.left = rect.left
    hoverPosition.top = rect.top
  }

  function handleMouseLeave() {
    isHovering = false
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function truncate(text: string | null | undefined, len: number): string {
    if (!text) return '—'
    if (text.length <= len) return text
    return text.slice(0, len - 3) + '...'
  }
</script>

<div
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
    <span class="block-title">{block.displayName}</span>
    {#if block.lineageLabel}
      <span class="lineage-pill">{block.lineageLabel}</span>
    {/if}
  </div>

  <div class="block-meta">
    {#if block.isCompletedViaChamber}
      <svg class="chamber-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 22h20L12 2z" />
      </svg>
    {:else}
      <svg class="status-icon" viewBox="0 0 24 24" fill={getStatusColor(block.status)}>
        {#if block.status === 'active' || block.status === 'idle'}
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        {:else if block.status === 'error'}
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        {:else}
          <circle cx="12" cy="12" r="10" />
        {/if}
      </svg>
    {/if}

    <span class="duration">{block.displayMeta}</span>
    {#if block.hasSubagentActivity}
      <span class="subagent-pill">subagents</span>
    {/if}
  </div>

  {#if isHovering}
    <div 
      class="hover-card"
      class:direction-up={hoverPosition.direction === 'up'}
      class:direction-down={hoverPosition.direction === 'down'}
      style={`left:${block.renderLeft}px;`}
    >
      <div class="hover-title">{block.title}</div>

      <div class="hover-grid">
        <div>
          <div class="hover-label">Created</div>
          <div class="hover-value">{formatTimestamp(block.startAt)}</div>
        </div>
        <div>
          <div class="hover-label">Last Active</div>
          <div class="hover-value">{formatTimestamp(block.endAt)}</div>
        </div>
        <div>
          <div class="hover-label">Duration</div>
          <div class="hover-value">{block.displayMeta}</div>
        </div>
      </div>

      {#if block.isCompletedViaChamber}
        <div class="hover-section" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
          <div class="hover-label">Completed via Chamber</div>
          <div class="hover-value">✓</div>
        </div>
      {/if}

      {#if block.hasSubagentActivity}
        <div class="hover-section" style="margin-top: 10px;">
          <div class="hover-label">Subagent Activity</div>
          <div class="hover-value">Yes</div>
        </div>
      {/if}

      {#if block.segmentCount > 1}
        <div class="hover-section" style="margin-top: 10px;">
          <div class="hover-label">Session Segment</div>
          <div class="hover-value">{block.segmentIndex + 1} of {block.segmentCount}</div>
        </div>
      {/if}
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
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    overflow: hidden;
  }

.timeline-block:hover,
  .timeline-block:focus-visible {
    border-color: var(--border-highlight);
    transform: translateY(-2px);
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
    justify-content: space-between;
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

  .status-icon,
  .chamber-icon {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
  }

  .chamber-icon {
    color: var(--color-ralph);
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

  .hover-card {
    position: fixed;
    min-width: 380px;
    max-width: 520px;
    background: var(--bg-card);
    border: 1px solid var(--border-highlight);
    border-radius: 8px;
    padding: 14px 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    pointer-events: none;
    animation: fadeIn 0.15s ease-out;
  }

  .hover-card.direction-up {
    bottom: calc(100% + 12px);
  }

  .hover-card.direction-down {
    top: calc(100% + 12px);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .hover-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 12px;
    line-height: 1.4;
  }

  .hover-section {
    margin-bottom: 10px;
  }

  .hover-section:last-child {
    margin-bottom: 0;
  }

  .hover-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 3px;
  }

  .hover-value {
    font-size: 12px;
    color: var(--text-main);
  }

  .hover-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border-color);
  }
</style>
