<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { libraryStore, type TimelineLane, type LibraryTimeRange } from '$lib/library-store.svelte'
  import TagTrack from './TagTrack.svelte'
  import TimelineBlock from './TimelineBlock.svelte'

  interface Props {
    onBlockClick?: (sessionId: string) => void
  }

  let { onBlockClick }: Props = $props()
  let timelineRef: HTMLElement | null = null
  let isDragging = $state(false)
  let startX = 0
  let scrollLeft = 0

  onMount(() => {
    if (!timelineRef) return

    const handleMouseDown = (event: MouseEvent) => {
      if (!timelineRef) return
      isDragging = true
      timelineRef.style.cursor = 'grabbing'
      startX = event.pageX - timelineRef.offsetLeft
      scrollLeft = timelineRef.scrollLeft
    }

    const handleMouseUp = () => {
      isDragging = false
      if (timelineRef) timelineRef.style.cursor = 'grab'
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || !timelineRef) return
      event.preventDefault()
      const x = event.pageX - timelineRef.offsetLeft
      timelineRef.scrollLeft = scrollLeft - (x - startX) * 2
    }

    timelineRef.addEventListener('mousedown', handleMouseDown)
    timelineRef.addEventListener('mouseleave', handleMouseUp)
    timelineRef.addEventListener('mouseup', handleMouseUp)
    timelineRef.addEventListener('mousemove', handleMouseMove)

    queueMicrotask(() => {
      if (timelineRef) timelineRef.scrollLeft = timelineRef.scrollWidth
    })

    return () => {
      timelineRef?.removeEventListener('mousedown', handleMouseDown)
      timelineRef?.removeEventListener('mouseup', handleMouseUp)
      timelineRef?.removeEventListener('mouseleave', handleMouseUp)
      timelineRef?.removeEventListener('mousemove', handleMouseMove)
    }
  })

  $effect(() => {
    libraryStore.timelineModel.canvasWidth
    tick().then(() => {
      if (timelineRef) timelineRef.scrollLeft = timelineRef.scrollWidth
    })
  })

  function getLaneHeight(lane: TimelineLane): number {
    const base = lane.type === 'tag' ? 92 : 78
    return base + Math.min(lane.maxStack, 3) * 10 + (lane.type === 'tag' ? 16 : 0)
  }

  function getLaneWatermark(lane: TimelineLane): string {
    if (lane.type === 'tag') return `Tag: ${lane.label.replace('Tag: ', '')}`
    if (lane.type === 'tracked') return 'Tracked / Chamber'
    return 'Manual / General'
  }

  function getLaneWatermarkColor(lane: TimelineLane): string {
    if (lane.type === 'tag') return 'var(--color-ralph)'
    if (lane.type === 'tracked') return 'var(--color-success)'
    return 'var(--color-manual)'
  }

  function getWatermarkSpacing(timeRange: LibraryTimeRange): number {
    switch (timeRange) {
      case '1h': return 400
      case '6h': return 600
      case '24h': return 800
      case '7d': return 1000
      case '30d': return 1400
      case 'all': return 2000
      default: return 600
    }
  }

  function getWatermarkPositions(canvasWidth: number, spacing: number): number[] {
    const positions: number[] = []
    const startPos = 60
    for (let pos = startPos; pos < canvasWidth; pos += spacing) {
      positions.push(pos)
    }
    return positions
  }

  let watermarkPositions = $derived(getWatermarkPositions(libraryStore.timelineModel.canvasWidth, getWatermarkSpacing(libraryStore.filters.timeRange)))
</script>

<div class="timeline-view" bind:this={timelineRef}>
  <div class="timeline-canvas" style={`width:${libraryStore.timelineModel.canvasWidth}px;`}>
    <div class="time-axis">
      {#each libraryStore.timelineModel.markers as marker (marker.time)}
        <div class="time-marker" style={`left:${marker.left}px;`}>
          {marker.label}
        </div>
      {/each}
    </div>

    <div class="tracks-shell">
      {#each libraryStore.timelineModel.tracks as track (track.projectId)}
        <section class="project-track" style={`min-height:${track.height}px;`}>
          {#each watermarkPositions as pos}
            <div class="track-watermark" style={`left:${pos}px;`}>{track.projectName}</div>
          {/each}

          <div class="track-lanes">
            {#each track.lanes as lane (lane.id)}
              <div class="lane-row" style={`height:${getLaneHeight(lane)}px;`}>
                {#each watermarkPositions as pos}
                  <div class="lane-watermark" style={`left:${pos}px;color:${getLaneWatermarkColor(lane)};`}>
                    {getLaneWatermark(lane)}
                  </div>
                {/each}
                {#if lane.type !== 'tag'}
                  <div class="lane-divider"></div>
                {/if}
                <div class="lane-canvas">
                  {#if lane.type === 'tag'}
                    {#each lane.containers as container (container.id)}
                      <TagTrack container={container} onBlockClick={onBlockClick} />
                    {/each}
                  {:else}
                    {#each lane.blocks as block (block.id)}
                      <TimelineBlock block={block} onClick={onBlockClick} />
                    {/each}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </div>
</div>

<style>
  .timeline-view {
    position: absolute;
    inset: 0;
    overflow: auto;
    background: var(--bg-canvas);
    cursor: grab;
  }

  .timeline-canvas {
    position: relative;
    min-height: 100%;
    padding-top: 44px;
    overflow-x: hidden;
  }

  .time-axis {
    position: sticky;
    top: 0;
    z-index: 20;
    height: 44px;
    background: rgba(19, 21, 26, 0.94);
    border-bottom: 1px solid var(--border-color);
  }

  .time-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    min-width: 1px;
    border-left: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: 11px;
    font-family: var(--font-mono);
    padding: 13px 12px 0 12px;
    white-space: nowrap;
    transform: translateX(-1px);
  }

  .tracks-shell {
    position: relative;
  }

  .project-track {
    position: relative;
    border-bottom: 1px solid var(--border-color);
    padding: 18px 0 18px;
  }

  .track-watermark {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: 80px;
    font-weight: 800;
    color: var(--text-watermark);
    text-transform: uppercase;
    letter-spacing: 2px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
    opacity: 0.08;
  }

  .track-lanes {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lane-row {
    position: relative;
    padding-left: 0;
    overflow: hidden;
  }

  .lane-watermark {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: 32px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
    opacity: 0.06;
  }

  .lane-divider {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-bottom: 1px dashed rgba(92, 99, 112, 0.4);
    pointer-events: none;
    z-index: 0;
  }

  .lane-canvas {
    position: relative;
    z-index: 1;
    min-height: 100%;
  }

  @media (max-width: 900px) {
    .track-watermark {
      font-size: 54px;
    }

    .lane-watermark {
      font-size: 24px;
    }
  }
</style>