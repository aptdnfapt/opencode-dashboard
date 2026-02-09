<script lang="ts">
  import { store } from '$lib/store.svelte'
  
  const statusConfig = {
    connecting: { label: 'Connecting', color: 'text-[var(--accent-amber)]', dot: 'bg-[var(--accent-amber)]' },
    connected: { label: 'Live', color: 'text-[var(--accent-green)]', dot: 'bg-[var(--accent-green)]' },
    disconnected: { label: 'Offline', color: 'text-[var(--fg-muted)]', dot: 'bg-[var(--fg-muted)]' },
    error: { label: 'Error', color: 'text-[var(--accent-red)]', dot: 'bg-[var(--accent-red)]' }
  }
  
  const config = $derived(statusConfig[store.connectionStatus])
</script>

<div class="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] transition-all duration-200">
  <span
    class={`w-2 h-2 rounded-full transition-all duration-300 ${config.dot} ${store.connectionStatus === 'connected' ? 'ring-pulse' : ''}`}
    style={store.connectionStatus === 'connected' ? 'box-shadow: 0 0 6px rgba(63,185,80,0.4); color: rgba(63,185,80,0.4);' : ''}
  ></span>
  <span class={`mono text-xs ${config.color} transition-colors duration-200`}>{config.label}</span>
</div>
