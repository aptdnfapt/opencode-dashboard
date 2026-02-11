// backend/src/index.ts
// Main API entry point - exports Hono app for Bun server
// Load .env file if dotenv is available (dev only — Docker passes env vars directly)
try { const { config } = await import('dotenv'); config() } catch { /* dotenv not installed in prod */ }

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { existsSync } from 'fs'
import { join } from 'path'
import db from './db'
import { createWebhookHandler } from './handlers/webhook'
import { createApiHandler } from './handlers/api'
import { wsManager } from './websocket/server'
import { initTTS } from './services/tts'

const app = new Hono()

app.use('*', cors())
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

// Register handlers
createWebhookHandler(app, db)
createApiHandler(app, db)

// Resolve static dir: STATIC_DIR env or ../frontend-svelte/build (relative to cwd)
const staticDir = process.env.STATIC_DIR || join(import.meta.dir, '../../frontend-svelte/build')
const hasStaticFiles = existsSync(staticDir)

if (hasStaticFiles) {
  console.log(`[Static] Serving frontend from ${staticDir}`)
}

app.notFound((c) => c.text('Not Found', 404))

const port = parseInt(process.env.BACKEND_PORT || '3000')

// Export app for testing (NOT as default — Bun auto-starts default { port, fetch } exports)
export { app, port }

// Start servers only when run directly (not imported)
if (import.meta.main) {
  // Initialize TTS model in background (skip if DISABLE_TTS is set — phonemizer WASM conflicts in Docker)
  if (process.env.DISABLE_TTS !== 'true') {
    initTTS().catch(err => console.error('[TTS] Init failed:', err))
  } else {
    console.log('[TTS] Disabled via DISABLE_TTS env var')
  }

  // Single Bun.serve: API + static files + WebSocket on /ws — all one port
  Bun.serve({
    hostname: '0.0.0.0',
    port,
    async fetch(req, server) {
      const url = new URL(req.url)

      // WebSocket upgrade on /ws path
      if (url.pathname === '/ws') {
        if (server.upgrade(req)) return undefined as unknown as Response
        return new Response('WebSocket upgrade failed', { status: 426 })
      }

      // API + webhook + events routes → Hono
      if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health') || url.pathname.startsWith('/events')) {
        return app.fetch(req)
      }

      // Static files: try exact path first, then SPA fallback to index.html
      if (hasStaticFiles) {
        // Try exact file (e.g. /assets/app.js, /favicon.png)
        const filePath = join(staticDir, url.pathname)
        const file = Bun.file(filePath)
        if (await file.exists()) return new Response(file)

        // SPA fallback — return index.html for all non-file routes
        const indexFile = Bun.file(join(staticDir, 'index.html'))
        if (await indexFile.exists()) return new Response(indexFile)
      }

      // No static files (dev mode) — let Hono handle
      return app.fetch(req)
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

  console.log(`Dashboard running on http://localhost:${port}`)
  console.log(`  API:       http://localhost:${port}/api`)
  console.log(`  WebSocket: ws://localhost:${port}/ws`)
  if (hasStaticFiles) console.log(`  Frontend:  http://localhost:${port}/`)
}

