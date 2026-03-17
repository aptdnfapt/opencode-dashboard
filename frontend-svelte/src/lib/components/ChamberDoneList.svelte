<script lang="ts">
  import { chamberStore } from '$lib/chamber-store.svelte'
  import { formatRelativeTime, getProjectName, getProjectColor } from '$lib/utils'

  let allDirs = $derived(
    [...new Set(chamberStore.recentDone.map(s => s.directory).filter(Boolean))] as string[]
  )

  function openViewer(sessionId: string) {
    chamberStore.setSelected(sessionId)
  }
</script>

<div class="p-4">
  <h2 class="text-sm font-semibold text-[var(--fg-primary)] mb-3">
    Recently Completed
  </h2>

  {#if chamberStore.loadingDone}
    <div class="space-y-2">
      {#each Array(3) as _, i (i)}
        <div class="bg-[var(--bg-tertiary)] rounded p-2 h-16 animate-pulse"></div>
      {/each}
    </div>
  {:else if chamberStore.recentDone.length === 0}
    <div class="text-xs text-[var(--fg-muted)] text-center py-4">
      No completed sessions
    </div>
  {:else}
    <div class="space-y-2">
      {#each chamberStore.recentDone as session (session.id)}
        <button
          type="button"
          onclick={() => openViewer(session.id)}
          class="block p-2 rounded border transition-colors bg-[var(--bg-tertiary)] border-[var(--border-subtle)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)]"
        >
          <div class="flex items-start justify-between gap-2 mb-1">
            <span class="text-sm font-medium truncate text-[var(--fg-primary)]">
              {session.title || 'Untitled'}
            </span>
            <span class="text-[10px] mono text-[var(--fg-muted)]">
              {formatRelativeTime(session.completed_at || session.updated_at)}
            </span>
          </div>
          <div class="flex items-center gap-2 text-[10px]">
            <span 
              class="mono truncate"
              style="color: {getProjectColor(session.directory || '', allDirs)}"
            >
              {getProjectName(session.directory)}
            </span>
            {#if session.group_tag}
              <span class="px-1 py-0.5 rounded bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
                {session.group_tag}
              </span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
