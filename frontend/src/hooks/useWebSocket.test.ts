// frontend/src/hooks/useWebSocket.test.ts
// Tests WebSocket hook message handling
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

  constructor() {
    MockWebSocket.instances.push(this)
    setTimeout(() => this.onopen?.(), 0)
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  it('sends auth message on connect', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useWebSocket('test-password', onMessage))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    const ws = MockWebSocket.instances[0]

    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"auth"')
    )
  })

  it('calls onMessage for non-auth messages', async () => {
    const onMessage = vi.fn()
    renderHook(() => useWebSocket('test', onMessage))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
      const ws = MockWebSocket.instances[0]

      ws.onmessage?.({ data: JSON.stringify({ type: 'session.created', data: { id: 's1' } }) })
    })

    expect(onMessage).toHaveBeenCalledWith({ type: 'session.created', data: { id: 's1' } })
  })
})
