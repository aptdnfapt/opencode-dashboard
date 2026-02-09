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

<footer class="relative h-7 flex items-center justify-between px-4 bg-[var(--bg-secondary)] text-[11px] mono">
  <!-- Top gradient line — mirrors TopBar's bottom glow -->
  <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-blue)]/15 to-transparent"></div>

  <!-- Left: Connection status -->
  <div class="flex items-center gap-4">
    <div class="flex items-center gap-1.5">
      <span
        class="w-2 h-2 rounded-full {store.connectionStatus === 'connected' ? 'bg-[var(--accent-green)] ring-pulse' : store.connectionStatus === 'error' ? 'bg-[var(--accent-red)]' : 'bg-[var(--fg-muted)]'}"
        style={store.connectionStatus === 'connected' ? 'color: rgba(63,185,80,0.4);' : ''}
      ></span>
      <span class={connStatus.color}>{connStatus.label}</span>
    </div>
    
    {#if store.filters.hostname}
      <span class="text-[var(--fg-muted)]/40">·</span>
      <span class="text-[var(--fg-muted)]">
        Instance: <span class="text-[var(--fg-secondary)]">{store.filters.hostname}</span>
      </span>
    {/if}
    
    {#if store.filters.directory}
      <span class="text-[var(--fg-muted)]/40">·</span>
      <span class="text-[var(--fg-muted)]">
        Project: <span class="text-[var(--fg-secondary)]">{store.filters.directory.split('/').pop()}</span>
      </span>
    {/if}
  </div>
  
  <!-- Right: Stats with dot separators -->
  <div class="flex items-center gap-2 text-[var(--fg-muted)]">
    <span>
      Active: <span class="text-[var(--accent-green)]">{store.stats.active}</span>
    </span>
    <span class="opacity-30">·</span>
    <span>
      Idle: <span class="text-[var(--accent-amber)]">{store.stats.idle}</span>
    </span>
    {#if store.stats.stale > 0}
      <span class="opacity-30">·</span>
      <span>
        Stale: <span class="text-zinc-500">{store.stats.stale}</span>
      </span>
    {/if}
    {#if store.stats.attention > 0}
      <span class="opacity-30">·</span>
      <span>
        Attention: <span class="text-[var(--accent-red)]">{store.stats.attention}</span>
      </span>
    {/if}
    <span class="opacity-30">·</span>
    <span>
      Tokens: <span class="text-[var(--fg-secondary)]">{formatTokens(store.stats.totalTokens)}</span>
    </span>
    <span class="opacity-30">·</span>
    <span>
      Cost: <span class="text-[var(--fg-secondary)]">{formatCost(store.stats.totalCost)}</span>
    </span>
  </div>
</footer>
