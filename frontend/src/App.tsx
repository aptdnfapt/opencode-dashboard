import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Activity, BarChart3, Settings, Terminal, ChevronRight } from 'lucide-react'
import { SessionsPage } from './pages/sessions-page'
import { AnalyticsPage } from './pages/analytics-page'
import { SettingsPage } from './pages/settings-page'
import { SessionDetailPage } from './pages/session-detail-page'
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
  
  const { sessions, addSession, updateSession, setWsConnected } = useStore()
  
  // Ref to always have fresh sessions for TTS lookup
  const sessionsRef = useRef(sessions)
  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  // Global WebSocket handler - handles idle TTS from any page
  const handleWSMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'session.created':
        addSession(msg.data)
        break
      case 'session.updated':
        updateSession(msg.data)
        break
      case 'attention':
        console.log('[WS] attention event:', msg.data)
        updateSession({ id: msg.data.sessionId, needs_attention: msg.data.needsAttention ? 1 : 0 })
        // Play TTS for attention events
        if (msg.data.needsAttention && msg.data.audioUrl && localStorage.getItem('dashboard_tts_enabled') !== 'false') {
          const audio = new Audio(msg.data.audioUrl)
          audio.play().catch(e => console.warn('TTS playback failed:', e))
        }
        break
      case 'idle': {
        updateSession({ id: msg.data.sessionId, status: 'idle' })
        // Play TTS audio if provided by server
        if (msg.data.audioUrl && localStorage.getItem('dashboard_tts_enabled') !== 'false') {
          const audio = new Audio(msg.data.audioUrl)
          audio.play().catch(e => console.warn('TTS playback failed:', e))
        }
        break
      }
      case 'error':
        updateSession({ id: msg.data.sessionId, status: 'error' })
        break
    }
  }, [addSession, updateSession])

  const password = localStorage.getItem('dashboard_password') || ''
  useWebSocket(password, handleWSMessage, setWsConnected)

  // Determine active nav item
  const activeNav = navItems.find(item => 
    item.path === '/' 
      ? location.pathname === '/' 
      : location.pathname.startsWith(item.path)
  )?.id || 'sessions'

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full border-r border-border bg-card flex flex-col z-50 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Terminal className="size-4 text-primary" />
            </div>
            {!collapsed && <span className="font-semibold text-sm">OpenCode</span>}
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = activeNav === item.id
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
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

        {/* Collapse toggle */}
        <div className="p-2 border-t border-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className={`size-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <Routes>
          <Route path="/" element={<SessionsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/session/:sessionId" element={<SessionDetailPage />} />
        </Routes>
      </main>
    </div>
  )
}
