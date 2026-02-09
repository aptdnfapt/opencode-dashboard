<script lang="ts">
  import { page } from '$app/stores'
  import { store } from '$lib/store.svelte'
  import ConnectionBadge from './ConnectionBadge.svelte'
  
  // Nav items for top bar
  const navItems = [
    { href: '/', label: 'Sessions', icon: '◉' },
    { href: '/analytics', label: 'Analytics', icon: '◈' },
    { href: '/settings', label: 'Settings', icon: '◎' }
  ]
  
  // Derive unique hostnames from sessions
  let hostnames = $derived([...new Set(store.sessions.map(s => s.hostname))].sort())
  
  // Currently selected instance filter
  let selectedInstance = $derived(store.filters.hostname || 'all')
  
  function handleInstanceChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    store.setFilter('hostname', value === 'all' ? '' : value)
  }
</script>

<header class="relative h-12 flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
  <!-- Bottom gradient line — subtle glow border -->
  <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-blue)]/20 to-transparent"></div>

  <!-- Left: Logo -->
  <div class="flex items-center gap-6">
    <a href="/" class="flex items-center gap-2 group">
      <span class="text-lg font-bold text-[var(--accent-green)] transition-transform duration-200 group-hover:scale-110">⬡</span>
      <span class="font-semibold text-[var(--fg-primary)]">OpenCode</span>
      <span class="text-[10px] mono px-1.5 py-0.5 rounded bg-[var(--accent-green)]/10 text-[var(--accent-green)]/80 border border-[var(--accent-green)]/20">DASH</span>
    </a>
    
    <!-- Nav links -->
    <nav class="flex items-center gap-1">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all duration-150
                 {$page.url.pathname === item.href 
                   ? 'bg-[var(--bg-tertiary)] text-[var(--fg-primary)] shadow-[var(--shadow-sm)]' 
                   : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)]/60 hover:text-[var(--fg-primary)]'}"
        >
          <span class="mono text-xs opacity-50">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>
  </div>
  
  <!-- Right: Instance selector + Connection -->
  <div class="flex items-center gap-3">
    <!-- Instance dropdown -->
    <div class="flex items-center gap-2">
      <span class="text-xs text-[var(--fg-muted)]">Instance:</span>
      <select
        value={selectedInstance}
        onchange={handleInstanceChange}
        class="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-md px-2.5 py-1 text-xs mono text-[var(--fg-primary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors duration-150 cursor-pointer appearance-none pr-6"
        style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236e7681' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 6px center;"
      >
        <option value="all">All ({hostnames.length})</option>
        {#each hostnames as hostname}
          <option value={hostname}>{hostname}</option>
        {/each}
      </select>
    </div>
    
    <ConnectionBadge />
  </div>
</header>
