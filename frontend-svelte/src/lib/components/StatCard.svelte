<script lang="ts">
  interface Props {
    label: string
    value: string | number
    subvalue?: string
    color?: 'default' | 'green' | 'amber' | 'red' | 'blue'
  }
  
  let { label, value, subvalue, color = 'default' }: Props = $props()
  
  const colorClasses = {
    default: 'text-[var(--fg-primary)]',
    green: 'text-[var(--accent-green)]',
    amber: 'text-[var(--accent-amber)]',
    red: 'text-[var(--accent-red)]',
    blue: 'text-[var(--accent-blue)]'
  }
</script>

<div class="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
  <div class="text-xs text-[var(--fg-muted)] uppercase tracking-wide mb-1">{label}</div>
  <div class={`text-2xl font-semibold mono ${colorClasses[color]}`}>{value}</div>
  {#if subvalue}
    <div class="text-xs text-[var(--fg-secondary)] mt-1">{subvalue}</div>
  {/if}
</div>
