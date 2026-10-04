import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthProvider'
import { isDiscarding, registerActiveSave } from '../../src/boards/activeSave'
import { NavBar } from '../../src/pages/NavBar'
import { fakeClient } from './fakeClient'

let unregister = () => {}
afterEach(() => unregister())

function setup() {
  const f = fakeClient()
  render(
    <MemoryRouter>
      <AuthProvider client={f.client}><NavBar /></AuthProvider>
    </MemoryRouter>,
  )
  return f
}

describe('logout', () => {
  it('waits for the pending save to finish before signing out', async () => {
    const order: string[] = []
    let finish: (ok: boolean) => void = () => {}
    unregister = registerActiveSave(() => new Promise<boolean>((r) => (finish = (ok) => (order.push('saved'), r(ok)))))
    const f = setup()
    f.auth.signOut.mockImplementation(async () => (order.push('signOut'), { error: null }))
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(f.auth.signOut).not.toHaveBeenCalled()
    finish(true)
    await waitFor(() => expect(f.auth.signOut).toHaveBeenCalled())
    expect(order).toEqual(['saved', 'signOut'])
  })
  it('stays logged in with an alert when edits could not be saved, and offers to log out anyway', async () => {
    unregister = registerActiveSave(async () => false)
    const f = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not logged out/)
    expect(f.auth.signOut).not.toHaveBeenCalled()
    expect(isDiscarding()).toBe(false)
    await user.click(screen.getByRole('button', { name: /Log out anyway \(discard unsaved edits\)/ }))
    await waitFor(() => expect(f.auth.signOut).toHaveBeenCalled())
    expect(isDiscarding()).toBe(true)
  })
  it('logs out directly when no server board is open', async () => {
    const f = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(f.auth.signOut).toHaveBeenCalled())
  })
})

describe('logout with a hanging save', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())
  it('disables the button while waiting, never queues a second flush, and times out into log-out-anyway', async () => {
    const flush = vi.fn(() => new Promise<boolean>(() => {}))
    unregister = registerActiveSave(flush)
    const f = setup()
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    const btn = await screen.findByRole('button', { name: 'Log out' })
    await user.click(btn)
    const busy = await screen.findByRole('button', { name: 'Saving...' })
    expect(busy).toBeDisabled()
    await user.click(busy)
    await user.click(busy)
    expect(flush).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(8100))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not logged out/)
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
    expect(f.auth.signOut).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Log out anyway/ })).toBeInTheDocument()
  })
})

describe('unload guard', () => {
  it('is armed only while edits are unsaved', async () => {
    const { useUnloadGuard } = await import('../../src/boards/useUnloadGuard')
    const { renderHook } = await import('@testing-library/react')
    const add = vi.spyOn(window, 'addEventListener')
    const { rerender } = renderHook(({ k }) => useUnloadGuard({ kind: k } as never), { initialProps: { k: 'saved' as 'saved' | 'dirty' } })
    expect(add.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(false)
    rerender({ k: 'dirty' })
    expect(add.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(true)
    add.mockRestore()
  })
})
