import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { boot } from '../../src/boot'
import { STORAGE_KEY } from '../../src/editor/persist'
import { SAMPLE_TITLE } from '../../src/editor/sample'
import { useBoard } from '../../src/editor/store'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('boot', () => {
  it('loads the sample on first run without a notice', () => {
    const stop = boot()
    stop()
    expect(useBoard.getState().title).toBe(SAMPLE_TITLE)
    expect(useBoard.getState().info).toBeNull()
  })
  it('keeps a backup and tells the user when the saved board is unloadable', () => {
    useBoard.setState({ info: null })
    localStorage.setItem(STORAGE_KEY, '{"title":"Mine","doc":{"version":1,"widgets":"broken"}}')
    const stop = boot()
    useBoard.getState().setTitle('Changed')
    stop() // flushes the autosave, which overwrites the main key
    expect(useBoard.getState().info).toMatch(/backup/)
    const backups = Object.keys(localStorage).filter((k) => k.includes(':backup:'))
    expect(backups).toHaveLength(1)
    expect(localStorage.getItem(backups[0] ?? '')).toContain('"Mine"')
  })
})
