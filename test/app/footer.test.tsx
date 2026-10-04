import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer, contactEmail } from '../../src/pages/Footer'

describe('footer contact', () => {
  it('accepts a plain address and rejects unset or odd values', () => {
    expect(contactEmail(' legal@example.org ')).toBe('legal@example.org')
    for (const bad of [undefined, '', '   ', 'nope', 'a@b', 'x@y.org, z@y.org', 'a"b@c.de', 'a?subject=x@y.org', 'a&b@c.de', 'a#b@c.de']) expect(contactEmail(bad)).toBeNull()
  })
  it('renders a mailto link, or nothing when unset', () => {
    const { container, rerender } = render(<Footer email="legal@example.org" />)
    expect(screen.getByRole('link', { name: 'legal@example.org' })).toHaveAttribute('href', 'mailto:legal@example.org')
    rerender(<Footer email={null} />)
    expect(container.querySelector('footer')).toBeNull()
  })
})
