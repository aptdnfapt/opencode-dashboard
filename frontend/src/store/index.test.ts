// frontend/src/store/index.test.ts
// Tests Zustand store actions and selectors
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './index'

describe('Dashboard Store', () => {
  beforeEach(() => {
    useStore.setState({
      sessions: [],
      selectedSession: null,
      filters: { hostname: null, status: null, search: '', directory: '' },
      theme: 'system',
      wsConnected: false,
      timeline: new Map()
    })
  })

  it('setSessions replaces session list', () => {
    const sessions = [{ id: 's1', title: 'Test', hostname: 'vps1', status: 'active' }]
    useStore.getState().setSessions(sessions as any)

    expect(useStore.getState().sessions).toHaveLength(1)
    expect(useStore.getState().sessions[0].id).toBe('s1')
  })

  it('updateSession modifies existing session', () => {
    useStore.setState({ sessions: [{ id: 's1', title: 'Old', status: 'active' }] as any })
    useStore.getState().updateSession({ id: 's1', title: 'New' } as any)

    expect(useStore.getState().sessions[0].title).toBe('New')
  })

  it('setFilters merges filter values', () => {
    useStore.getState().setFilters({ hostname: 'vps1' })
    useStore.getState().setFilters({ status: 'idle' })

    expect(useStore.getState().filters.hostname).toBe('vps1')
    expect(useStore.getState().filters.status).toBe('idle')
  })

  it('getFilteredSessions applies hostname filter', () => {
    useStore.setState({
      sessions: [
        { id: 's1', hostname: 'vps1', title: 'A', status: 'active' },
        { id: 's2', hostname: 'vps2', title: 'B', status: 'active' }
      ] as any,
      filters: { hostname: 'vps1', status: null, search: '', directory: '' }
    })

    const filtered = useStore.getState().getFilteredSessions()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].hostname).toBe('vps1')
  })

  it('getFilteredSessions applies search filter', () => {
    useStore.setState({
      sessions: [
        { id: 's1', hostname: 'vps1', title: 'Fix bug', status: 'active' },
        { id: 's2', hostname: 'vps1', title: 'Add feature', status: 'active' }
      ] as any,
      filters: { hostname: null, status: null, search: 'bug', directory: '' }
    })

    const filtered = useStore.getState().getFilteredSessions()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toContain('bug')
  })
})
