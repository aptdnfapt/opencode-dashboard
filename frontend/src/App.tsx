import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Activity, BarChart3, Settings, Terminal, ChevronRight, Menu, X } from 'lucide-react'
import { SessionsPage } from './pages/sessions-page'
import { AnalyticsPage } from './pages/analytics-page'
import { SettingsPage } from './pages/settings-page'
import { SessionDetailPage } from './pages/session-detail-page'
import { LoginPage } from './pages/login-page'
import { useWebSocket } from './hooks/useWebSocket'
import { useStore } from './store'

type NavItem = {
  id: string
  label: string
  icon: typeof Activity
  path: string
}

const navItems: NavItem[] = [
  { id: 'sessions', label: 'Sessions', icon: Activity, path: '/' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('dashboard_password'))

  const { sessions, addSession, updateSession, setWsConnected, addTimelineEvent } = useStore()

  // Audio queue refs
  const audioQueueRef = useRef<string[]>([])
  const isPlayingRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // Ref to always have fresh sessions for TTS lookup
  const sessionsRef = useRef(sessions)
  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  // Audio queue management - plays audio one at a time
  const playQueuedAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return
    }

    isPlayingRef.current = true
    const url = audioQueueRef.current.shift()

    if (!url) {
      isPlayingRef.current = false
      return
    }

    try {
      const audio = new Audio(url)
      currentAudioRef.current = audio
      await audio.play()
      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve()
        audio.onerror = () => resolve() // Continue even on error
      })
    } catch (e) {
      console.warn('Audio playback failed:', e)
    } finally {
      currentAudioRef.current = null
      setTimeout(() => {
        isPlayingRef.current = false
        // Play next in queue
        playQueuedAudio()
      }, 200) // Small delay between audio
    }
  }, [])

  const queueAudio = useCallback((url: string) => {
    // Dedupe: don't add if already in queue
    if (audioQueueRef.current.some(u => u === url)) {
      console.log('[Audio Queue] Skipping duplicate:', url)
      return
    }
    audioQueueRef.current.push(url)
    if (!isPlayingRef.current) {
      playQueuedAudio()
    }
  }, [playQueuedAudio])

  const clearAudioQueue = useCallback(() => {
    audioQueueRef.current = []
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    isPlayingRef.current = false
  }, [])

  const handleLogin = (password: string) => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('dashboard_password')
    setIsAuthenticated(false)
  }

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev)
  }, [])

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMobileMenu()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeMobileMenu])

  // Play bing sound using Web Audio API
  const playBing = useCallback(() => {
    if (localStorage.getItem('dashboard_sound_enabled') === 'false') return
    
    try {
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      
      // Pleasant bing tone
      oscillator.frequency.value = 880 // A5 note
      oscillator.type = 'sine'
      
      // Fade out
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.5)
    } catch (e) {
      console.warn('Bing sound failed:', e)
    }
  }, [])

  // Show browser notification (works on HTTPS only)
  const showNotification = useCallback((title: string, body: string) => {
    if (localStorage.getItem('dashboard_notifications_enabled') === 'false') return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    
    new Notification(title, { body, icon: '/favicon.ico' })
  }, [])

  // Global WebSocket handler - handles idle TTS from any page
  const handleWSMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'session.created':
        addSession(msg.data)
        break
      case 'session.updated':
        updateSession(msg.data)
        break
      case 'attention': {
        updateSession({ id: msg.data.sessionId, needs_attention: msg.data.needsAttention ? 1 : 0 })
        if (msg.data.needsAttention) {
          // Bing sound (default on)
          playBing()
          // Browser notification (default on, requires HTTPS)
          const session = sessionsRef.current.find(s => s.id === msg.data.sessionId)
          showNotification(`${session?.title || 'Session'} needs attention`, 'A session requires your input')
        }
        // Queue TTS for attention events (opt-in, must be explicitly 'true')
        if (msg.data.needsAttention && msg.data.audioUrl && localStorage.getItem('dashboard_tts_enabled') === 'true') {
          queueAudio(msg.data.audioUrl)
        }
        break
      }
      case 'idle': {
        updateSession({ id: msg.data.sessionId, status: 'idle' })
        // Bing sound (default on)
        playBing()
        // Browser notification (default on, requires HTTPS)
        const session = sessionsRef.current.find(s => s.id === msg.data.sessionId)
        showNotification(`${session?.title || 'Session'} is idle`, 'The session is waiting for input')
        // Queue TTS audio if provided by server (opt-in, must be explicitly 'true')
        if (msg.data.audioUrl && localStorage.getItem('dashboard_tts_enabled') === 'true') {
          queueAudio(msg.data.audioUrl)
        }
        break
      }
      case 'error':
        updateSession({ id: msg.data.sessionId, status: 'error' })
        break
      case 'timeline':
        // Add timeline event to store for the specific session
        addTimelineEvent(msg.data.sessionId as string, {
          id: Date.now(),
          session_id: msg.data.sessionId as string,
          timestamp: Date.now(),
          event_type: msg.data.eventType as string,
          summary: msg.data.summary as string,
          tool_name: msg.data.tool as string | undefined
        })
        break
    }
  }, [addSession, updateSession, addTimelineEvent, queueAudio, playBing, showNotification])

  const password = localStorage.getItem('dashboard_password') || ''
  useWebSocket(password, handleWSMessage, setWsConnected)

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  // Determine active nav item
  const activeNav = navItems.find(item => 
    item.path === '/' 
      ? location.pathname === '/' 
      : location.pathname.startsWith(item.path)
  )?.id || 'sessions'

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Mobile backdrop overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-full border-r border-border bg-card flex flex-col z-50
        transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${collapsed ? 'w-16' : 'w-56'}
        lg:relative lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Terminal className="size-4 text-primary" />
            </div>
            {!collapsed && <span className="font-semibold text-sm">OpenCode</span>}
          </div>
          {/* Mobile close button */}
          <button
            onClick={closeMobileMenu}
            className="lg:hidden ml-auto p-1 rounded hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = activeNav === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  navigate(item.path)
                  closeMobileMenu()
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Collapse toggle - hidden on mobile */}
        <div className="hidden lg:block p-2 border-t border-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className={`size-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* Logout button - hidden on mobile */}
        {!collapsed && (
          <div className="hidden lg:block p-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Settings className="size-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        )}

        {/* Mobile logout button */}
        <div className="lg:hidden p-2 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Settings className="size-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header with hamburger menu */}
        <header className="lg:hidden h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-4">
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-3 ml-2">
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Terminal className="size-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">OpenCode</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={<SessionsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/session/:sessionId" element={<SessionDetailPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
