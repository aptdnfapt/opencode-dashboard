import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { Activity, TrendingUp, Sun, Globe } from 'lucide-react'
import { SessionsPage } from './pages/sessions-page'
import { AnalyticsPage } from './pages/analytics-page'
import { SettingsPage } from './pages/settings-page'
import { SessionDetailPage } from './pages/session-detail-page'
import { useStore } from './store'

type Page = 'sessions' | 'analytics' | 'settings'

const navItems = [
  { id: 'sessions' as Page, label: 'Sessions', icon: Activity, path: '/' },
  { id: 'analytics' as Page, label: 'Analytics', icon: TrendingUp, path: '/analytics' },
  { id: 'settings' as Page, label: 'Settings', icon: Sun, path: '/settings' },
]

export default function App() {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState<Page>('sessions')

  const handleNavClick = (path: string, page: Page) => {
    setCurrentPage(page)
    navigate(path)
  }

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
                  onClick={() => handleNavClick(item.path, item.id)}
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