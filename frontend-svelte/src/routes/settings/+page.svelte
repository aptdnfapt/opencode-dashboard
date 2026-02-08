<script lang="ts">
  import { goto } from '$app/navigation'
  import { store } from '$lib/store.svelte'
  import { wsService } from '$lib/websocket.svelte'
  
  let ttsEnabled = $state(false)
  let notificationsEnabled = $state(false)
  
  function logout() {
    // Clear auth state
    localStorage.removeItem('dashboard_authenticated')
    localStorage.removeItem('dashboard_password')
    // Disconnect WS
    wsService.disconnect()
    // Redirect to login
    goto('/login')
  }
  
  // Load from localStorage on mount
  $effect(() => {
    if (typeof window !== 'undefined') {
      ttsEnabled = localStorage.getItem('dashboard_tts_enabled') === 'true'
      notificationsEnabled = localStorage.getItem('dashboard_notifications_enabled') === 'true'
    }
  })
  
  function toggleTTS() {
    ttsEnabled = !ttsEnabled
    localStorage.setItem('dashboard_tts_enabled', String(ttsEnabled))
  }
  
  function toggleNotifications() {
    notificationsEnabled = !notificationsEnabled
    localStorage.setItem('dashboard_notifications_enabled', String(notificationsEnabled))
    
    if (notificationsEnabled && 'Notification' in window) {
      Notification.requestPermission()
    }
  }
  
  function reconnectWS() {
    wsService.disconnect()
    wsService.connect()
  }
</script>

<div class="p-6 max-w-2xl">
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-[var(--fg-primary)]">Settings</h1>
    <p class="text-sm text-[var(--fg-secondary)]">Configure dashboard preferences</p>
  </div>

  <!-- Connection -->
  <section class="mb-8">
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4">Connection</h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">WebSocket Status</div>
          <div class="text-xs mono text-[var(--fg-secondary)]">{store.connectionStatus}</div>
        </div>
        <button
          onclick={reconnectWS}
          class="px-3 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          Reconnect
        </button>
      </div>
    </div>
  </section>

  <!-- Notifications -->
  <section class="mb-8">
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4">Notifications</h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
      <div class="flex items-center justify-between p-4">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Browser Notifications</div>
          <div class="text-xs text-[var(--fg-secondary)]">Get notified when sessions need attention</div>
        </div>
        <button
          onclick={toggleNotifications}
          class="w-12 h-6 rounded-full transition-colors {notificationsEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
        >
          <span 
            class="block w-5 h-5 rounded-full bg-white shadow transition-transform {notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}"
          ></span>
        </button>
      </div>
      <div class="flex items-center justify-between p-4">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Text-to-Speech</div>
          <div class="text-xs text-[var(--fg-secondary)]">Audio announcements for idle/attention events</div>
        </div>
        <button
          onclick={toggleTTS}
          class="w-12 h-6 rounded-full transition-colors {ttsEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
        >
          <span 
            class="block w-5 h-5 rounded-full bg-white shadow transition-transform {ttsEnabled ? 'translate-x-6' : 'translate-x-0.5'}"
          ></span>
        </button>
      </div>
    </div>
  </section>

  <!-- About -->
  <section class="mb-8">
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4">About</h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
      <div class="text-sm text-[var(--fg-primary)]">OpenCode Dashboard</div>
      <div class="text-xs mono text-[var(--fg-secondary)] mt-1">Svelte 5 + SvelteKit</div>
    </div>
  </section>

  <!-- Account -->
  <section>
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4">Account</h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Sign Out</div>
          <div class="text-xs text-[var(--fg-secondary)]">Clear session and return to login</div>
        </div>
        <button
          onclick={logout}
          class="px-3 py-1.5 text-sm rounded bg-[var(--accent-red)] text-white hover:opacity-90 transition-opacity"
        >
          Logout
        </button>
      </div>
    </div>
  </section>
</div>
