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
      <div class="absolute top-2 left-2 z-10">
        <button
          type="button"
          onclick={onClose}
          class="px-2.5 py-1 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
        >
          Close
        </button>
      </div>
      <iframe
        title="Session Viewer"
        src={`/sessions/${sessionId}?embed=1`}
        class="h-full w-full border-0"
      ></iframe>
    </div>
  </div>
{/if}
