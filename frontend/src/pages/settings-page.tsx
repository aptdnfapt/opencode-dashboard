// frontend/src/pages/settings-page.tsx
// Settings page
import { useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SettingsPage() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Sun className="size-6 text-primary" />
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Theme */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Theme</h2>
          <p className="text-sm text-muted-foreground mb-4">Choose your preferred theme</p>
          <div className="flex gap-3">
            <Button 
              variant={theme === 'light' ? 'default' : 'outline'} 
              onClick={() => setTheme('light')}
            >
              <Sun className="size-4 mr-2" />
              Light
            </Button>
            <Button 
              variant={theme === 'dark' ? 'default' : 'outline'} 
              onClick={() => setTheme('dark')}
            >
              <Moon className="size-4 mr-2" />
              Dark
            </Button>
            <Button 
              variant={theme === 'system' ? 'default' : 'outline'} 
              onClick={() => setTheme('system')}
            >
              <Monitor className="size-4 mr-2" />
              System
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Current theme: <span className="font-medium">{theme}</span>
        </div>
      </main>
    </div>
  )
}
