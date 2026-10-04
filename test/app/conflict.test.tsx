import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import { SaveBanner } from '../../src/boards/SaveBanner'

describe('SaveBanner', () => {
  it('shows a clear conflict alert with both options, and no axe violations', async () => {
    const onReload = vi.fn()
    const blobs: Blob[] = []
    const create = vi.fn((b: Blob | MediaSource) => (blobs.push(b as Blob), 'blob:x'))
    URL.createObjectURL = create
    URL.revokeObjectURL = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<SaveBanner status={{ kind: 'conflict' }} onReload={onReload} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/changed somewhere else/)
    expect((await axe(container)).violations).toEqual([])
    await user.click(screen.getByRole('button', { name: /Keep my copy/ }))
    expect(create).toHaveBeenCalledTimes(1)
    expect(JSON.parse(await blobs[0]?.text() ?? '')).toMatchObject({ title: expect.any(String), doc: { version: 1 } })
    expect(onReload).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Reload server version/ }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })
  it('uses role=alert for offline, rejected and session-ended states', async () => {
    const { container, rerender } = render(<SaveBanner status={{ kind: 'offline', message: 'x' }} onReload={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Offline/)
    rerender(<SaveBanner status={{ kind: 'rejected', message: 'too big' }} onReload={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/too big/)
    rerender(<SaveBanner status={{ kind: 'unauthenticated' }} onReload={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/log in again/)
    expect(screen.getByRole('alert')).not.toHaveTextContent(/changed somewhere else/)
    expect(screen.getByRole('button', { name: /Keep my copy/ })).toBeInTheDocument()
    expect((await axe(container)).violations).toEqual([])
  })
  it('keeps routine progress silent and announces only recovery after a failure', () => {
    const { rerender } = render(<SaveBanner status={{ kind: 'saving' }} onReload={() => {}} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    rerender(<SaveBanner status={{ kind: 'saved' }} onReload={() => {}} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    rerender(<SaveBanner status={{ kind: 'offline', message: 'x' }} onReload={() => {}} />)
    rerender(<SaveBanner status={{ kind: 'saved' }} onReload={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent(/saved again/)
  })
})
