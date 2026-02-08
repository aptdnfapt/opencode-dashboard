<script lang="ts">
  import { goto } from '$app/navigation'
  
  let password = $state('')
  let error = $state('')
  let loading = $state(false)
  
  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate password against backend (use relative URL for Vite proxy)
      const res = await fetch('/api/sessions', {
        headers: { 'X-API-Key': password }
      })
      
      if (res.ok) {
        // Store auth state and password for WebSocket
        localStorage.setItem('dashboard_authenticated', 'true')
        localStorage.setItem('dashboard_password', password)
        goto('/')
      } else if (res.status === 401) {
        error = 'Invalid password'
      } else {
        error = 'Connection failed'
      }
    } catch (err) {
      error = 'Unable to connect to server'
    } finally {
      loading = false
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
  <div class="w-full max-w-sm p-6">
    <!-- Logo -->
    <div class="text-center mb-8">
      <h1 class="text-2xl font-semibold text-[var(--fg-primary)]">OpenCode</h1>
      <p class="text-sm mono text-[var(--fg-muted)]">dashboard</p>
    </div>
    
    <!-- Login form -->
    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="password" class="block text-sm text-[var(--fg-secondary)] mb-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Enter password"
          disabled={loading}
          class="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] 
                 text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)]
                 focus:outline-none focus:border-[var(--accent-blue)] transition-colors
                 disabled:opacity-50"
        />
      </div>
      
      {#if error}
        <div class="text-sm text-[var(--accent-red)]">{error}</div>
      {/if}
      
      <button
        type="submit"
        disabled={loading || !password}
        class="w-full py-2 rounded-md bg-[var(--accent-blue)] text-white font-medium
               hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Authenticating...' : 'Sign In'}
      </button>
    </form>
  </div>
</div>
