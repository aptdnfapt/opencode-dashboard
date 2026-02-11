<script lang="ts">
  import { goto } from '$app/navigation'
  import { store } from '$lib/store.svelte'
  import { wsService } from '$lib/websocket.svelte'
  import { themeStore, type Theme } from '$lib/theme.svelte'
  import { playPreset, SOUND_PRESETS, type SoundPreset } from '$lib/audio'
  import { showNotification, requestNotificationPermission } from '$lib/notifications'
  
  let agentSoundEnabled = $state(true)
  let agentSoundPreset = $state<SoundPreset>('bing')
  let subagentSoundEnabled = $state(true)
  let subagentSoundPreset = $state<SoundPreset>('ping')
  let ttsEnabled = $state(false)
  let notificationsEnabled = $state(false)
  let sortActiveFirst = $state(true)
  
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
      const agentSetting = localStorage.getItem('dashboard_agent_sound_enabled')
      agentSoundEnabled = agentSetting === null || agentSetting === 'true'
      agentSoundPreset = (localStorage.getItem('dashboard_agent_sound_preset') as SoundPreset) || 'bing'
      const subagentSetting = localStorage.getItem('dashboard_subagent_sound_enabled')
      subagentSoundEnabled = subagentSetting === null || subagentSetting === 'true'
      subagentSoundPreset = (localStorage.getItem('dashboard_subagent_sound_preset') as SoundPreset) || 'ping'
      ttsEnabled = localStorage.getItem('dashboard_tts_enabled') === 'true'
      notificationsEnabled = localStorage.getItem('dashboard_notifications_enabled') === 'true'
      const sortSetting = localStorage.getItem('dashboard_sort_active_first')
      sortActiveFirst = sortSetting === null || sortSetting === 'true'
      store.loadSettings()
    }
  })
  
  function toggleSortActiveFirst() {
    sortActiveFirst = !sortActiveFirst
    store.setSortActiveFirst(sortActiveFirst)
  }
  
  function toggleAgentSound() {
    agentSoundEnabled = !agentSoundEnabled
    localStorage.setItem('dashboard_agent_sound_enabled', String(agentSoundEnabled))
  }
  
  function toggleSubagentSound() {
    subagentSoundEnabled = !subagentSoundEnabled
    localStorage.setItem('dashboard_subagent_sound_enabled', String(subagentSoundEnabled))
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
  
  function setAgentPreset(preset: SoundPreset) {
    agentSoundPreset = preset
    localStorage.setItem('dashboard_agent_sound_preset', preset)
    playPreset(preset, 0.5)
  }
  
  function setSubagentPreset(preset: SoundPreset) {
    subagentSoundPreset = preset
    localStorage.setItem('dashboard_subagent_sound_preset', preset)
    playPreset(preset, 0.5)
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
      const apiKey = localStorage.getItem('dashboard_password') || ''
      const response = await fetch(`/api/tts/test`, {
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
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4 flex items-center gap-2">
      <!-- WiFi/signal icon -->
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>
      Connection
    </h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 transition-colors hover:border-[var(--border)]">
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
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4 flex items-center gap-2">
      <!-- Moon/palette icon -->
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      Appearance
    </h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)] transition-colors hover:border-[var(--border)]">
      <div class="flex items-center justify-between p-4">
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
      <div class="flex items-center justify-between p-4">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Sort Active First</div>
          <div class="text-xs text-[var(--fg-secondary)]">Show running sessions at top of list</div>
        </div>
        <button
          onclick={toggleSortActiveFirst}
          class="w-14 h-7 rounded-full transition-colors {sortActiveFirst ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
        >
          <span 
            class="block w-6 h-6 rounded-full bg-white shadow transition-transform {sortActiveFirst ? 'translate-x-7' : 'translate-x-0.5'}"
          ></span>
        </button>
      </div>
    </div>
  </section>

  <!-- Notifications -->
  <section class="mb-8">
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4 flex items-center gap-2">
      <!-- Bell icon -->
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      Notifications
    </h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)] transition-colors hover:border-[var(--border)]">
      <!-- Agent sound -->
      <div class="p-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-sm text-[var(--fg-primary)]">Agent Sound</div>
            <div class="text-xs text-[var(--fg-secondary)]">Main agent idle or needs attention</div>
          </div>
          <button
            onclick={toggleAgentSound}
            class="w-14 h-7 rounded-full transition-colors {agentSoundEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
          >
            <span 
              class="block w-6 h-6 rounded-full bg-white shadow transition-transform {agentSoundEnabled ? 'translate-x-7' : 'translate-x-0.5'}"
            ></span>
          </button>
        </div>
        {#if agentSoundEnabled}
          <div class="flex flex-wrap gap-1.5">
            {#each SOUND_PRESETS as preset}
              <button
                onclick={() => setAgentPreset(preset.value)}
                class="px-2.5 py-1 text-xs rounded border transition-colors {agentSoundPreset === preset.value
                  ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)] text-white'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]'}"
              >
                {preset.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <!-- Sub-agent sound -->
      <div class="p-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-sm text-[var(--fg-primary)]">Sub-agent Sound</div>
            <div class="text-xs text-[var(--fg-secondary)]">Sub-agent finishes its task</div>
          </div>
          <button
            onclick={toggleSubagentSound}
            class="w-14 h-7 rounded-full transition-colors {subagentSoundEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
          >
            <span 
              class="block w-6 h-6 rounded-full bg-white shadow transition-transform {subagentSoundEnabled ? 'translate-x-7' : 'translate-x-0.5'}"
            ></span>
          </button>
        </div>
        {#if subagentSoundEnabled}
          <div class="flex flex-wrap gap-1.5">
            {#each SOUND_PRESETS as preset}
              <button
                onclick={() => setSubagentPreset(preset.value)}
                class="px-2.5 py-1 text-xs rounded border transition-colors {subagentSoundPreset === preset.value
                  ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)] text-white'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]'}"
              >
                {preset.label}
              </button>
            {/each}
          </div>
        {/if}
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
            class="px-2.5 py-1 text-xs rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Test
          </button>
          <button
            onclick={toggleNotifications}
            class="w-14 h-7 rounded-full transition-colors {notificationsEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
          >
            <span 
              class="block w-6 h-6 rounded-full bg-white shadow transition-transform {notificationsEnabled ? 'translate-x-7' : 'translate-x-0.5'}"
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
            class="px-2.5 py-1 text-xs rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Test
          </button>
          <button
            onclick={toggleTTS}
            class="w-14 h-7 rounded-full transition-colors {ttsEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'}"
          >
            <span 
              class="block w-6 h-6 rounded-full bg-white shadow transition-transform {ttsEnabled ? 'translate-x-7' : 'translate-x-0.5'}"
            ></span>
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- About -->
  <section class="mb-8">
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4 flex items-center gap-2">
      <!-- Info circle icon -->
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      About
    </h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 transition-colors hover:border-[var(--border)]">
      <div class="text-sm text-[var(--fg-primary)]">OpenCode Dashboard</div>
      <div class="text-xs mono text-[var(--fg-secondary)] mt-1">Svelte 5 + SvelteKit</div>
    </div>
  </section>

  <!-- Account -->
  <section>
    <h2 class="text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-4 flex items-center gap-2">
      <!-- User icon -->
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Account
    </h2>
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 transition-colors hover:border-[var(--border)]">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--fg-primary)]">Sign Out</div>
          <div class="text-xs text-[var(--fg-secondary)]">Clear session and return to login</div>
        </div>
        <button
          onclick={logout}
          class="px-3 py-1.5 text-sm rounded bg-[var(--accent-red)] text-white hover:opacity-90 transition-opacity inline-flex items-center gap-2"
        >
          <!-- Door/exit icon -->
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </div>
    </div>
  </section>
</div>
