import { useState } from 'react'
import { Lock, ArrowRight } from 'lucide-react'

interface LoginPageProps {
  onLogin: (password: string) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError('')

    try {
      // Test the password by calling a simple API endpoint
      const res = await fetch('/api/analytics/summary', {
        headers: {
          'X-API-Key': password
        }
      })

      if (res.ok) {
        localStorage.setItem('dashboard_password', password)
        onLogin(password)
      } else if (res.status === 401) {
        setError('Invalid password')
      } else {
        setError('Failed to connect to server')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 sm:px-6">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="border border-border rounded-lg bg-card p-5 sm:p-6 lg:p-8 shadow-lg sm:shadow-xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <div className="size-12 sm:size-14 lg:size-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 sm:mb-4">
              <Lock className="size-6 sm:size-7 lg:size-8 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-2xl font-bold mb-1">OpenCode Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground text-center px-2">Enter your password to access</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-4">
            <div>
              <input
                type="password"
                placeholder="Dashboard password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 sm:px-4 sm:py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm sm:text-base"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-xs sm:text-sm text-destructive text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              disabled={loading || !password.trim()}
            >
              {loading ? 'Verifying...' : 'Access Dashboard'}
              {!loading && <ArrowRight className="size-3.5 sm:size-4" />}
            </button>
          </form>

          {/* Info */}
          <p className="mt-4 sm:mt-6 text-[10px] sm:text-xs text-muted-foreground text-center leading-relaxed px-2">
            Password is set via FRONTEND_PASSWORD environment variable in backend
          </p>
        </div>
      </div>
    </div>
  )
}
