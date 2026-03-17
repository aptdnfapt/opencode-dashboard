<script lang="ts">
  import { libraryStore, type ChamberFilter, type LibraryTimeRange } from '$lib/library-store.svelte'

  let open = $state(false)

  const chamberOptions: Array<{ value: ChamberFilter; label: string }> = [
    { value: 'all', label: 'All chamber states' },
    { value: 'tracked-or-done', label: 'Tracked or done' },
    { value: 'tracked-only', label: 'Tracked only' },
    { value: 'done-only', label: 'Done only' },
    { value: 'non-chamber', label: 'Non-chamber only' }
  ]

  const timeRangeOptions: Array<{ value: LibraryTimeRange; label: string }> = [
    { value: '1h', label: 'Last 1 hour' },
    { value: '6h', label: 'Last 6 hours' },
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All time' }
  ]

  let customTimeInput = $state('')
  let searchInput = $state(libraryStore.filters.search)

  let summary = $derived.by(() => {
    const bits: string[] = []
    if (libraryStore.filters.projects.length) bits.push(`${libraryStore.filters.projects.length} projects`)
    if (libraryStore.filters.tags.length) bits.push(`${libraryStore.filters.tags.length} tags`)
    if (libraryStore.filters.search) bits.push(`search: ${libraryStore.filters.search}`)
    if (libraryStore.filters.chamber !== 'all') bits.push(chamberOptions.find((option) => option.value === libraryStore.filters.chamber)?.label || 'filtered')
    return bits.join(' • ') || 'All filters'
  })

  function parseCustomTime(input: string): number | null {
    const match = input.match(/^(\d+)([hd])$/i)
    if (!match) return null
    const num = parseInt(match[1], 10)
    const unit = match[2].toLowerCase()
    if (unit === 'h') return num * 60 * 60 * 1000
    if (unit === 'd') return num * 24 * 60 * 60 * 1000
    return null
  }

  function applyCustomTime() {
    const ms = parseCustomTime(customTimeInput)
    if (ms === null) return
    const since = Date.now() - ms
    libraryStore.filters = { ...libraryStore.filters, timeRange: 'all' }
    libraryStore.persistFilters()
    customTimeInput = ''
  }

  function handleSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    searchInput = value
    libraryStore.setSearch(value)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      applyCustomTime()
    }
  }

  function clearAllFilters() {
    libraryStore.clearFilters()
    searchInput = ''
    customTimeInput = ''
  }

  function closeModal() {
    open = false
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeModal()
    }
  }
</script>

<div class="filter-wrapper">
  <button type="button" class="filter-trigger" onclick={() => (open = true)}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
    <span>{summary}</span>
  </button>
</div>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events --><!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="filter-backdrop" onclick={closeModal} onkeydown={handleBackdropKeydown} role="button" tabindex="-1">
    <div class="filter-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Filter Sessions</h2>
        <button type="button" class="close-btn" onclick={closeModal} aria-label="Close filters">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="filter-section">
          <label for="filter-search" class="filter-label">Search</label>
          <input
            id="filter-search"
            type="text"
            value={searchInput}
            oninput={handleSearchInput}
            placeholder="Search title, project, tag..."
            class="filter-input"
          />
        </div>

        <div class="filter-section">
          <span class="filter-label">Time Range</span>
          <div class="time-range-grid" role="group" aria-label="Time range options">
            {#each timeRangeOptions as option}
              <button
                type="button"
                class="time-option"
                class:active={libraryStore.filters.timeRange === option.value}
                onclick={() => libraryStore.setTimeRange(option.value)}
                aria-pressed={libraryStore.filters.timeRange === option.value}
              >
                {option.label}
              </button>
            {/each}
          </div>
          <div class="custom-time">
            <input
              id="custom-time"
              type="text"
              value={customTimeInput}
              oninput={(e) => customTimeInput = (e.target as HTMLInputElement).value}
              onkeydown={handleKeydown}
              placeholder="Custom: 5h or 3d"
              class="filter-input small"
            />
            <button type="button" class="apply-btn" onclick={applyCustomTime}>Apply</button>
          </div>
        </div>

        <div class="filter-section">
          <label for="filter-chamber" class="filter-label">Chamber State</label>
          <select
            id="filter-chamber"
            value={libraryStore.filters.chamber}
            onchange={(e) => libraryStore.setChamberFilter((e.target as HTMLSelectElement).value as ChamberFilter)}
            class="filter-select"
          >
            {#each chamberOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <div class="filter-section">
          <span class="filter-label">Visibility</span>
          <div class="checkbox-row" role="group" aria-label="Visibility options">
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={libraryStore.filters.showTagged}
                onchange={(e) => libraryStore.setVisibility('tagged', e.currentTarget.checked)}
              />
              <span>Tagged sessions</span>
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={libraryStore.filters.showManual}
                onchange={(e) => libraryStore.setVisibility('manual', e.currentTarget.checked)}
              />
              <span>Manual sessions</span>
            </label>
          </div>
        </div>

        <div class="filter-section">
          <span class="filter-label">Projects ({libraryStore.availableProjects.length})</span>
          <div class="chip-grid" role="group" aria-label="Project filters">
            {#each libraryStore.availableProjects as project}
              <button
                type="button"
                class="chip-btn"
                class:active={libraryStore.filters.projects.includes(project)}
                onclick={() => libraryStore.toggleProject(project)}
                aria-pressed={libraryStore.filters.projects.includes(project)}
              >
                {project}
              </button>
            {/each}
          </div>
        </div>

        <div class="filter-section">
          <span class="filter-label">Tags ({libraryStore.availableTags.length})</span>
          <div class="chip-grid" role="group" aria-label="Tag filters">
            {#each libraryStore.availableTags as tag}
              <button
                type="button"
                class="chip-btn"
                class:active={libraryStore.filters.tags.includes(tag)}
                onclick={() => libraryStore.toggleTag(tag)}
                aria-pressed={libraryStore.filters.tags.includes(tag)}
              >
                {tag}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="reset-btn" onclick={clearAllFilters}>
          Reset All
        </button>
        <button type="button" class="done-btn" onclick={closeModal}>
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .filter-wrapper {
    display: flex;
  }

  .filter-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-primary);
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    white-space: nowrap;
  }

  .filter-trigger:hover {
    border-color: var(--border-highlight);
    background: var(--bg-secondary);
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
    max-width: 200px;
  }

  .filter-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    padding: 24px;
  }

  .filter-modal {
    width: 100%;
    max-width: 560px;
    max-height: calc(100vh - 48px);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-main);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-main);
  }

  .close-btn svg {
    width: 18px;
    height: 18px;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .filter-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .filter-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-muted);
  }

  .filter-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-primary);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }

  .filter-input:focus {
    border-color: var(--accent-blue);
  }

  .filter-input.small {
    padding: 8px 12px;
    font-size: 12px;
  }

  .filter-select {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-primary);
    font-size: 13px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .filter-select:focus {
    border-color: var(--accent-blue);
  }

  .time-range-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .time-option {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .time-option:hover {
    border-color: var(--border-highlight);
  }

  .time-option.active {
    border-color: var(--accent-blue);
    background: rgba(88, 166, 255, 0.12);
    color: var(--fg-primary);
  }

  .custom-time {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .custom-time .filter-input {
    flex: 1;
  }

  .apply-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--accent-blue);
    background: rgba(88, 166, 255, 0.14);
    color: var(--accent-blue);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .apply-btn:hover {
    background: rgba(88, 166, 255, 0.25);
  }

  .checkbox-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--fg-secondary);
    font-size: 13px;
    cursor: pointer;
  }

  .checkbox-label input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--accent-blue);
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 120px;
    overflow-y: auto;
    padding: 2px;
  }

  .chip-btn {
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .chip-btn:hover {
    border-color: var(--border-highlight);
  }

  .chip-btn.active {
    border-color: var(--accent-blue);
    color: var(--fg-primary);
    background: rgba(88, 166, 255, 0.12);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color);
  }

  .reset-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    color: var(--fg-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .reset-btn:hover {
    border-color: var(--border-highlight);
    color: var(--fg-primary);
  }

  .done-btn {
    padding: 8px 20px;
    border-radius: 6px;
    border: 1px solid var(--accent-blue);
    background: rgba(88, 166, 255, 0.14);
    color: var(--accent-blue);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .done-btn:hover {
    background: rgba(88, 166, 255, 0.25);
  }
</style>