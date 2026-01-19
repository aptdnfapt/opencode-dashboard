// Tests API root endpoint returns correct response
import { describe, it, expect } from 'bun:test'
import app from './index'

describe('API Root', () => {
  it('returns 200 with API name on GET /', async () => {
    const res = await app.fetch(new Request('http://localhost/'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OpenCode Dashboard API')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await app.fetch(new Request('http://localhost/unknown'))
    expect(res.status).toBe(404)
  })
})
