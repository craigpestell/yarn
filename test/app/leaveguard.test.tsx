import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LeaveGuard } from '../../src/boards/LeaveGuard'

function app(active: boolean) {
  const router = createMemoryRouter(
    [
      { path: '/edit', element: <><LeaveGuard active={active} /><Link to="/boards">away</Link></> },
      { path: '/boards', element: <main>boards page</main> },
    ],
    { initialEntries: ['/edit'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('LeaveGuard', () => {
  it('lets navigation through when nothing is unsaveable', async () => {
    const r = app(false)
    await userEvent.setup().click(screen.getByRole('link', { name: 'away' }))
    expect(r.state.location.pathname).toBe('/boards')
  })
  it('blocks navigation while edits cannot be saved; Stay keeps the page, Leave anyway proceeds', async () => {
    const user = userEvent.setup()
    const r = app(true)
    await user.click(screen.getByRole('link', { name: 'away' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/)
    expect(r.state.location.pathname).toBe('/edit')
    await user.click(screen.getByRole('button', { name: 'Stay' }))
    expect(r.state.location.pathname).toBe('/edit')
    await user.click(screen.getByRole('link', { name: 'away' }))
    await user.click(await screen.findByRole('button', { name: 'Leave anyway' }))
    expect(r.state.location.pathname).toBe('/boards')
  })
})
