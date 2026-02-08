<script lang="ts">
  import { store } from '$lib/store.svelte'
  import { formatTokens, formatCost } from '$lib/utils'
  
  // Connection status config
  const statusConfig = {
    connecting: { label: 'Connecting...', color: 'text-[var(--accent-amber)]' },
    connected: { label: 'Connected', color: 'text-[var(--accent-green)]' },
    disconnected: { label: 'Disconnected', color: 'text-[var(--fg-muted)]' },
    error: { label: 'Error', color: 'text-[var(--accent-red)]' }
  }
  
  let connStatus = $derived(statusConfig[store.connectionStatus])
</script>

<footer class="h-6 flex items-center justify-between px-4 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] text-[10px] mono">
  <!-- Left: Connection status -->
  <div class="flex items-center gap-4">
    <div class="flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full {store.connectionStatus === 'connected' ? 'bg-[var(--accent-green)] pulse' : store.connectionStatus === 'error' ? 'bg-[var(--accent-red)]' : 'bg-[var(--fg-muted)]'}"></span>
      <span class={connStatus.color}>{connStatus.label}</span>
    </div>
    
    {#if store.filters.hostname}
      <span class="text-[var(--fg-muted)]">
        Instance: <span class="text-[var(--fg-secondary)]">{store.filters.hostname}</span>
      </span>
    {/if}
    
    {#if store.filters.directory}
      <span class="text-[var(--fg-muted)]">
        Project: <span class="text-[var(--fg-secondary)]">{store.filters.directory.split('/').pop()}</span>
      </span>
    {/if}
  </div>
  
  <!-- Right: Stats -->
  <div class="flex items-center gap-4 text-[var(--fg-muted)]">
    <span>
      Active: <span class="text-[var(--accent-green)]">{store.stats.active}</span>
    </span>
    <span>
      Idle: <span class="text-[var(--accent-amber)]">{store.stats.idle}</span>
    </span>
    {#if store.stats.attention > 0}
      <span>
        Attention: <span class="text-[var(--accent-red)]">{store.stats.attention}</span>
      </span>
    {/if}
    <span>
      Tokens: <span class="text-[var(--fg-secondary)]">{formatTokens(store.stats.totalTokens)}</span>
    </span>
    <span>
      Cost: <span class="text-[var(--fg-secondary)]">{formatCost(store.stats.totalCost)}</span>
    </span>
  </div>
</footer>
