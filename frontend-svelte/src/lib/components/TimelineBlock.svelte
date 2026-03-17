<script lang="ts">
  import type { TimelineBlock as TimelineBlockModel } from '$lib/library-store.svelte'

  interface Props {
    block: TimelineBlockModel
    onClick?: (sessionId: string) => void
  }

  let { block, onClick }: Props = $props()

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
</style>
