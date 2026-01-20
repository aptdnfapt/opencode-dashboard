// frontend/src/pages/settings-page.tsx
import { useState } from 'react'
import { Sun, Moon, Monitor, Volume2, VolumeX } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

const TTS_KEY = 'dashboard_tts_enabled'

export function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [ttsEnabled, setTtsEnabledState] = useState(() => localStorage.getItem(TTS_KEY) !== 'false')

  // Toggle TTS and persist
  const handleTTSToggle = () => {
    const newValue = !ttsEnabled
    setTtsEnabledState(newValue)
    localStorage.setItem(TTS_KEY, String(newValue))
  }

  // Test TTS by calling backend
  const testTTS = async () => {
    try {
      const text = 'Test session is idle'
      const password = localStorage.getItem('dashboard_password') || 'default-key'
      const res = await fetch(`/api/tts/test?text=${encodeURIComponent(text)}`, {
        headers: { 'X-API-Key': password }
      })

      if (!res.ok) {
        throw new Error('Failed to get signed URL')
      }

      const { signedUrl } = await res.json()

      const audio = new Audio(signedUrl)
      await audio.play()
    } catch (e) {
      console.warn('TTS test failed:', e)
    }
  }

  const themes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ] as const

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="h-full px-6 flex items-center">
          <h1 className="text-sm font-medium">Settings</h1>
        </div>
      </header>

      <div className="p-6 max-w-2xl">
        {/* Theme section */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-medium mb-1">Appearance</h2>
          <p className="text-xs text-muted-foreground mb-4">Choose your preferred theme</p>
          
          <div className="flex gap-2">
            {themes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  theme === id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Current: <span className="capitalize">{resolvedTheme}</span>
          </p>
        </div>

        {/* TTS section */}
        <div className="rounded-lg border border-border bg-card p-6 mt-4">
          <h2 className="text-sm font-medium mb-1">Voice Announcements</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Speak session title when it goes idle (uses Kokoro TTS model)
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={handleTTSToggle}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                ttsEnabled
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {ttsEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {ttsEnabled ? 'Enabled' : 'Disabled'}
            </button>

            <button
              onClick={testTTS}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              Test TTS
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            When a session becomes idle, you'll hear: "[session title] is idle"
          </p>
        </div>
      </div>
    </div>
  )
}
