<script lang="ts">
  interface Props {
    sessionId: string | null
    onClose: () => void
  }

  let { sessionId, onClose }: Props = $props()

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  $effect(() => {
    if (!sessionId) return
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })
</script>

{#if sessionId}
  <div
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[1px] p-2 sm:p-4"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="relative h-full w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden">
      <!-- macOS-style close button (traffic light style) -->
      <button
        type="button"
        onclick={onClose}
        class="absolute top-2.5 left-3 z-20 w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-red-500 active:bg-red-700 transition-colors cursor-pointer group"
        title="Close"
        aria-label="Close session viewer"
      >
        <svg class="w-2 h-2 mx-auto text-white opacity-0 group-hover:opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <iframe
        title="Session Viewer"
        src={`/sessions/${sessionId}?embed=1`}
        class="h-full w-full border-0"
      ></iframe>
    </div>
  </div>
{/if}