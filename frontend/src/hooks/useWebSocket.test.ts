// @vitest-environment jsdom
// frontend/src/hooks/useWebSocket.test.ts
// Tests WebSocket hook message handling
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  readyState = 1
  send = vi.fn()
  close = vi.fn()
  timeoutHandle: ReturnType<typeof setTimeout> | undefined

  constructor() {
    MockWebSocket.instances.push(this)
    this.timeoutHandle = setTimeout(() => {
      this.onopen?.()
    }, 0)
  }

  // Cleanup on unmount
  static cleanup() {
    MockWebSocket.instances.forEach(ws => {
      if (ws.timeoutHandle) clearTimeout(ws.timeoutHandle)
    })
    MockWebSocket.instances = []
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket as any)
  })

  afterEach(() => {
    MockWebSocket.cleanup()
    vi.unstubAllGlobals()
  })

  it.skip('sends auth message on connect', async () => {
    const onMessage = vi.fn()
    renderHook(() => useWebSocket('test-password', onMessage))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 15))
    })

    const ws = MockWebSocket.instances[0]
    expect(ws).toBeDefined()
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"auth"')
    )
  })

  it.skip('calls onMessage for non-auth messages', async () => {
    const onMessage = vi.fn()
    renderHook(() => useWebSocket('test', onMessage))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 15))
      
      const ws = MockWebSocket.instances[0]
      expect(ws).toBeDefined()
      ws.onmessage?.({ data: JSON.stringify({ type: 'session.created', data: { id: 's1' } }) })
    })

    expect(onMessage).toHaveBeenCalledWith({ type: 'session.created', data: { id: 's1' } })
  })
})
