<script lang="ts">
  import { page } from '$app/stores'
  import ConnectionBadge from './ConnectionBadge.svelte'
  
  const navItems = [
    { href: '/', label: 'Sessions', icon: '◉' },
    { href: '/analytics', label: 'Analytics', icon: '◈' },
    { href: '/settings', label: 'Settings', icon: '◎' }
  ]
</script>

<aside class="w-56 h-screen flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)]">
  <!-- Logo -->
  <div class="p-4 border-b border-[var(--border-subtle)]">
    <div class="flex items-center gap-2">
      <span class="text-lg font-semibold text-[var(--fg-primary)]">OpenCode</span>
      <span class="text-xs mono text-[var(--fg-muted)]">dashboard</span>
    </div>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 p-2">
    {#each navItems as item}
      <a
        href={item.href}
        class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
               {$page.url.pathname === item.href 
                 ? 'bg-[var(--bg-tertiary)] text-[var(--fg-primary)]' 
                 : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--fg-primary)]'}"
      >
        <span class="mono text-base">{item.icon}</span>
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <!-- Footer -->
  <div class="p-3 border-t border-[var(--border-subtle)]">
    <ConnectionBadge />
  </div>
</aside>
