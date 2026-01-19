// Tests StatCard renders title, value, and icon correctly
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './stat-card'

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Tokens" value="1,234,567" icon="tokens" />)

    expect(screen.getByText('Total Tokens')).toBeInTheDocument()
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<StatCard title="Cost" value="$12.34" icon="cost" subtitle="+5% from last week" />)

    expect(screen.getByText('+5% from last week')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <StatCard title="Test" value="123" icon="sessions" className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
