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

<header class="h-12 flex items-center justify-between px-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
  <!-- Left: Logo -->
  <div class="flex items-center gap-6">
    <a href="/" class="flex items-center gap-2">
      <span class="text-lg font-bold text-[var(--accent-green)]">⬡</span>
      <span class="font-semibold text-[var(--fg-primary)]">OpenCode</span>
      <span class="text-[10px] mono px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--fg-muted)]">DASH</span>
    </a>
    
    <!-- Nav links -->
    <nav class="flex items-center gap-1">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors
                 {$page.url.pathname === item.href 
                   ? 'bg-[var(--bg-tertiary)] text-[var(--fg-primary)]' 
                   : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--fg-primary)]'}"
        >
          <span class="mono text-xs opacity-60">{item.icon}</span>
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
        class="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs mono text-[var(--fg-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
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
