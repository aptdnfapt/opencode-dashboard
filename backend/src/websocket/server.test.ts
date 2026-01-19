// Tests WebSocket broadcast functionality
import { describe, it, expect } from 'bun:test'
import { WebSocketManager } from './server'

describe('WebSocket Manager', () => {
  it('adds client to set on register', () => {
    const manager = new WebSocketManager()
    const mockWs = { send: () => {}, readyState: 1 } as any

    manager.register(mockWs)
    expect(manager.clientCount).toBe(1)
  })

  it('removes client on unregister', () => {
    const manager = new WebSocketManager()
    const mockWs = { send: () => {}, readyState: 1 } as any

    manager.register(mockWs)
    manager.unregister(mockWs)
    expect(manager.clientCount).toBe(0)
  })

  it('broadcasts message to all connected clients', () => {
    const manager = new WebSocketManager()
    const received: string[] = []
    const mockWs1 = { send: (msg: string) => received.push(msg), readyState: 1 } as any
    const mockWs2 = { send: (msg: string) => received.push(msg), readyState: 1 } as any

    manager.register(mockWs1)
    manager.register(mockWs2)
    manager.broadcast({ type: 'test', data: { foo: 'bar' } })

    expect(received.length).toBe(2)
    expect(JSON.parse(received[0])).toEqual({ type: 'test', data: { foo: 'bar' } })
  })

  it('skips clients with closed connection', () => {
    const manager = new WebSocketManager()
    const received: string[] = []
    const openWs = { send: (msg: string) => received.push(msg), readyState: 1 } as any
    const closedWs = { send: () => {}, readyState: 3 } as any // CLOSED = 3

    manager.register(openWs)
    manager.register(closedWs)
    manager.broadcast({ type: 'test', data: {} })

    expect(received.length).toBe(1)
  })
})
