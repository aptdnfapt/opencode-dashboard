<script lang="ts">
  import { store } from '$lib/store.svelte'
  import { page } from '$app/stores'
  import type { Session } from '$lib/types'
  import StatusDot from './StatusDot.svelte'
  import { getProjectName, getProjectColor } from '$lib/utils'
  import { archiveSession, unarchiveSession, dismissSession, deleteSession } from '$lib/api'
  import { ChevronRight, Folder, FolderOpen, GitBranch, MoreVertical, Archive, ArchiveRestore, BellOff, Trash2 } from 'lucide-svelte'
  
  // Stale threshold
  const STALE_THRESHOLD_MS = 3 * 60 * 1000
  
  // Use store's precomputed allDirs — computed once, shared across components
  let allDirs = $derived(store.allDirs)
  
  // Compute effective status using store.activeChildrenSet (O(1)) instead of O(N) .some()
  // store.tick forces re-eval every 30s so stale transitions happen on time
  function getEffectiveStatus(session: Session, _sessions: Session[], _tick: number): 'active' | 'idle' | 'error' | 'stale' | 'archived' {
    if (session.status === 'archived') return 'archived'
    if (session.status !== 'idle') return session.status
    const idleTime = Date.now() - new Date(session.updated_at).getTime()
    return (idleTime > STALE_THRESHOLD_MS && !store.activeChildrenSet.has(session.id)) ? 'stale' : 'idle'
  }
  
  // Props for collapsed mode
  let { collapsed = false } = $props()
  
  // Track expanded state for projects and sessions
  let expandedProjects = $state<Set<string>>(new Set())
  let expandedSessions = $state<Set<string>>(new Set())
  
  // 3-dot menu state — only one open at a time
  let openMenu = $state<string | null>(null) // "project:dir" or "session:id"
  
  function toggleMenu(key: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    openMenu = openMenu === key ? null : key
  }
  
  // Close menu on outside click
  function handleGlobalClick() {
    if (openMenu) openMenu = null
  }
  
  // Archive a single session
  async function handleArchive(sessionId: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    openMenu = null
    try {
      await archiveSession(sessionId)
      store.updateSession({ id: sessionId, status: 'archived' })
    } catch (err) { console.warn('[Archive] Failed:', err) }
  }
  
  // Unarchive a single session
  async function handleUnarchive(sessionId: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    openMenu = null
    try {
      await unarchiveSession(sessionId)
      store.updateSession({ id: sessionId, status: 'idle' })
    } catch (err) { console.warn('[Unarchive] Failed:', err) }
  }
  
  // Dismiss attention (stop yellow blink)
  async function handleDismiss(sessionId: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    openMenu = null
    try {
      await dismissSession(sessionId)
      store.updateSession({ id: sessionId, status: 'stale', needs_attention: 0 })
    } catch (err) { console.warn('[Dismiss] Failed:', err) }
  }
  
  // Delete session permanently
  async function handleDelete(sessionId: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    openMenu = null
    try {
      await deleteSession(sessionId)
      store.removeSession(sessionId)
    } catch (err) { console.warn('[Delete] Failed:', err) }
  }
  
  // Archive all sessions in a project folder
  async function handleArchiveFolder(group: ProjectGroup, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    openMenu = null
    const allSessions = [...group.sessions]
    for (const children of group.childMap.values()) allSessions.push(...children)
    for (const s of allSessions) {
      if (s.status !== 'archived') {
        try {
          await archiveSession(s.id)
          store.updateSession({ id: s.id, status: 'archived' })
        } catch (err) { console.warn('[Archive] Failed:', err) }
      }
    }
  }
  
  // Group sessions by project directory
  interface ProjectGroup {
    directory: string
    name: string
    sessions: Session[]
    childMap: Map<string, Session[]>  // parent_id -> children
  }
  
  let projectGroups = $derived.by(() => {
    const groups = new Map<string, ProjectGroup>()
    const filtered = store.filteredSessions
    
    // First pass: group by directory, separate parents/children
    for (const session of filtered) {
      const dir = session.directory || 'Unknown'
      
      if (!groups.has(dir)) {
        groups.set(dir, {
          directory: dir,
          name: getProjectName(dir),
          sessions: [],
          childMap: new Map()
        })
      }
      
      const group = groups.get(dir)!
      
      // If has parent, add to childMap
      if (session.parent_session_id) {
        const existing = group.childMap.get(session.parent_session_id) || []
        existing.push(session)
        group.childMap.set(session.parent_session_id, existing)
      } else {
        // Root session (no parent)
        group.sessions.push(session)
      }
    }
    
    // Sort groups by name
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
  })
  
  // Get children for a session
  function getChildren(group: ProjectGroup, sessionId: string): Session[] {
    return group.childMap.get(sessionId) || []
  }
  
  // Count all sessions in a project (including children)
  function getProjectSessionCount(group: ProjectGroup): number {
    let count = group.sessions.length
    for (const children of group.childMap.values()) {
      count += children.length
    }
    return count
  }
  
  // Check if project has any active sessions
  function hasActiveSession(group: ProjectGroup): boolean {
    for (const s of group.sessions) {
      if (s.status === 'active') return true
      for (const child of getChildren(group, s.id)) {
        if (child.status === 'active') return true
      }
    }
    return false
  }
  
  function toggleProject(dir: string) {
    if (expandedProjects.has(dir)) {
      expandedProjects.delete(dir)
    } else {
      expandedProjects.add(dir)
    }
    expandedProjects = new Set(expandedProjects)  // trigger reactivity
  }
  
  function toggleSession(id: string) {
    if (expandedSessions.has(id)) {
      expandedSessions.delete(id)
    } else {
      expandedSessions.add(id)
    }
    expandedSessions = new Set(expandedSessions)
  }
  
  // Auto-expand projects with active sessions on mount (run once)
  let initialized = false
  
  $effect(() => {
    if (initialized) return
    if (projectGroups.length === 0) return
    
    let changed = false
    for (const group of projectGroups) {
      if (hasActiveSession(group) && !expandedProjects.has(group.directory)) {
        expandedProjects.add(group.directory)
        changed = true
      }
    }
    if (changed) {
      expandedProjects = new Set(expandedProjects)
    }
    initialized = true
  })
  
  // Check if a session is currently selected (via URL)
  function isSelected(sessionId: string): boolean {
    return $page.url.pathname === `/sessions/${sessionId}`
  }
  
  // Auto-expand tree to show currently selected session when URL changes
  $effect(() => {
    const path = $page.url.pathname
    const match = path.match(/^\/sessions\/(.+)$/)
    if (!match) return
    
    const selectedId = match[1]
    
    // Find which project/session contains this ID
    for (const group of projectGroups) {
      // Check if it's a root session
      const rootSession = group.sessions.find(s => s.id === selectedId)
      if (rootSession) {
        // Expand the project
        if (!expandedProjects.has(group.directory)) {
          expandedProjects.add(group.directory)
          expandedProjects = new Set(expandedProjects)
        }
        return
      }
      
      // Check if it's a child session (subagent)
      for (const [parentId, children] of group.childMap.entries()) {
        const childSession = children.find(c => c.id === selectedId)
        if (childSession) {
          // Expand the project
          if (!expandedProjects.has(group.directory)) {
            expandedProjects.add(group.directory)
            expandedProjects = new Set(expandedProjects)
          }
          // Expand the parent session
          if (!expandedSessions.has(parentId)) {
            expandedSessions.add(parentId)
            expandedSessions = new Set(expandedSessions)
          }
          return
        }
      }
    }
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="h-full flex flex-col overflow-hidden" onclick={handleGlobalClick}>
  <!-- Header -->
  {#if !collapsed}
    <div class="px-3 py-2 border-b border-[var(--border-subtle)]">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wider">Projects</span>
        <span class="text-xs mono text-[var(--fg-muted)]">{store.filteredSessions.length}</span>
      </div>
    </div>
  {/if}
  
  <!-- Tree view -->
  <div class="flex-1 overflow-y-auto py-1">
    {#if projectGroups.length === 0}
      <div class="px-3 py-4 text-sm text-[var(--fg-muted)] text-center">
        No sessions found
      </div>
    {:else}
      {#each projectGroups as group}
        <!-- Project node -->
        <div class="select-none">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="group flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
            onclick={() => toggleProject(group.directory)}
            title={collapsed ? group.name : undefined}
          >
            <!-- Expand icon -->
            {#if !collapsed}
              <ChevronRight 
                class="w-4 h-4 text-[var(--fg-muted)] transition-transform {expandedProjects.has(group.directory) ? 'rotate-90' : ''}" 
              />
            {/if}
            <!-- Folder icon -->
            {#if expandedProjects.has(group.directory)}
              <FolderOpen class="w-4 h-4 {hasActiveSession(group) ? 'text-[var(--accent-blue)]' : 'text-[var(--fg-muted)]'}" />
            {:else}
              <Folder class="w-4 h-4 {hasActiveSession(group) ? 'text-[var(--accent-blue)]' : 'text-[var(--fg-muted)]'}" />
            {/if}
            <!-- Project name -->
            {#if !collapsed}
              <span class="flex-1 text-base truncate" style="color: {getProjectColor(group.directory, allDirs)}">{group.name}</span>
              <!-- Count badge -->
              <span class="text-xs mono px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--fg-muted)]">
                {getProjectSessionCount(group)}
              </span>
              <!-- 3-dot menu for folder -->
              <div class="relative">
                <button
                  type="button"
                  onclick={(e) => toggleMenu(`project:${group.directory}`, e)}
                  class="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical class="w-3.5 h-3.5" />
                </button>
                {#if openMenu === `project:${group.directory}`}
                  <div 
                    class="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg py-1 min-w-[140px]"
                    style="box-shadow: var(--shadow-md);"
                  >
                    <button
                      type="button"
                      onclick={(e) => handleArchiveFolder(group, e)}
                      class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <Archive class="w-3.5 h-3.5" />
                      Archive All
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
          
          <!-- Sessions under project -->
          {#if expandedProjects.has(group.directory) && !collapsed}
            <div class="ml-4">
              {#each group.sessions as session}
                {@const children = getChildren(group, session.id)}
                {@const hasChildren = children.length > 0}
                
                <!-- Parent session -->
                <div class="select-none">
                  <a 
                    href="/sessions/{session.id}"
                    class="group flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors rounded-sm
                           {isSelected(session.id) ? 'bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent-blue)]' : ''}"
                  >
                    <!-- Expand icon (if has children) -->
                    {#if hasChildren}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <span 
                        class="cursor-pointer"
                        onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSession(session.id) }}
                      >
                        <ChevronRight 
                          class="w-4 h-4 text-[var(--fg-muted)] transition-transform {expandedSessions.has(session.id) ? 'rotate-90' : ''}" 
                        />
                      </span>
                    {:else}
                      <span class="w-4"></span>
                    {/if}
                    
                    <StatusDot status={getEffectiveStatus(session, store.sessions, store.tick)} size="sm" />
                    <span class="flex-1 text-sm truncate text-[var(--fg-secondary)]">
                      {session.title || session.id.slice(0, 8)}
                    </span>
                    {#if session.needs_attention}
                      <span class="w-2 h-2 rounded-full bg-[var(--accent-amber)]"></span>
                    {/if}
                    {#if hasChildren}
                      <span class="text-xs mono text-[var(--fg-muted)]">+{children.length}</span>
                    {/if}
                    <!-- 3-dot menu for session -->
                    <div class="relative">
                      <button
                        type="button"
                        onclick={(e) => toggleMenu(`session:${session.id}`, e)}
                        class="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical class="w-3.5 h-3.5" />
                      </button>
                      {#if openMenu === `session:${session.id}`}
                        <div 
                          class="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg py-1 min-w-[130px]"
                          style="box-shadow: var(--shadow-md);"
                        >
                          {#if session.status !== 'active' && session.status !== 'stale' && session.status !== 'archived'}
                            <button
                              type="button"
                              onclick={(e) => handleDismiss(session.id, e)}
                              class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <BellOff class="w-3.5 h-3.5" />
                              Dismiss
                            </button>
                          {/if}
                          {#if session.status === 'archived'}
                            <button
                              type="button"
                              onclick={(e) => handleUnarchive(session.id, e)}
                              class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <ArchiveRestore class="w-3.5 h-3.5" />
                              Restore
                            </button>
                          {:else}
                            <button
                              type="button"
                              onclick={(e) => handleArchive(session.id, e)}
                              class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <Archive class="w-3.5 h-3.5" />
                              Archive
                            </button>
                          {/if}
                          <button
                            type="button"
                            onclick={(e) => handleDelete(session.id, e)}
                            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)] transition-colors"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      {/if}
                    </div>
                  </a>
                  
                  <!-- Child sessions (subagents) -->
                  {#if hasChildren && expandedSessions.has(session.id)}
                    <div class="ml-4 border-l border-[var(--border-subtle)]">
                      {#each children as child}
                        <a 
                          href="/sessions/{child.id}"
                          class="group flex items-center gap-2 pl-3 pr-2 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors rounded-sm
                                 {isSelected(child.id) ? 'bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent-purple)]' : ''}"
                        >
                          <GitBranch class="w-3 h-3 text-[var(--fg-muted)]" />
                          <StatusDot status={getEffectiveStatus(child, store.sessions, store.tick)} size="sm" />
                          <span class="flex-1 text-sm truncate text-[var(--fg-muted)]">
                            {child.title || 'subagent'}
                          </span>
                          {#if child.needs_attention}
                            <span class="w-2 h-2 rounded-full bg-[var(--accent-amber)]"></span>
                          {/if}
                          <!-- 3-dot menu for child -->
                          <div class="relative">
                            <button
                              type="button"
                              onclick={(e) => toggleMenu(`session:${child.id}`, e)}
                              class="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical class="w-3.5 h-3.5" />
                            </button>
                            {#if openMenu === `session:${child.id}`}
                              <div 
                                class="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg py-1 min-w-[130px]"
                                style="box-shadow: var(--shadow-md);"
                              >
                                {#if child.status !== 'active' && child.status !== 'stale' && child.status !== 'archived'}
                                  <button
                                    type="button"
                                    onclick={(e) => handleDismiss(child.id, e)}
                                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                  >
                                    <BellOff class="w-3.5 h-3.5" />
                                    Dismiss
                                  </button>
                                {/if}
                                {#if child.status === 'archived'}
                                  <button
                                    type="button"
                                    onclick={(e) => handleUnarchive(child.id, e)}
                                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                  >
                                    <ArchiveRestore class="w-3.5 h-3.5" />
                                    Restore
                                  </button>
                                {:else}
                                  <button
                                    type="button"
                                    onclick={(e) => handleArchive(child.id, e)}
                                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                  >
                                    <Archive class="w-3.5 h-3.5" />
                                    Archive
                                  </button>
                                {/if}
                                <button
                                  type="button"
                                  onclick={(e) => handleDelete(child.id, e)}
                                  class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                  <Trash2 class="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            {/if}
                          </div>
                        </a>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
