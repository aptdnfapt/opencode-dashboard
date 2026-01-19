import { useState } from 'react'
import { Activity, TrendingUp, Sun, Globe } from 'lucide-react'
import { SessionsPage } from './pages/sessions-page'
import { AnalyticsPage } from './pages/analytics-page'
import { SettingsPage } from './pages/settings-page'
import { SessionDetail } from './components/sessions/session-detail'

type Page = 'sessions' | 'analytics' | 'settings'

const navItems = [
  { id: 'sessions' as Page, label: 'Sessions', icon: Activity },
  { id: 'analytics' as Page, label: 'Analytics', icon: TrendingUp },
  { id: 'settings' as Page, label: 'Settings', icon: Sun },
]

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('sessions')

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-lg bg-primary flex items-center justify-center">
                <Globe className="size-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground sm:block hidden">OpenCode</span>
            </div>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main>
        {currentPage === 'sessions' && <SessionsPage />}
        {currentPage === 'analytics' && <AnalyticsPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </main>

      {/* SessionDetail modal overlay */}
      <SessionDetail />
    </div>
  )
}
