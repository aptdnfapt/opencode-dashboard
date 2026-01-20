// backend/src/index.ts
// Main API entry point - exports Hono app for Bun server
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
      open(ws) { wsManager.register(ws) },
      close(ws) { wsManager.unregister(ws) },
      message(ws, msg) {
        const data = JSON.parse(msg.toString())
        if (data.type === 'auth') {
          const valid = !process.env.BACKEND_PASSWORD || data.password === process.env.BACKEND_PASSWORD
          ws.send(JSON.stringify({ type: 'auth', success: valid }))
          if (!valid) ws.close()
        }
      }
    }
  })

  console.log(`API running on http://localhost:${port}`)
  console.log(`WebSocket running on ws://localhost:${port + 1}`)
}

