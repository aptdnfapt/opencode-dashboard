<script lang="ts">
  import '../app.css'
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { wsService } from '$lib/websocket.svelte'
  import { themeStore } from '$lib/theme.svelte'
  import TopBar from '$lib/components/TopBar.svelte'
  import SessionTree from '$lib/components/SessionTree.svelte'
  import StatusBar from '$lib/components/StatusBar.svelte'
  import { PanelLeftClose, PanelLeft } from 'lucide-svelte'
  
  let { children } = $props()
  let isAuthenticated = $state(false)
  let isChecking = $state(true)
  let sidebarCollapsed = $state(false)
  
  // Load sidebar state from localStorage
  function loadSidebarState() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed')
      sidebarCollapsed = saved === 'true'
    }
  }
  
  // Toggle sidebar and persist
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed))
    }
  }
  
  // Keyboard shortcut handler (Cmd+B / Ctrl+B)
  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault()
      toggleSidebar()
    }
  }
  
  // Check auth state on mount and route change
  $effect(() => {
    const currentPath = $page.url.pathname as string
    const isLoginPage = currentPath === '/login'
    
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('dashboard_authenticated') === 'true'
      isAuthenticated = auth
      isChecking = false
      
      if (!auth && !isLoginPage) {
        goto('/login')
      } else if (auth && isLoginPage) {
        goto('/')
      }
    }
  })
  
  onMount(() => {
    themeStore.init()
    loadSidebarState()
    
    // Add keyboard listener
    window.addEventListener('keydown', handleKeydown)
    
    if (localStorage.getItem('dashboard_authenticated') === 'true') {
      wsService.connect()
      wsService.setupBrowserListeners() // visibility + network awareness
    }
  })
  
  onDestroy(() => {
    wsService.disconnect()
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

{#if isChecking}
  <!-- Loading state -->
  <div class="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
    <div class="text-[var(--fg-muted)]">Loading...</div>
  </div>
{:else if $page.url.pathname.startsWith('/login')}
  <!-- Login page - no layout -->
  {@render children()}
{:else if isAuthenticated}
  <!-- Main layout: TopBar + Sidebar + Content + StatusBar -->
  <div class="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
    <!-- Top Bar -->
    <TopBar />
    
    <!-- Main area: sidebar + content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left sidebar with session tree -->
      <aside 
        class="relative h-full flex flex-col bg-[var(--bg-secondary)] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style="width: {sidebarCollapsed ? '64px' : '256px'}"
      >
        <!-- Right edge gradient shadow — depth separator -->
        <div class="absolute right-0 top-0 bottom-0 w-px bg-[var(--border-subtle)]"></div>
        <div class="absolute right-0 top-0 bottom-0 w-4 pointer-events-none" style="background: linear-gradient(to right, transparent, rgba(0,0,0,0.15));"></div>

        <!-- Sidebar toggle button -->
        <div class="px-2 py-2 border-b border-[var(--border-subtle)] flex items-center {sidebarCollapsed ? 'justify-center' : 'justify-between'}">
          {#if !sidebarCollapsed}
            <span class="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] uppercase tracking-wider font-medium">
              <!-- Subtle list icon -->
              <svg class="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              Sessions
            </span>
          {/if}
          <button
            onclick={toggleSidebar}
            class="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] transition-all duration-150"
            title={sidebarCollapsed ? 'Expand sidebar (Cmd+B)' : 'Collapse sidebar (Cmd+B)'}
          >
            {#if sidebarCollapsed}
              <PanelLeft class="w-4 h-4" />
            {:else}
              <PanelLeftClose class="w-4 h-4" />
            {/if}
          </button>
        </div>
        
        <!-- Session tree -->
        <div class="flex-1 overflow-hidden">
          <SessionTree collapsed={sidebarCollapsed} />
        </div>
      </aside>
      
      <!-- Main content area -->
      <main class="flex-1 overflow-auto bg-[var(--bg-primary)]">
        {@render children()}
      </main>
    </div>
    
    <!-- Status Bar -->
    <StatusBar />
  </div>
{/if}
