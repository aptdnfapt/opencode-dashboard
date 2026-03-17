<script lang="ts">
  import type { GroupedContainer } from '$lib/library-store.svelte'
  import TimelineBlock from './TimelineBlock.svelte'

  interface Props {
    container: GroupedContainer
    onBlockClick?: (sessionId: string) => void
  }

  let { container, onBlockClick }: Props = $props()
</script>

<div
  class="tag-track-container"
  style={`left:${container.left}px;width:${container.width}px;`}
>
  <div class="tag-label">
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
    <span>tag: {container.groupTag}</span>
  </div>

  {#each container.blocks as block (block.id)}
    <TimelineBlock block={block} onClick={onBlockClick} />
  {/each}
</div>

<style>
  .tag-track-container {
    position: absolute;
    top: 16px;
    min-height: 82px;
    border: 1px dashed #5c6370;
    background: rgba(30, 33, 40, 0.42);
    border-radius: 8px;
    overflow: visible;
  }

  .tag-label {
    position: absolute;
    top: -22px;
    left: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-ralph);
    font-size: 10px;
    font-family: var(--font-mono);
  }

  .tag-label svg {
    width: 10px;
    height: 10px;
  }
</style>
