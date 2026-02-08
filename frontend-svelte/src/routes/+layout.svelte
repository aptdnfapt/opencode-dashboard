<script lang="ts">
  import '../app.css'
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { wsService } from '$lib/websocket.svelte'
  import { themeStore } from '$lib/theme.svelte'
  import Sidebar from '$lib/components/Sidebar.svelte'
  
  let { children } = $props()
  let isAuthenticated = $state(false)
  let isChecking = $state(true)
  
  // Check auth state on mount and route change
  $effect(() => {
    // Subscribe to page changes
    const currentPath = $page.url.pathname as string
    const isLoginPage = currentPath === '/login'
    
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('dashboard_authenticated') === 'true'
      isAuthenticated = auth
      isChecking = false
      
      // Redirect to login if not authenticated (except on login page)
      if (!auth && !isLoginPage) {
        goto('/login')
      }
      // Redirect to home if authenticated and on login page
      else if (auth && isLoginPage) {
        goto('/')
      }
    }
  })
  
  onMount(() => {
    // Initialize theme from localStorage
    themeStore.init()
    
    // Only connect WS if authenticated
    if (localStorage.getItem('dashboard_authenticated') === 'true') {
      wsService.connect()
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
  <!-- Login page - no sidebar -->
  {@render children()}
{:else if isAuthenticated}
  <!-- Authenticated layout with sidebar -->
  <div class="flex h-screen overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
{/if}
