<script lang="ts">
  import { goto } from '$app/navigation'
  import { store } from '$lib/store.svelte'
  import { wsService } from '$lib/websocket.svelte'
  import { themeStore, type Theme } from '$lib/theme.svelte'
  import { playBing } from '$lib/audio'
  import { showNotification, requestNotificationPermission } from '$lib/notifications'
  
  let soundEnabled = $state(true)
  let ttsEnabled = $state(false)
  let notificationsEnabled = $state(false)
  
  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' }
  ]
  
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
      // Sound defaults to enabled if not set
      const soundSetting = localStorage.getItem('dashboard_sound_enabled')
      soundEnabled = soundSetting === null || soundSetting === 'true'
      ttsEnabled = localStorage.getItem('dashboard_tts_enabled') === 'true'
      notificationsEnabled = localStorage.getItem('dashboard_notifications_enabled') === 'true'
    }
  })
  
  function toggleSound() {
    soundEnabled = !soundEnabled
    localStorage.setItem('dashboard_sound_enabled', String(soundEnabled))
  }
  
  function toggleTTS() {
    ttsEnabled = !ttsEnabled
    localStorage.setItem('dashboard_tts_enabled', String(ttsEnabled))
  }
  
  function toggleNotifications() {
    notificationsEnabled = !notificationsEnabled
    localStorage.setItem('dashboard_notifications_enabled', String(notificationsEnabled))
    
    if (notificationsEnabled && 'Notification' in window) {
      requestNotificationPermission()
    }
  }
  
  function reconnectWS() {
    wsService.disconnect()
    wsService.connect()
  }
  
  function testSound() {
    // Temporarily enable sound for test
    const wasEnabled = localStorage.getItem('dashboard_sound_enabled')
    localStorage.setItem('dashboard_sound_enabled', 'true')
    playBing()
    setTimeout(() => {
      if (wasEnabled !== null) {
        localStorage.setItem('dashboard_sound_enabled', wasEnabled)
      }
    }, 100)
  }
  
  function testNotification() {
    const wasEnabled = localStorage.getItem('dashboard_notifications_enabled')
    localStorage.setItem('dashboard_notifications_enabled', 'true')
    
    if ('Notification' in window && Notification.permission === 'granted') {
      showNotification('Test Notification', 'This is a test notification from OpenCode Dashboard')
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      requestNotificationPermission().then((permission) => {
        if (permission === 'granted') {
          showNotification('Test Notification', 'This is a test notification from OpenCode Dashboard')
        }
      })
    }
    
    if (wasEnabled !== null) {
      localStorage.setItem('dashboard_notifications_enabled', wasEnabled)
    }
  }
  
  async function testTTS() {
    try {
      const apiKey = import.meta.env.VITE_API_KEY || ''
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`
      const response = await fetch(`${apiUrl}/api/tts/test`, {
        headers: { 'X-API-Key': apiKey }
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.play()
        audio.onended = () => URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.warn('[TTS Test] Failed:', err)
    }
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

  <!-- Appearance -->
  <section class="mb-8">
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4">Appearance</h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Theme</div>
          <div class="text-xs text-[var(--fg-secondary)]">
            Current: {themeStore.resolvedTheme}
          </div>
        </div>
        <div class="flex gap-1">
          {#each themeOptions as opt}
            <button
              onclick={() => themeStore.setTheme(opt.value)}
              class="px-3 py-1.5 text-sm rounded border transition-colors {themeStore.theme === opt.value 
                ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)] text-white' 
                : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- Notifications -->
  <section class="mb-8">
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4">Notifications</h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
      <!-- Sound notifications -->
      <div class="flex items-center justify-between p-4">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Sound Notifications</div>
          <div class="text-xs text-[var(--fg-secondary)]">Play bing sound on attention/idle events</div>
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick={testSound}
            class="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Test
          </button>
          <button
            onclick={toggleSound}
            class="w-12 h-6 rounded-full transition-colors {soundEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
          >
            <span 
              class="block w-5 h-5 rounded-full bg-white shadow transition-transform {soundEnabled ? 'translate-x-6' : 'translate-x-0.5'}"
            ></span>
          </button>
        </div>
      </div>
      <!-- Browser notifications -->
      <div class="flex items-center justify-between p-4">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Browser Notifications</div>
          <div class="text-xs text-[var(--fg-secondary)]">Get notified when sessions need attention</div>
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick={testNotification}
            class="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Test
          </button>
          <button
            onclick={toggleNotifications}
            class="w-12 h-6 rounded-full transition-colors {notificationsEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
          >
            <span 
              class="block w-5 h-5 rounded-full bg-white shadow transition-transform {notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}"
            ></span>
          </button>
        </div>
      </div>
      <!-- TTS -->
      <div class="flex items-center justify-between p-4">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Text-to-Speech</div>
          <div class="text-xs text-[var(--fg-secondary)]">Audio announcements for idle/attention events</div>
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick={testTTS}
            class="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Test
          </button>
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
