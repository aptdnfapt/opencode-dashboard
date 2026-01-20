// frontend/src/pages/settings-page.tsx
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

export function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()

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
      </div>
    </div>
  )
}
