// backend/src/index.ts
// Main API entry point - exports Hono app for Bun server
import { config } from 'dotenv'
await config({ path: '../.env' }) // Load env vars from root .env

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import db from './db'
import { createWebhookHandler } from './handlers/webhook'
import { createApiHandler } from './handlers/api'
import { wsManager } from './websocket/server'
import { initTTS } from './services/tts'

const app = new Hono()

app.use('*', cors())
app.get('/', (c) => c.text('OpenCode Dashboard API'))
app.get('/health', (c) => c.json({ status: 'ok', clients: wsManager.clientCount }))

// Auth middleware for /api/* routes - require FRONTEND_PASSWORD
// Note: /api/tts is public (needed for audio playback without headers)
app.use('/api/*', async (c, next) => {
  // Skip auth for /api/tts (browser audio cannot send headers)
  if (c.req.path.startsWith('/api/tts')) {
    await next()
    return
  }

  const frontendPassword = process.env.FRONTEND_PASSWORD
  const providedKey = c.req.header('X-API-Key')

  // If FRONTEND_PASSWORD is set, require X-API-Key
  if (frontendPassword && providedKey !== frontendPassword) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
})

app.notFound((c) => c.text('Not Found', 404))

// Register handlers
createWebhookHandler(app, db)
createApiHandler(app, db)

const port = parseInt(process.env.BACKEND_PORT || '3000')

// Export for testing
export default {
  port,
  fetch: app.fetch
}

// Start servers only when run directly (not imported)
if (import.meta.main) {
  // Initialize TTS model in background (don't block startup)
  initTTS().catch(err => console.error('[TTS] Init failed:', err))

  // Start WebSocket server on port+1
  Bun.serve({
    hostname: '0.0.0.0',
    port: port + 1,
    fetch(req, server) {
      if (server.upgrade(req)) return
      return new Response('Upgrade required', { status: 426 })
    },
    websocket: {
      open(ws) { wsManager.register(ws as unknown as WebSocket) },
      close(ws) { wsManager.unregister(ws as unknown as WebSocket) },
      message(ws, msg) {
        try {
          const data = JSON.parse(msg.toString())
          if (data.type === 'auth') {
            const valid = !process.env.FRONTEND_PASSWORD || data.password === process.env.FRONTEND_PASSWORD
            ws.send(JSON.stringify({ type: 'auth', success: valid }))
            if (!valid) ws.close()
          }
        } catch (err) {
          console.warn('Invalid WebSocket message:', err)
        }
      }
    }
  })

  console.log(`API running on http://localhost:${port}`)
  console.log(`WebSocket running on ws://localhost:${port + 1}`)
}

