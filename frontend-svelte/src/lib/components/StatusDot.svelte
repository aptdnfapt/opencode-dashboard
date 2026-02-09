<script lang="ts">
  import { cn } from '$lib/utils'
  
  interface Props {
    status: 'active' | 'idle' | 'error' | 'stale' | 'archived'
    size?: 'sm' | 'md'
  }
  
  let { status, size = 'sm' }: Props = $props()
  
  const colors = {
    active: 'bg-[var(--accent-green)]',
    idle: 'bg-[var(--accent-amber)]',
    error: 'bg-[var(--accent-red)]',
    stale: 'bg-[var(--fg-muted)]',
    archived: 'bg-zinc-600'
  }
</script>

<span 
  class={cn(
    'inline-block rounded-full',
    size === 'sm' ? 'w-2 h-2' : 'w-3 h-3',
    colors[status],
    status === 'active' && 'pulse'
  )}
  title={status}
></span>
