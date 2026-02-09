<script lang="ts">
  import { store } from '$lib/store.svelte'
  import { page } from '$app/stores'
  import type { Session } from '$lib/types'
  import StatusDot from './StatusDot.svelte'
  import { getProjectName } from '$lib/utils'
  import { ChevronRight, Folder, FolderOpen, GitBranch } from 'lucide-svelte'
  
  // Stale threshold
  const STALE_THRESHOLD_MS = 3 * 60 * 1000
  
  // Project color palette - consistent color per project name
  // Avoiding blue (model) and green (active status)
  const projectColors = [
    'var(--accent-amber)',
    'var(--accent-purple)',
    '#f97583',  // pink
    '#ff7b72',  // coral
    '#ffa657',  // orange
    '#d2a8ff',  // light purple
    '#e6b450',  // gold
    '#ffc0cb',  // light pink
  ]
  
  function getProjectColor(directory: string | null): string {
    if (!directory) return 'var(--fg-secondary)'
    let hash = 0
    for (let i = 0; i < directory.length; i++) {
      hash = ((hash << 5) - hash) + directory.charCodeAt(i)
      hash = hash & hash
    }
    return projectColors[Math.abs(hash) % projectColors.length]
  }
  
  // Compute effective status: idle > 3min = stale (unless sub-agents are active)
  function getEffectiveStatus(session: Session): 'active' | 'idle' | 'error' | 'stale' | 'archived' {
    if (session.status === 'archived') return 'archived'
    if (session.status !== 'idle') return session.status
    const idleTime = Date.now() - new Date(session.updated_at).getTime()
    const hasActiveSubs = store.hasActiveSubAgents(session.id)
    return (idleTime > STALE_THRESHOLD_MS && !hasActiveSubs) ? 'stale' : 'idle'
  }
  
  // Props for collapsed mode
  let { collapsed = false } = $props()
  
  // Track expanded state for projects and sessions
  let expandedProjects = $state<Set<string>>(new Set())
  let expandedSessions = $state<Set<string>>(new Set())
  
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

<div class="h-full flex flex-col overflow-hidden">
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
            class="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
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
              <span class="flex-1 text-base truncate" style="color: {getProjectColor(group.directory)}">{group.name}</span>
              <!-- Count badge -->
              <span class="text-xs mono px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--fg-muted)]">
                {getProjectSessionCount(group)}
              </span>
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
                    class="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors rounded-sm
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
                    
                    <StatusDot status={getEffectiveStatus(session)} size="sm" />
                    <span class="flex-1 text-sm truncate text-[var(--fg-secondary)]">
                      {session.title || session.id.slice(0, 8)}
                    </span>
                    {#if session.needs_attention}
                      <span class="w-2 h-2 rounded-full bg-[var(--accent-amber)]"></span>
                    {/if}
                    {#if hasChildren}
                      <span class="text-xs mono text-[var(--fg-muted)]">+{children.length}</span>
                    {/if}
                  </a>
                  
                  <!-- Child sessions (subagents) -->
                  {#if hasChildren && expandedSessions.has(session.id)}
                    <div class="ml-4 border-l border-[var(--border-subtle)]">
                      {#each children as child}
                        <a 
                          href="/sessions/{child.id}"
                          class="flex items-center gap-2 pl-3 pr-2 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors rounded-sm
                                 {isSelected(child.id) ? 'bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent-purple)]' : ''}"
                        >
                          <GitBranch class="w-3 h-3 text-[var(--fg-muted)]" />
                          <StatusDot status={getEffectiveStatus(child)} size="sm" />
                          <span class="flex-1 text-sm truncate text-[var(--fg-muted)]">
                            {child.title || 'subagent'}
                          </span>
                          {#if child.needs_attention}
                            <span class="w-2 h-2 rounded-full bg-[var(--accent-amber)]"></span>
                          {/if}
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
