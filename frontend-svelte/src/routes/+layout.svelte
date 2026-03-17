<script lang="ts">
  import '../app.css'
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { wsService } from '$lib/websocket.svelte'
  import { initAudioUnlock } from '$lib/audio'
  import { themeStore } from '$lib/theme.svelte'
  import TopBar from '$lib/components/TopBar.svelte'
  import StatusBar from '$lib/components/StatusBar.svelte'
  
  let { children } = $props()
  let isAuthenticated = $state(false)
  let isChecking = $state(true)
  let isEmbed = $derived($page.url.searchParams.get('embed') === '1')
  let currentPath = $derived($page.url.pathname)
  
  // Check auth state on mount and route change
  $effect(() => {
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
    initAudioUnlock()
    
    if (localStorage.getItem('dashboard_authenticated') === 'true') {
      wsService.connect()
      wsService.setupBrowserListeners()
    }
  })
  
  onDestroy(() => {
    wsService.disconnect()
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
{:else if isAuthenticated && isEmbed}
  <main class="h-screen overflow-auto bg-[var(--bg-primary)]">
    {@render children()}
  </main>
{:else if isAuthenticated}
  <!-- Main layout: TopBar + Content + StatusBar -->
  <div class="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
    <!-- Top Bar -->
    <TopBar />
    
    <!-- Main content area -->
    <main class="flex-1 overflow-auto bg-[var(--bg-primary)]">
      {@render children()}
    </main>
    
    <!-- Status Bar -->
    <StatusBar />
  </div>
{/if}
