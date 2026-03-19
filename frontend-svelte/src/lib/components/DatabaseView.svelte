<script lang="ts">
  import { libraryStore } from '$lib/library-store.svelte'

  interface Props {
    onRowClick?: (sessionId: string) => void
  }

  let { onRowClick }: Props = $props()

  function formatDuration(ms: number): string {
    const mins = Math.round(ms / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remaining = mins % 60
    return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function relationClass(tone: string): string {
    switch (tone) {
      case 'tag': return 'tag-ralph'
      case 'done': return 'tag-chamber'
      case 'tracked': return 'tag-tracked'
      case 'subagent': return 'tag-subagent'
      default: return 'tag-manual'
    }
  }
</script>

<div class="database-view">
  <table class="db-table">
    <thead>
      <tr>
        <th style="width: 40px;"></th>
        <th>Project</th>
        <th>Tag / Type</th>
        <th>Task Summary</th>
        <th>Status</th>
        <th>Last Active</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      {#each libraryStore.databaseRows as row (row.session.id)}
        <tr onclick={() => onRowClick?.(row.session.id)}>
          <td>
            {#if row.session.status === 'active' || row.session.status === 'idle'}
              <svg class="icon icon-success" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            {:else if row.session.status === 'error'}
              <svg class="icon icon-error" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            {:else}
              <svg class="icon icon-manual" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
            {/if}
          </td>
          <td class="project-name">{row.projectName}</td>
          <td>
            <span class={`tag-badge ${relationClass(row.relationTone)}`}>{row.relationLabel}</span>
          </td>
          <td class="cell-prompt">{row.session.title}</td>
          <td><span class="status-badge">{row.session.status}</span></td>
          <td>{formatDate(row.lastActiveAt)}</td>
          <td>{formatDuration(row.durationMs)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .database-view {
    height: 100%;
    overflow: auto;
    padding: 24px 32px;
  }

  .db-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .db-table th {
    text-align: left;
    padding: 12px 16px;
    color: var(--text-muted);
    font-weight: 500;
    border-bottom: 1px solid var(--border-highlight);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 11px;
  }

  .db-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-main);
    transition: background-color 0.5s ease;
  }

  .db-table tr:hover td {
    background: var(--bg-card-hover);
    cursor: pointer;
    transition: background-color 0s;
  }

  .icon { width: 14px; height: 14px; }
  .icon-success { fill: var(--color-success); }
  .icon-error { fill: var(--color-error); }
  .icon-manual { fill: var(--color-manual); }

  .project-name { font-weight: 600; }

  .tag-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid;
    font-size: 11px;
    font-family: var(--font-mono);
  }

  .tag-ralph {
    color: var(--color-ralph);
    border-color: rgba(198, 120, 221, 0.3);
    background: rgba(198, 120, 221, 0.05);
  }

  .tag-chamber {
    color: #f472b6;
    border-color: rgba(244, 114, 182, 0.3);
    background: rgba(244, 114, 182, 0.05);
  }

  .tag-tracked {
    color: var(--accent-blue);
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.05);
  }

  .tag-manual {
    color: var(--color-manual);
    border-color: rgba(96, 165, 250, 0.3);
    background: rgba(96, 165, 250, 0.05);
  }

  .tag-subagent {
    color: #7dd3fc;
    border-color: rgba(125, 211, 252, 0.3);
    background: rgba(125, 211, 252, 0.06);
  }

  .cell-prompt {
    max-width: 460px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-muted);
  }

  .status-badge {
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: capitalize;
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-secondary);
  }
</style>
