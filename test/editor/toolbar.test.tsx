import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Toolbar } from '../../src/editor/Toolbar'
import { useBoard } from '../../src/editor/store'

beforeEach(() => {
  useBoard.setState({ busy: false })
  useBoard.getState().cancelConnect()
})

const names = ['Add ▾', 'Connect yarn', 'Auto-organize', 'Import / export ▾']
const buttons = () => names.map((n) => screen.getByRole('button', { name: n }))

describe('Toolbar (Base UI)', () => {
  it('is a labelled horizontal toolbar with the same four controls', async () => {
    render(<Toolbar />)
    const bar = screen.getByRole('toolbar', { name: 'Board tools' })
    expect(bar).toHaveAttribute('aria-orientation', 'horizontal')
    expect(buttons()).toHaveLength(4)
    expect((await axe(bar)).violations).toEqual([])
  })

  it('is a single tab stop and moves between buttons with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Toolbar />)
    const [add, connect, organize, io] = buttons()
    await user.tab()
    expect(add).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(connect).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(organize).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(io).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(add).toHaveFocus() // wraps
    await user.keyboard('{ArrowLeft}')
    expect(io).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('toolbar').contains(document.activeElement)).toBe(false)
  })

  it('keeps Auto-organize focusable while busy, so focus is not lost', async () => {
    const user = userEvent.setup()
    render(<Toolbar />)
    const organize = screen.getByRole('button', { name: 'Auto-organize' })
    organize.focus()
    act(() => useBoard.setState({ busy: true }))
    const busy = screen.getByRole('button', { name: 'Organizing...' })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(busy).toHaveFocus()
    const original = useBoard.getState().organize
    const organizeSpy = vi.fn()
    useBoard.setState({ organize: organizeSpy })
    await user.click(busy)
    useBoard.setState({ organize: original })
    expect(organizeSpy).not.toHaveBeenCalled()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: 'Connect yarn' })).toHaveFocus()
  })

  it('still toggles connect mode and opens its menus from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Toolbar />)
    const connect = screen.getByRole('button', { name: 'Connect yarn' })
    connect.focus()
    await user.keyboard('{Enter}')
    expect(connect).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Pick the source widget')

    const add = screen.getByRole('button', { name: 'Add ▾' })
    add.focus()
    await user.keyboard('{Enter}')
    expect(add).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
    await user.keyboard('{Escape}')
    expect(add).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('keeps arrow keys inside an open menu instead of moving toolbar focus', async () => {
    const user = userEvent.setup()
    render(<Toolbar />)
    await user.click(screen.getByRole('button', { name: 'Add ▾' }))
    const item = screen.getAllByRole('menuitem')[0]
    item?.focus()
    await user.keyboard('{ArrowRight}{ArrowLeft}')
    expect(item).toHaveFocus()
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
  })
})
