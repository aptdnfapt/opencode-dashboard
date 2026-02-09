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

<div class="login-bg min-h-screen flex items-center justify-center relative overflow-hidden">
  <!-- Subtle grid pattern overlay -->
  <div class="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none"></div>

  <!-- Glass card -->
  <div class="w-full max-w-sm backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl shadow-2xl p-8 relative z-10">
    <!-- Logo -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-green)] bg-clip-text text-transparent">
        OpenCode
      </h1>
      <p class="text-base mono text-[var(--fg-muted)] mt-1">dashboard</p>
    </div>
    
    <!-- Login form -->
    <form onsubmit={handleSubmit} class="space-y-5">
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
          class="w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] 
                 text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)]
                 focus:outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/50 transition-all
                 disabled:opacity-50"
        />
      </div>
      
      {#if error}
        <div class="text-sm text-[var(--accent-red)]">{error}</div>
      {/if}
      
      <button
        type="submit"
        disabled={loading || !password}
        class="w-full py-3 rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-blue-600 text-white font-medium
               hover:shadow-[0_0_20px_rgba(88,166,255,0.3)] transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
      >
        {loading ? 'Authenticating...' : 'Sign In'}
      </button>
    </form>
  </div>
</div>

<style>
  .login-bg {
    background: #0d1117;
    animation: gradient-shift 8s ease infinite;
    background-size: 200% 200%;
    background-image: linear-gradient(
      135deg,
      #0d1117 0%,
      #111827 25%,
      #0d1117 50%,
      #111827 75%,
      #0d1117 100%
    );
  }

  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .bg-grid-pattern {
    background-image: 
      linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 40px 40px;
  }
</style>
