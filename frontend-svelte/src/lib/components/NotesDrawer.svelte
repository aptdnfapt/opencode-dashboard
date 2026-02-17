<script lang="ts">
  // Pull-tab drawer for notes — supports session-scoped and project-scoped views
  // Session view: notes for current session only (existing behavior)
  // Project view: notes across all sessions sharing same directory
  import type { Note, ProjectNote } from '$lib/types'
  import { getSessionNotes, getProjectNotes, createNote, updateNote, deleteNote } from '$lib/api'
  import { formatRelativeTime } from '$lib/utils'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { StickyNote, Plus, Trash2, ChevronLeft, ChevronRight, Pencil, Check, X, FolderOpen, MessageSquare } from 'lucide-svelte'

  // Props
  interface Props {
    sessionId: string
    directory: string | null        // project directory — needed for project-scoped queries
    totalEvents: number
    onScrollToEvent?: (index: number) => void
  }
  let { sessionId, directory, totalEvents, onScrollToEvent }: Props = $props()

  // View mode toggle: 'session' = this session only, 'project' = all sessions in same directory
  let viewMode = $state<'session' | 'project'>('session')

  // Drawer state — auto-open if ?notes= param present (preserves drawer across navigation)
  let open = $state(false)

  // On mount: if URL has ?notes=project or ?notes=session, open drawer in that mode
  $effect(() => {
    const notesParam = $page.url.searchParams.get('notes')
    if (notesParam === 'project' || notesParam === 'session') {
      open = true
      viewMode = notesParam
      loadCurrentView()
      // Clean up the URL param so it doesn't stick around
      const url = new URL(window.location.href)
      url.searchParams.delete('notes')
      history.replaceState(null, '', url.pathname + url.hash)
    }
  })
  let sessionNotes = $state<Note[]>([])
  let projectNotes = $state<ProjectNote[]>([])
  let loading = $state(false)

  // New note form
  let composing = $state(false)
  let newContent = $state('')
  let saving = $state(false)

  // Edit state
  let editingId = $state<number | null>(null)
  let editContent = $state('')
  let editSaving = $state(false)

  // Derive which notes list to show based on toggle
  let notes = $derived<(Note | ProjectNote)[]>(viewMode === 'session' ? sessionNotes : projectNotes)

  // Load session notes
  async function loadSessionNotes() {
    loading = true
    try {
      sessionNotes = await getSessionNotes(sessionId)
    } catch (err) {
      console.warn('Failed to load session notes:', err)
    } finally {
      loading = false
    }
  }

  // Load project notes (all sessions in same directory)
  async function loadProjectNotes() {
    if (!directory) return
    loading = true
    try {
      projectNotes = await getProjectNotes(directory)
    } catch (err) {
      console.warn('Failed to load project notes:', err)
    } finally {
      loading = false
    }
  }

  // Toggle drawer open/close
  function toggle() {
    open = !open
    if (open) loadCurrentView()
  }

  // Load whichever view is active
  function loadCurrentView() {
    if (viewMode === 'session') loadSessionNotes()
    else loadProjectNotes()
  }

  // Switch view mode and reload
  function switchMode(mode: 'session' | 'project') {
    if (viewMode === mode) return
    viewMode = mode
    loadCurrentView()
  }

  // Create a new note (always tied to current session)
  async function handleSave() {
    if (!newContent.trim() || saving) return
    saving = true
    try {
      const note = await createNote(sessionId, newContent.trim())
      // Add to session notes list
      sessionNotes = [note, ...sessionNotes]
      // If in project view, also add with session_title context
      if (viewMode === 'project') {
        loadProjectNotes()  // reload to get session_title from server
      }
      newContent = ''
      composing = false
    } catch (err) {
      console.warn('Failed to create note:', err)
    } finally {
      saving = false
    }
  }

  // Start editing
  function startEdit(note: Note | ProjectNote) {
    editingId = note.id
    editContent = note.content
  }

  // Save edit
  async function handleEditSave() {
    if (!editContent.trim() || editSaving || editingId === null) return
    editSaving = true
    try {
      const updated = await updateNote(editingId, editContent.trim())
      sessionNotes = sessionNotes.map(n => n.id === editingId ? updated : n)
      // Refresh project notes too if in project view
      if (viewMode === 'project') loadProjectNotes()
      editingId = null
      editContent = ''
    } catch (err) {
      console.warn('Failed to update note:', err)
    } finally {
      editSaving = false
    }
  }

  function cancelEdit() {
    editingId = null
    editContent = ''
  }

  // Delete a note
  async function handleDelete(noteId: number) {
    try {
      await deleteNote(noteId)
      sessionNotes = sessionNotes.filter(n => n.id !== noteId)
      projectNotes = projectNotes.filter(n => n.id !== noteId)
    } catch (err) {
      console.warn('Failed to delete note:', err)
    }
  }

  function handleCancel() {
    composing = false
    newContent = ''
  }

  // Handle #N ref click — in project view, may navigate to a different session first
  function handleRefClick(refNum: number, note: Note | ProjectNote) {
    if (refNum < 1) return

    const noteBelongsToCurrentSession = note.session_id === sessionId

    if (noteBelongsToCurrentSession) {
      // Same session: scroll to event directly (existing behavior)
      if (refNum <= totalEvents) onScrollToEvent?.(refNum)
    } else {
      // Different session: navigate there with scroll target in URL hash
      goto(`/sessions/${note.session_id}?notes=${viewMode}#event-${refNum}`)
    }
  }

  // Check if a note is a ProjectNote (has session_title)
  function isProjectNote(note: Note | ProjectNote): note is ProjectNote {
    return 'session_title' in note
  }

  // Parse note content into segments: plain text + #N references
  function parseContent(content: string): { type: 'text' | 'ref'; value: string; refNum?: number }[] {
    const segments: { type: 'text' | 'ref'; value: string; refNum?: number }[] = []
    const regex = /#(\d+)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
      }
      const refNum = parseInt(match[1])
      segments.push({ type: 'ref', value: match[0], refNum })
      lastIndex = regex.lastIndex
    }

    if (lastIndex < content.length) {
      segments.push({ type: 'text', value: content.slice(lastIndex) })
    }

    return segments
  }
</script>

<!-- Drawer wrapper: handle + panel slide together -->
<div
  class="fixed top-0 right-0 h-full z-40 flex transition-transform duration-300 ease-in-out pointer-events-none"
  style="width: calc(350px + 24px); transform: translateX({open ? '0px' : '350px'});"
>
  <!-- Pull-tab handle -->
  <button
    onclick={toggle}
    class="self-center shrink-0 flex items-center justify-center w-6 h-16 bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-subtle)] rounded-l-md hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer pointer-events-auto"
    title={open ? 'Close notes' : 'Open notes'}
  >
    {#if open}
      <ChevronRight class="w-4 h-4 text-[var(--fg-muted)]" />
    {:else}
      <ChevronLeft class="w-4 h-4 text-[var(--fg-muted)]" />
    {/if}
  </button>

  <!-- Panel body -->
  <div class="h-full w-[350px] bg-[var(--bg-primary)] border-l border-[var(--border-subtle)] shadow-[-4px_0_16px_rgba(0,0,0,0.2)] flex flex-col pointer-events-auto">
    <!-- Header: icon + title + new note button -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
      <div class="flex items-center gap-2">
        <StickyNote class="w-4 h-4 text-[var(--accent-amber)]" />
        <span class="text-sm font-semibold text-[var(--fg-primary)]">Notes</span>
        {#if notes.length > 0}
          <span class="text-xs mono text-[var(--fg-muted)]">({notes.length})</span>
        {/if}
      </div>
      <button
        onclick={() => { composing = true }}
        class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--accent-blue)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
        disabled={composing}
      >
        <Plus class="w-3.5 h-3.5" />
        New Note
      </button>
    </div>

    <!-- Session | Project toggle -->
    {#if directory}
      <div class="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
        <button
          onclick={() => switchMode('session')}
          class="flex-1 px-2 py-1 text-xs font-medium rounded transition-colors {viewMode === 'session' ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)]'}"
        >
          Session
        </button>
        <button
          onclick={() => switchMode('project')}
          class="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors {viewMode === 'project' ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)]'}"
        >
          <FolderOpen class="w-3 h-3" />
          Project
        </button>
      </div>
    {/if}

    <!-- Scrollable notes list -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <!-- New note compose form (inline at top) -->
      {#if composing}
        <div class="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--accent-blue)]/40">
          <textarea
            bind:value={newContent}
            placeholder="Write a note... Use #N to reference messages"
            class="w-full h-24 bg-transparent text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] resize-none outline-none"
            autofocus
            onkeydown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
          ></textarea>
          <div class="flex items-center justify-between mt-2">
            <span class="text-[10px] text-[var(--fg-muted)]">Ctrl+Enter to save</span>
            <div class="flex items-center gap-2">
              <button
                onclick={handleCancel}
                class="px-2 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onclick={handleSave}
                disabled={!newContent.trim() || saving}
                class="px-3 py-1 text-xs font-medium bg-[var(--accent-blue)] text-white rounded hover:bg-[var(--accent-blue)]/80 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Loading state -->
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <span class="text-sm text-[var(--fg-muted)]">Loading notes...</span>
        </div>
      {:else if notes.length === 0 && !composing}
        <!-- Empty state -->
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <StickyNote class="w-8 h-8 text-[var(--fg-muted)] mb-2 opacity-40" />
          <span class="text-sm text-[var(--fg-muted)]">
            {viewMode === 'session' ? 'No notes for this session' : 'No notes for this project'}
          </span>
          <span class="text-xs text-[var(--fg-muted)] mt-1">Click "New Note" to get started</span>
        </div>
      {:else}
        <!-- Note cards -->
        {#each notes as note (note.id)}
          <div class="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-subtle)] group">
            {#if editingId === note.id}
              <!-- Edit mode -->
              <textarea
                bind:value={editContent}
                class="w-full h-24 bg-transparent text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] resize-none outline-none"
                autofocus
                onkeydown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEditSave()
                  if (e.key === 'Escape') cancelEdit()
                }}
              ></textarea>
              <div class="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  onclick={cancelEdit}
                  class="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] transition-colors"
                  title="Cancel"
                >
                  <X class="w-4 h-4" />
                </button>
                <button
                  onclick={handleEditSave}
                  disabled={!editContent.trim() || editSaving}
                  class="p-1 text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 transition-colors disabled:opacity-50"
                  title="Save"
                >
                  <Check class="w-4 h-4" />
                </button>
              </div>
            {:else}
              <!-- Display mode: rendered content with #N pills -->
              <div class="text-sm text-[var(--fg-secondary)] break-words whitespace-pre-wrap leading-relaxed">
                {#each parseContent(note.content) as segment}
                  {#if segment.type === 'ref'}
                    <!-- #N ref pill — clickable: same session scrolls, diff session navigates -->
                    {@const isSameSession = note.session_id === sessionId}
                    {@const inRange = isSameSession && segment.refNum! >= 1 && segment.refNum! <= totalEvents}
                    <button
                      onclick={() => handleRefClick(segment.refNum!, note)}
                      class="inline-flex items-center px-1.5 py-0.5 text-xs font-medium mono rounded-md transition-colors cursor-pointer {inRange ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/25' : isSameSession ? 'bg-[var(--bg-tertiary)] text-[var(--fg-muted)]' : 'bg-[var(--accent-amber)]/15 text-[var(--accent-amber)] hover:bg-[var(--accent-amber)]/25'}"
                      title={isSameSession ? `Scroll to event ${segment.refNum}` : `Open session & go to event ${segment.refNum}`}
                    >
                      {segment.value}
                    </button>
                  {:else}
                    {segment.value}
                  {/if}
                {/each}
              </div>

              <!-- Footer: session label (project view only) + timestamp + actions -->
              <div class="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <div class="flex flex-col gap-0.5 min-w-0">
                  {#if viewMode === 'project' && isProjectNote(note)}
                    <!-- Session origin label — clickable to navigate -->
                    <button
                      onclick={() => goto(`/sessions/${note.session_id}?notes=${viewMode}`)}
                      class="inline-flex items-center gap-1 text-[10px] text-[var(--accent-amber)] hover:text-[var(--accent-amber)]/80 mono truncate text-left transition-colors"
                      title="Open session: {note.session_title}"
                    >
                      <MessageSquare class="w-2.5 h-2.5 shrink-0" />
                      {note.session_title}
                    </button>
                  {/if}
                  <span class="text-[10px] text-[var(--fg-muted)] mono">
                    {formatRelativeTime(note.created_at)}
                  </span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onclick={() => startEdit(note)}
                    class="p-1 text-[var(--fg-muted)] hover:text-[var(--accent-blue)] transition-colors"
                    title="Edit note"
                  >
                    <Pencil class="w-3.5 h-3.5" />
                  </button>
                  <button
                    onclick={() => handleDelete(note.id)}
                    class="p-1 text-[var(--fg-muted)] hover:text-[var(--accent-red)] transition-colors"
                    title="Delete note"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>
