import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer, contactEmail } from '../../src/pages/Footer'

describe('footer contact', () => {
  it('accepts a plain address and rejects unset or odd values', () => {
    expect(contactEmail(' legal@example.org ')).toBe('legal@example.org')
    for (const bad of [undefined, '', '   ', 'nope', 'a@b', 'x@y.org, z@y.org', 'a"b@c.de', 'a?subject=x@y.org', 'a&b@c.de', 'a#b@c.de']) expect(contactEmail(bad)).toBeNull()
  })
  it('renders a mailto link, and always the privacy and terms links', () => {
    const { container, rerender } = render(<Footer email="legal@example.org" />)
    expect(screen.getByRole('link', { name: 'legal@example.org' })).toHaveAttribute('href', 'mailto:legal@example.org')
    rerender(<Footer email={null} />)
    expect(screen.queryByRole('link', { name: 'legal@example.org' })).toBeNull()
    expect(container.querySelector('footer')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  })
})

describe('legal pages', () => {
  it('render their headings and a contact fallback', async () => {
    const { PrivacyPage, TermsPage } = await import('../../src/pages/LegalPages')
    const a = render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument()
    a.unmount()
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of service' })).toBeInTheDocument()
  })
})

describe('site header', () => {
  it('links back to the boards when signed in, and to login when not', async () => {
    const { SiteHeader } = await import('../../src/pages/Footer')
    const { MemoryRouter } = await import('react-router')
    const { AuthProvider } = await import('../../src/auth/AuthProvider')
    const out = render(<AuthProvider client={null}><MemoryRouter><SiteHeader /></MemoryRouter></AuthProvider>)
    expect(screen.getByRole('link', { name: 'Yarns' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Topics' })).toHaveAttribute('href', '/topics')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    out.unmount()
  })
})
