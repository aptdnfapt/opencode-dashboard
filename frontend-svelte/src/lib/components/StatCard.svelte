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

  // CSS variable for the accent border/gradient tint per color
  const accentVars: Record<string, string> = {
    default: 'var(--fg-muted)',
    green: 'var(--accent-green)',
    amber: 'var(--accent-amber)',
    red: 'var(--accent-red)',
    blue: 'var(--accent-blue)'
  }
</script>

<div
  class="relative p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border)]"
  style="box-shadow: var(--shadow-sm); background-image: var(--gradient-subtle);"
>
  <!-- Colored left accent strip -->
  <div
    class="absolute left-0 top-0 bottom-0 w-[2px] rounded-l-lg"
    style="background: {accentVars[color]}; opacity: 0.7;"
  ></div>

  <div class="text-xs text-[var(--fg-muted)] uppercase tracking-wider mb-1.5 font-medium">{label}</div>
  <div class={`text-3xl font-bold mono tracking-tight ${colorClasses[color]}`}>{value}</div>
  {#if subvalue}
    <div class="text-xs text-[var(--fg-secondary)] mt-1.5">{subvalue}</div>
  {/if}
</div>
