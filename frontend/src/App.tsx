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

  const { sessions, addSession, updateSession, setWsConnected, addTimelineEvent, wsConnected, filters, setFilters } = useStore()

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

  // Clear audio queue - exposed for potential future use
  const _clearAudioQueue = useCallback(() => {
    audioQueueRef.current = []
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    isPlayingRef.current = false
  }, [])

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
