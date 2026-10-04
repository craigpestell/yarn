import { describe, expect, it } from 'vitest'
import { nextTrail, readTrail, recordNavigation, resolveTrail, TRAIL_KEY, TRAIL_MAX, type TrailStorage } from '../../src/links/trail'

const mem = (): TrailStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
const e = (slug: string) => ({ slug, title: slug.toUpperCase() })

describe('breadcrumb trail', () => {
  it('records the path across boards and resolves it on arrival', () => {
    const s = mem()
    expect(resolveTrail(s, 'aaa')).toEqual([])
    recordNavigation(s, e('aaa'), 'bbb')
    expect(resolveTrail(s, 'bbb')).toEqual([e('aaa')])
    recordNavigation(s, e('bbb'), 'ccc')
    expect(resolveTrail(s, 'ccc')).toEqual([e('aaa'), e('bbb')])
  })
  it('keeps the trail on reload and truncates when going back', () => {
    const s = mem()
    recordNavigation(s, e('aaa'), 'bbb')
    resolveTrail(s, 'bbb')
    expect(resolveTrail(s, 'bbb')).toEqual([e('aaa')]) // reload / StrictMode double run
    expect(resolveTrail(s, 'aaa')).toEqual([]) // back via breadcrumb
  })
  it('linking back to a board on the trail does not create a loop', () => {
    const s = mem()
    recordNavigation(s, e('aaa'), 'bbb')
    resolveTrail(s, 'bbb')
    recordNavigation(s, e('bbb'), 'aaa')
    expect(resolveTrail(s, 'aaa')).toEqual([])
  })
  it('resets on a direct visit to an unrelated board', () => {
    const s = mem()
    recordNavigation(s, e('aaa'), 'bbb')
    resolveTrail(s, 'bbb')
    expect(resolveTrail(s, 'zzz')).toEqual([])
  })
  it('caps the length', () => {
    const s = mem()
    for (let i = 0; i < TRAIL_MAX + 5; i++) {
      recordNavigation(s, e(`b${String(i).padStart(2, '0')}`), `b${String(i + 1).padStart(2, '0')}`)
      resolveTrail(s, `b${String(i + 1).padStart(2, '0')}`)
    }
    expect(readTrail(s).trail).toHaveLength(TRAIL_MAX)
  })
  it('discards malformed or tampered storage', () => {
    const s = mem()
    for (const bad of ['not json', '{"trail":[{"slug":"../x","title":"t"}],"pendingTo":null,"current":null}', '{"trail":"x"}', JSON.stringify({ trail: Array.from({ length: 50 }, (_, i) => e(`s${i}x`)), pendingTo: null, current: null })]) {
      s.data.set(TRAIL_KEY, bad)
      expect(readTrail(s).trail).toEqual([])
    }
    expect(nextTrail({ trail: [], pendingTo: null, current: null }, 'abc').current).toBe('abc')
  })
  it('survives unavailable storage', () => {
    const broken: TrailStorage = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(resolveTrail(broken, 'aaa')).toEqual([])
    expect(() => recordNavigation(broken, e('aaa'), 'bbb')).not.toThrow()
  })
})
