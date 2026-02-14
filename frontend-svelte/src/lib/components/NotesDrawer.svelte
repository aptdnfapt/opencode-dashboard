<script lang="ts">
  // Pull-tab drawer for per-session notes with #N message references
  import type { Note } from '$lib/types'
  import { getSessionNotes, createNote, updateNote, deleteNote } from '$lib/api'
  import { formatRelativeTime } from '$lib/utils'
  import { StickyNote, Plus, Trash2, ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-svelte'

  // Props: session ID + total event count (for validating #N refs)
  interface Props {
    sessionId: string
    totalEvents: number
    onScrollToEvent?: (index: number) => void
  }
  let { sessionId, totalEvents, onScrollToEvent }: Props = $props()

  // Drawer state
  let open = $state(false)
  let notes = $state<Note[]>([])
  let loading = $state(false)

  // New note form
  let composing = $state(false)
  let newContent = $state('')
  let saving = $state(false)

  // Edit state: which note ID is being edited
  let editingId = $state<number | null>(null)
  let editContent = $state('')
  let editSaving = $state(false)

  // Load notes when drawer opens
  async function loadNotes() {
    loading = true
    try {
      notes = await getSessionNotes(sessionId)
    } catch (err) {
      console.warn('Failed to load notes:', err)
    } finally {
      loading = false
    }
  }

  // Toggle drawer open/close
  function toggle() {
    open = !open
    if (open && notes.length === 0) {
      loadNotes()
    }
  }

  // Create a new note
  async function handleSave() {
    if (!newContent.trim() || saving) return
    saving = true
    try {
      const note = await createNote(sessionId, newContent.trim())
      notes = [note, ...notes]
      newContent = ''
      composing = false
    } catch (err) {
      console.warn('Failed to create note:', err)
    } finally {
      saving = false
    }
  }

  // Start editing a note
  function startEdit(note: Note) {
    editingId = note.id
    editContent = note.content
  }

  // Save edited note
  async function handleEditSave() {
    if (!editContent.trim() || editSaving || editingId === null) return
    editSaving = true
    try {
      const updated = await updateNote(editingId, editContent.trim())
      notes = notes.map(n => n.id === editingId ? updated : n)
      editingId = null
      editContent = ''
    } catch (err) {
      console.warn('Failed to update note:', err)
    } finally {
      editSaving = false
    }
  }

  // Cancel editing
  function cancelEdit() {
    editingId = null
    editContent = ''
  }

  // Delete a note
  async function handleDelete(noteId: number) {
    try {
      await deleteNote(noteId)
      notes = notes.filter(n => n.id !== noteId)
    } catch (err) {
      console.warn('Failed to delete note:', err)
    }
  }

  // Cancel composing
  function handleCancel() {
    composing = false
    newContent = ''
  }

  // Handle #N pill click → scroll to that event in the timeline
  function handleRefClick(refNum: number) {
    if (refNum < 1 || refNum > totalEvents) return
    onScrollToEvent?.(refNum)
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

<!-- Drawer wrapper: handle + panel are one unit, slide together -->
<!-- Closed state: translateX(350px) hides panel off-screen, handle stays visible at right edge -->
<div
  class="fixed top-0 right-0 h-full z-40 flex transition-transform duration-300 ease-in-out pointer-events-none"
  style="width: calc(350px + 24px); transform: translateX({open ? '0px' : '350px'});"
>
  <!-- Pull-tab handle: left edge of wrapper, vertically centered, always interactive -->
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
    <!-- Header -->
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

    <!-- Scrollable notes list -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <!-- New note form (inline at top) -->
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
          <span class="text-sm text-[var(--fg-muted)]">No notes yet</span>
          <span class="text-xs text-[var(--fg-muted)] mt-1">Click "New Note" to get started</span>
        </div>
      {:else}
        <!-- Notes list -->
        {#each notes as note (note.id)}
          <div class="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-subtle)] group">
            {#if editingId === note.id}
              <!-- Edit mode: inline textarea -->
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
                    {#if segment.refNum && segment.refNum >= 1 && segment.refNum <= totalEvents}
                      <button
                        onclick={() => handleRefClick(segment.refNum!)}
                        class="inline-flex items-center px-1.5 py-0.5 text-xs font-medium mono bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] rounded-md hover:bg-[var(--accent-blue)]/25 transition-colors cursor-pointer"
                      >
                        {segment.value}
                      </button>
                    {:else}
                      <span class="inline-flex items-center px-1.5 py-0.5 text-xs font-medium mono bg-[var(--bg-tertiary)] text-[var(--fg-muted)] rounded-md">
                        {segment.value}
                      </span>
                    {/if}
                  {:else}
                    {segment.value}
                  {/if}
                {/each}
              </div>

              <!-- Footer: timestamp + edit + delete -->
              <div class="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <span class="text-[10px] text-[var(--fg-muted)] mono">
                  {formatRelativeTime(note.created_at)}
                </span>
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
