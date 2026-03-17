<script lang="ts">
  import type { Session } from '$lib/types'
  import { chamberStore } from '$lib/chamber-store.svelte'
  import { store } from '$lib/store.svelte'
  import { formatRelativeTime, cn } from '$lib/utils'
  import { Archive, CheckCircle, X } from 'lucide-svelte'
  import { markSessionDone, setSessionTracked, archiveSession } from '$lib/api'

  interface Props {
    session: Session
  }

  let { session }: Props = $props()
  let menuOpen = $state(false)

  // Compute effective status
  let displayStatus = $derived.by(() => {
    void chamberStore.tick
    return chamberStore.getEffectiveStatus(session)
  })

  // Sub-agents
  let subAgents = $derived(
    chamberStore.tracked.filter(s => s.parent_session_id === session.id)
  )
  let activeSubAgents = $derived(subAgents.filter(s => s.status === 'active').length)

  let timeline = $derived(store.timelines.get(session.id) || [])
  let latestMessage = $derived.by(() => {
    const last = timeline[timeline.length - 1]
    if (!last?.summary) return ''
    return last.summary.length > 72 ? `${last.summary.slice(0, 72)}...` : last.summary
  })

  // Context menu actions
  async function handleDone(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = false
    try {
      await markSessionDone(session.id)
      chamberStore.removeTracked(session.id)
      chamberStore.addToRecentDone(session)
    } catch (err) {
      console.warn('Failed to mark done:', err)
    }
  }

  async function handleRemove(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = false
    try {
      await setSessionTracked(session.id, { isTracked: false })
      chamberStore.removeTracked(session.id)
    } catch (err) {
      console.warn('Failed to remove:', err)
    }
  }

  async function handleArchive(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = false
    try {
      await archiveSession(session.id)
      chamberStore.removeTracked(session.id)
    } catch (err) {
      console.warn('Failed to archive:', err)
    }
  }

  function toggleMenu(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    menuOpen = !menuOpen
  }

  function openViewer() {
    chamberStore.setSelected(session.id)
  }
</script>

<!-- ChamberCard: compact card for Chamber live board -->
<div
  role="button"
  tabindex="0"
  onclick={openViewer}
  onkeydown={(e) => e.key === 'Enter' && openViewer()}
  class={cn(
    'block w-full p-2 rounded-lg border transition-all duration-150 relative',
    'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]',
    displayStatus === 'active' && 'border-emerald-500/50 chamber-running',
    displayStatus === 'idle' && 'border-amber-500/50 chamber-idle',
    displayStatus === 'idle-with-subagents' && 'border-blue-500/50 chamber-blue-idle',
    displayStatus === 'error' && 'border-rose-500/50 chamber-error',
    displayStatus === 'stale' && 'border-zinc-500/50',
    session.needs_attention ? 'ring-1 ring-amber-400' : ''
  )}
>
  <!-- Header: title + menu -->
  <div class="flex items-center justify-between gap-2 mb-1">
    <span class="text-sm font-medium truncate text-[var(--fg-primary)]">
      {session.title || 'Untitled'}
    </span>
    <div class="relative">
      <button
        type="button"
        onclick={toggleMenu}
        title="Session actions"
        class="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] transition-colors"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
      {#if menuOpen}
        <div 
          role="menu"
          tabindex="-1"
          class="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg py-1 min-w-[120px]"
          style="box-shadow: var(--shadow-lg);"
        >
          <button
            type="button"
            onclick={handleDone}
            class="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <CheckCircle class="w-3.5 h-3.5" />
            Mark Done
          </button>
          <button
            type="button"
            onclick={handleRemove}
            class="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X class="w-3.5 h-3.5" />
            Remove
          </button>
          <button
            type="button"
            onclick={handleArchive}
            class="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <Archive class="w-3.5 h-3.5" />
            Archive
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Status indicator -->
  <div class="flex items-center gap-2 text-[10px] text-[var(--fg-muted)] mb-1">
    {#if displayStatus === 'active'}
      <span class="text-emerald-500 animate-pulse">Running</span>
    {:else if displayStatus === 'idle'}
      <span class="text-amber-500">Idle</span>
    {:else if displayStatus === 'idle-with-subagents'}
      <span class="text-blue-500">Idle + {activeSubAgents} active sub</span>
    {:else if displayStatus === 'error'}
      <span class="text-rose-500">Error</span>
    {:else}
      <span>Stale</span>
    {/if}
    {#if session.needs_attention}
      <span class="text-amber-400">• Needs Attention</span>
    {/if}
  </div>

  <!-- Footer: time -->
  <div class="text-[10px] text-[var(--fg-muted)] mono">
    {formatRelativeTime(session.updated_at)}
  </div>

  {#if latestMessage}
    <div class="mt-1 text-[11px] leading-4 text-[var(--fg-secondary)] line-clamp-2 text-left">
      {latestMessage}
    </div>
  {/if}

  <!-- Attention ring (if needed) -->
  {#if session.needs_attention}
    <div class="absolute inset-0 rounded-lg ring-1 ring-amber-400 animate-pulse pointer-events-none"></div>
  {/if}
</div>

<style>
  /* Running: green spinning border */
  .chamber-running {
    position: relative;
  }
  .chamber-running::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    padding: 2px;
    background: conic-gradient(
      from var(--chamber-angle, 0deg),
      #10b981,
      transparent 30%,
      transparent 70%,
      #10b981
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: chamber-spin 2s linear infinite;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes chamber-spin {
    to { --chamber-angle: 360deg; }
  }
  @property --chamber-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  /* Idle: yellow pulse */
  .chamber-idle {
    animation: chamber-idle-glow 2.5s ease-in-out infinite;
  }
  @keyframes chamber-idle-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(234, 179, 8, 0.2); }
    50% { box-shadow: 0 0 8px rgba(234, 179, 8, 0.4); }
  }

  /* Idle + subagents: blue spinning */
  .chamber-blue-idle {
    position: relative;
  }
  .chamber-blue-idle::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    padding: 2px;
    background: conic-gradient(
      from var(--blue-angle, 0deg),
      #3b82f6,
      transparent 30%,
      transparent 70%,
      #3b82f6
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: chamber-blue-spin 2s linear infinite;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes chamber-blue-spin {
    to { --blue-angle: 360deg; }
  }
  @property --blue-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  /* Error: red pulse */
  .chamber-error {
    animation: chamber-error-glow 2s ease-in-out infinite;
  }
  @keyframes chamber-error-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); }
    50% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
  }
</style>
