<script lang="ts">
  import { libraryStore, type ChamberFilter } from '$lib/library-store.svelte'

  let open = $state(false)

  const chamberOptions: Array<{ value: ChamberFilter; label: string }> = [
    { value: 'all', label: 'All chamber states' },
    { value: 'tracked-or-done', label: 'Tracked or done' },
    { value: 'tracked-only', label: 'Tracked only' },
    { value: 'done-only', label: 'Done only' },
    { value: 'non-chamber', label: 'Non-chamber only' }
  ]

  let summary = $derived.by(() => {
    const bits: string[] = []
    if (libraryStore.filters.projects.length) bits.push(`${libraryStore.filters.projects.length} projects`)
    if (libraryStore.filters.tags.length) bits.push(`${libraryStore.filters.tags.length} tags`)
    if (libraryStore.filters.search) bits.push(`search: ${libraryStore.filters.search}`)
    if (libraryStore.filters.chamber !== 'all') bits.push(chamberOptions.find((option) => option.value === libraryStore.filters.chamber)?.label || 'filtered')
    return bits.join(' • ')
  })
</script>

<div class="filter-shell">
  <button type="button" class="filter-trigger" onclick={() => (open = !open)}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
    <span>{summary}</span>
  </button>

  {#if open}
    <div class="filter-popover">
      <div class="popover-grid">
        <label class="field wide">
          <span>Search</span>
          <input
            type="text"
            value={libraryStore.filters.search}
            oninput={(event) => libraryStore.setSearch(event.currentTarget.value)}
            placeholder="Search title, project, tag"
          />
        </label>

        <label class="field">
          <span>Chamber state</span>
          <select value={libraryStore.filters.chamber} onchange={(event) => libraryStore.setChamberFilter(event.currentTarget.value as ChamberFilter)}>
            {#each chamberOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>

        <div class="field wide">
          <span>Quick visibility</span>
          <div class="toggle-row">
            <label><input type="checkbox" checked={libraryStore.filters.showTagged} onchange={(event) => libraryStore.setVisibility('tagged', event.currentTarget.checked)} /> Tagged</label>
            <label><input type="checkbox" checked={libraryStore.filters.showManual} onchange={(event) => libraryStore.setVisibility('manual', event.currentTarget.checked)} /> Manual</label>
          </div>
        </div>

        <div class="field wide">
          <span>Projects</span>
          <div class="chip-grid">
            {#each libraryStore.availableProjects as project}
              <button type="button" class:active={libraryStore.filters.projects.includes(project)} onclick={() => libraryStore.toggleProject(project)}>{project}</button>
            {/each}
          </div>
        </div>

        <div class="field wide">
          <span>Tags</span>
          <div class="chip-grid">
            {#each libraryStore.availableTags as tag}
              <button type="button" class:active={libraryStore.filters.tags.includes(tag)} onclick={() => libraryStore.toggleTag(tag)}>{tag}</button>
            {/each}
          </div>
        </div>
      </div>

      <div class="popover-actions">
        <button type="button" class="muted-btn" onclick={() => libraryStore.clearFilters()}>Reset</button>
        <button type="button" class="primary-btn" onclick={() => (open = false)}>Done</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-shell {
    position: relative;
    display: flex;
    justify-content: flex-end;
  }

  .filter-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-primary);
    font-size: 12px;
    cursor: pointer;
  }

  .filter-trigger svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .filter-trigger span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter-popover {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 40;
    width: min(760px, calc(100vw - 48px));
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
  }

  .popover-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field.wide {
    grid-column: 1 / -1;
  }

  .field span {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-muted);
  }

  .field input,
  .field select {
    width: 100%;
    padding: 9px 11px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-primary);
    font-size: 12px;
  }

  .toggle-row {
    display: flex;
    gap: 14px;
    color: var(--fg-secondary);
    font-size: 12px;
  }

  .toggle-row label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 160px;
    overflow: auto;
  }

  .chip-grid button {
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-secondary);
    font-size: 12px;
    cursor: pointer;
  }

  .chip-grid button.active {
    border-color: var(--accent-blue);
    color: var(--fg-primary);
    background: rgba(88, 166, 255, 0.12);
  }

  .popover-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 14px;
  }

  .muted-btn,
  .primary-btn {
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-primary);
    cursor: pointer;
  }

  .primary-btn {
    border-color: var(--accent-blue);
    background: rgba(88, 166, 255, 0.14);
  }
</style>
