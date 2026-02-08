import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { SessionsPage } from './pages/sessions-page'
import { AnalyticsPage } from './pages/analytics-page'
import { SettingsPage } from './pages/settings-page'
import { SessionDetailPage } from './pages/session-detail-page'
import { LoginPage } from './pages/login-page'
import { useWebSocket } from './hooks/useWebSocket'
import { useStore } from './store'
import { AppLayout } from './components/layout/app-layout'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('dashboard_password'))

  // Only subscribe to values needed for rendering - actions accessed via getState()
  const sessions = useStore(s => s.sessions)
  const wsConnected = useStore(s => s.wsConnected)
  const setWsConnected = useStore(s => s.setWsConnected)
  const filters = useStore(s => s.filters)
  const setFilters = useStore(s => s.setFilters)

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



  const handleLogin = (_password: string) => {
    setIsAuthenticated(true)
  }

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

  // Global WebSocket handler - stable callback using getState() to avoid dependency churn
  const handleWSMessage = useCallback((msg: { type: string; data?: Record<string, unknown> }) => {
    // Get store actions directly from getState() for stable callback
    const { addSession, updateSession, addTimelineEvent } = useStore.getState()
    const data = msg.data || {}
    
    switch (msg.type) {
      case 'session.created':
        if (data.id) addSession(data as unknown as Parameters<typeof addSession>[0])
        break
      case 'session.updated':
        if (data.id) updateSession(data as unknown as Parameters<typeof updateSession>[0])
        break
      case 'attention': {
        const sessionId = data.sessionId as string | undefined
        const needsAttention = data.needsAttention as boolean | undefined
        const isSubagent = data.isSubagent as boolean | undefined
        const audioUrl = data.audioUrl as string | undefined
        
        if (sessionId) {
          updateSession({ id: sessionId, needs_attention: needsAttention ? 1 : 0 })
          if (needsAttention) {
            playBing()
            const session = sessionsRef.current.find(s => s.id === sessionId)
            const prefix = isSubagent ? '[Subagent] ' : ''
            showNotification(`${prefix}${session?.title || 'Session'} needs attention`, 'A session requires your input')
          }
          if (needsAttention && audioUrl && localStorage.getItem('dashboard_tts_enabled') === 'true') {
            queueAudio(audioUrl)
          }
        }
        break
      }
      case 'idle': {
        const sessionId = data.sessionId as string | undefined
        const isSubagent = data.isSubagent as boolean | undefined
        const audioUrl = data.audioUrl as string | undefined
        
        if (sessionId) {
          updateSession({ id: sessionId, status: 'idle' })
          playBing()
          const session = sessionsRef.current.find(s => s.id === sessionId)
          const prefix = isSubagent ? '[Subagent] ' : ''
          showNotification(`${prefix}${session?.title || 'Session'} is idle`, 'The session is waiting for input')
          if (audioUrl && localStorage.getItem('dashboard_tts_enabled') === 'true') {
            queueAudio(audioUrl)
          }
        }
        break
      }
      case 'error': {
        const sessionId = data.sessionId as string | undefined
        if (sessionId) updateSession({ id: sessionId, status: 'error' })
        break
      }
      case 'timeline': {
        const sessionId = data.sessionId as string | undefined
        if (sessionId) {
          addTimelineEvent(sessionId, {
            id: Date.now(),
            session_id: sessionId,
            timestamp: Date.now(),
            event_type: (data.eventType as string) || '',
            summary: (data.summary as string) || '',
            tool_name: data.tool as string | undefined
          })
        }
        break
      }
    }
  }, [queueAudio, playBing, showNotification])

  const password = localStorage.getItem('dashboard_password') || ''
  useWebSocket(password, handleWSMessage, setWsConnected)

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <AppLayout
      sessions={sessions}
      wsConnected={wsConnected}
      selectedDirectory={filters.directory}
      onSelectDirectory={(dir) => setFilters({ directory: dir })}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Routes>
          <Route path="/" element={<SessionsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/session/:sessionId" element={<SessionDetailPage />} />
        </Routes>
      </div>
    </AppLayout>
  )
}
