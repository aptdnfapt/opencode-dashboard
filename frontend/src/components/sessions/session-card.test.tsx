// frontend/src/components/sessions/session-card.test.tsx
// Tests SessionCard component
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionCard } from './session-card'
import type { Session } from '@/store'

const mockSession: Session = {
  id: 's1',
  title: 'Fix authentication bug',
  hostname: 'vps1',
  status: 'active' as const,
  created_at: Date.now() - 3600000,
  updated_at: Date.now() - 60000,
  needs_attention: 0,
  token_total: 15000,
  cost_total: 0.45,
}

describe('SessionCard', () => {
  it('renders session title and hostname', () => {
    render(<SessionCard session={mockSession} onClick={() => {}} />)

    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    expect(screen.getByText('vps1')).toBeInTheDocument()
  })

  it('shows status badge with correct variant', () => {
    render(<SessionCard session={mockSession} onClick={() => {}} />)

    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows attention indicator when needs_attention is 1', () => {
    const attentionSession = { ...mockSession, needs_attention: 1 }
    render(<SessionCard session={attentionSession} onClick={() => {}} />)

    expect(screen.getByText('Needs Attention')).toBeInTheDocument()
  })

  it('displays token count and cost', () => {
    render(<SessionCard session={mockSession} onClick={() => {}} />)

    expect(screen.getByText(/15,000/)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.45/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<SessionCard session={mockSession} onClick={handleClick} />)

    fireEvent.click(screen.getByRole('article'))
    expect(handleClick).toHaveBeenCalled()
  })

  it('applies flash class when justUpdated is true', () => {
    const { container } = render(
      <SessionCard session={mockSession} onClick={() => {}} justUpdated />
    )

    expect(container.firstChild).toHaveClass('ring-2')
  })
})
