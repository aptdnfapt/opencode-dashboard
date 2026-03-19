/**
 * Floating UI utilities for positioning hover cards, tooltips, etc.
 * Uses @floating-ui/dom for collision-aware positioning.
 */

import { computePosition, flip, shift, offset, autoUpdate, type Placement } from '@floating-ui/dom'

export interface FloatingConfig {
  placement?: Placement
  offset?: number
  padding?: number
}

export interface FloatingPosition {
  x: number
  y: number
  placement: 'left' | 'right' | 'top' | 'bottom'
}

/**
 * Compute floating position once (for immediate positioning)
 */
export async function getFloatingPosition(
  reference: HTMLElement,
  floating: HTMLElement,
  config: FloatingConfig = {}
): Promise<FloatingPosition> {
  const { x, y, placement } = await computePosition(reference, floating, {
    placement: config.placement || 'left-start',
    middleware: [
      offset(config.offset ?? 8),
      flip({ 
        fallbackPlacements: ['right-start', 'left', 'right', 'top', 'bottom'],
        padding: config.padding ?? 8 
      }),
      shift({ padding: config.padding ?? 8 })
    ]
  })
  
  // Normalize placement to just 'left' | 'right' | 'top' | 'bottom'
  const basePlacement = placement.split('-')[0] as 'left' | 'right' | 'top' | 'bottom'
  
  return { x, y, placement: basePlacement }
}

/**
 * Compute floating position for side-only placement (no top/bottom fallback)
 * Useful for sidebar hover cards that should only appear left/right
 */
export async function getFloatingPositionSideOnly(
  reference: HTMLElement,
  floating: HTMLElement,
  config: FloatingConfig = {}
): Promise<FloatingPosition> {
  const { x, y, placement } = await computePosition(reference, floating, {
    placement: config.placement || 'left-start',
    middleware: [
      offset(config.offset ?? 8),
      flip({ 
        fallbackPlacements: ['left-start', 'right-start'],
        padding: config.padding ?? 8 
      }),
      shift({ padding: config.padding ?? 8 })
    ]
  })
  
  const basePlacement = placement.split('-')[0] as 'left' | 'right' | 'top' | 'bottom'
  
  return { x, y, placement: basePlacement }
}

/**
 * Setup auto-updating position (handles scroll/resize while open)
 * Returns cleanup function to stop updates
 */
export function setupFloatingAutoUpdate(
  reference: HTMLElement,
  floating: HTMLElement,
  onUpdate: (position: FloatingPosition) => void,
  config: FloatingConfig = {}
): () => void {
  return autoUpdate(reference, floating, async () => {
    const result = await getFloatingPosition(reference, floating, config)
    onUpdate(result)
  })
}

/**
 * Svelte action for floating elements
 * Usage: <div use:floatingAction={{ reference: triggerElement }}>
 */
export function floatingAction(
  node: HTMLElement,
  params: { reference: HTMLElement | null; config?: FloatingConfig }
): { update: (params: { reference: HTMLElement | null; config?: FloatingConfig }) => void; destroy: () => void } {
  let cleanup: (() => void) | null = null

  function position() {
    if (!params.reference) return
    if (cleanup) cleanup()

    cleanup = setupFloatingAutoUpdate(
      params.reference,
      node,
      ({ x, y, placement }) => {
        Object.assign(node.style, {
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`
        })
        node.dataset.placement = placement
      },
      params.config
    )
  }

  position()

  return {
    update(newParams) {
      params = newParams
      position()
    },
    destroy() {
      if (cleanup) cleanup()
    }
  }
}