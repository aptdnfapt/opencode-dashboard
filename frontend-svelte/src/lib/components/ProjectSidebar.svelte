<script lang="ts">
  import { onMount } from 'svelte'
  import { store } from '$lib/store.svelte'
  import type { Project } from '$lib/types'

  // Collapsed state - init from localStorage
  let collapsed = $state(false)
  
  // Selected project directory (bound to store filter)
  let selectedDirectory = $derived(store.filters.directory)
  
  // Derive projects from store.sessions (reactive to WebSocket updates)
  // Groups sessions by directory and counts active/total
  let projects = $derived.by(() => {
    const dirMap = new Map<string, { session_count: number; active_count: number }>()
    
    for (const session of store.sessions) {
      const dir = session.directory || 'unknown'
      const existing = dirMap.get(dir) || { session_count: 0, active_count: 0 }
      existing.session_count++
      if (session.status === 'active') existing.active_count++
      dirMap.set(dir, existing)
    }
    
    // Convert to Project array, sorted by session count desc
    return Array.from(dirMap.entries())
      .map(([directory, counts]) => ({
        directory,
        session_count: counts.session_count,
        active_count: counts.active_count
      }))
      .sort((a, b) => b.session_count - a.session_count)
  })

  onMount(() => {
    // Restore collapsed state from localStorage
    const saved = localStorage.getItem('projectSidebar:collapsed')
    if (saved !== null) {
      collapsed = saved === 'true'
    }
  })

  function toggleCollapse() {
    collapsed = !collapsed
    localStorage.setItem('projectSidebar:collapsed', String(collapsed))
  }

  function selectProject(directory: string | null) {
    // Update store filter - null clears filter
    store.setFilter('directory', directory ?? '')
  }

  // Extract project name from full path
  function getProjectName(directory: string): string {
    const parts = directory.split('/')
    return parts[parts.length - 1] || directory
  }

  // Total session count (reactive via store.sessions)
  let totalSessions = $derived(store.sessions.length)
</script>

<!-- Collapsible project sidebar -->
<aside 
  class="h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] transition-all duration-200"
  class:w-56={!collapsed}
  class:w-12={collapsed}
>
  <!-- Header with toggle -->
  <div class="flex items-center justify-between p-3 border-b border-[var(--border-subtle)]">
    {#if !collapsed}
      <span class="text-sm font-medium text-[var(--fg-primary)]">Projects</span>
    {/if}
    <button
      onclick={toggleCollapse}
      class="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors"
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <!-- Chevron icon rotates based on state -->
      <svg 
        class="w-4 h-4 transition-transform duration-200"
        class:rotate-180={collapsed}
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  </div>

  <!-- Project list -->
  <div class="flex-1 overflow-y-auto p-2">
      <!-- All Projects option -->
      <button
        onclick={() => selectProject(null)}
        class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors
               {selectedDirectory === '' 
                 ? 'bg-[var(--bg-tertiary)] text-[var(--fg-primary)]' 
                 : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--fg-primary)]'}"
        title="All Projects"
      >
        <span class="mono text-base shrink-0">◈</span>
        {#if !collapsed}
          <span class="flex-1 text-left truncate">All Projects</span>
          <span class="mono text-xs text-[var(--fg-muted)]">{totalSessions}</span>
        {/if}
      </button>

      <!-- Divider -->
      {#if !collapsed}
        <div class="my-2 border-t border-[var(--border-subtle)]"></div>
      {/if}

      <!-- Project list -->
      {#each projects as project (project.directory)}
        <button
          onclick={() => selectProject(project.directory)}
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors
                 {selectedDirectory === project.directory 
                   ? 'bg-[var(--bg-tertiary)] text-[var(--fg-primary)]' 
                   : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--fg-primary)]'}"
          title={project.directory}
        >
          <!-- Folder icon -->
          <span class="mono text-base shrink-0">
            {#if project.active_count > 0}
              <span class="text-[var(--accent-green)]">●</span>
            {:else}
              ○
            {/if}
          </span>
          
          {#if !collapsed}
            <span class="flex-1 text-left truncate">{getProjectName(project.directory)}</span>
            <span class="mono text-xs text-[var(--fg-muted)]">{project.session_count}</span>
          {/if}
        </button>
      {/each}

      {#if projects.length === 0 && !collapsed}
        <div class="text-xs text-[var(--fg-muted)] px-2 py-4 text-center">
          No projects found
        </div>
      {/if}
  </div>
</aside>
