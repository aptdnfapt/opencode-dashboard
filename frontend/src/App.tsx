import { useState, useEffect } from 'react'
import { Activity, Wifi, WifiOff, Power } from 'lucide-react'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => setLoading(false), 500)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="size-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">Sessions</h1>
                  <p className="text-xs text-muted-foreground">0 sessions</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full border">
                {wsConnected ? (
                  <>
                    <Wifi className="size-4 text-green-500" />
                    <span className="text-green-500 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="size-4 text-red-500" />
                    <span className="text-red-500 font-medium">Offline</span>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                <Activity className="size-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No sessions found</h2>
              <p className="text-muted-foreground">Dashboard is running - connect OpenCode plugin to see sessions</p>
              <p className="text-sm text-muted-foreground mt-4">WebSocket: ws://localhost:3001</p>
            </div>
          </main>
        </>
      )}
    </div>
  )
}
