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

<div class="flex items-center gap-2 px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
  <span class={`w-2 h-2 rounded-full ${config.dot} ${store.connectionStatus === 'connected' ? 'pulse' : ''}`}></span>
  <span class={`mono text-xs ${config.color}`}>{config.label}</span>
</div>
