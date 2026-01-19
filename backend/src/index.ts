// backend/src/index.ts
// Main API entry point - exports Hono app for Bun server
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import db from './db'
import { createWebhookHandler } from './handlers/webhook'

const app = new Hono()

// Enable CORS for frontend
app.use('*', cors())

// Root endpoint - health check
app.get('/', (c) => c.text('OpenCode Dashboard API'))

// Register handlers
createWebhookHandler(app, db)

// 404 handler
app.notFound((c) => c.text('Not Found', 404))

export default app
