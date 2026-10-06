import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from '../../src/auth/AuthProvider'
import { NavBar } from '../../src/pages/NavBar'
import { fakeClient } from './fakeClient'

function setup(signedIn: boolean) {
  const f = fakeClient({ session: signedIn ? undefined : null })
  render(
    <MemoryRouter>
      <AuthProvider client={f.client}><NavBar /></AuthProvider>
    </MemoryRouter>,
  )
}

describe('NavBar Explore link', () => {
  it.each([[false], [true]])('shows Explore next to Topics (signed in: %s)', async (signedIn) => {
    setup(signedIn)
    const explore = await screen.findByRole('link', { name: 'Explore' })
    expect(explore).toHaveAttribute('href', '/explore')
    const topics = screen.getByRole('link', { name: 'Topics' })
    expect(topics.nextElementSibling).toBe(explore)
  })
})
