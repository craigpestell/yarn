import { describe, expect, it } from 'vitest'
import { checkTarget } from '../../agents/seed-curator'

describe('seed-curator target guard', () => {
  it('allows loopback hosts without --yes', () => {
    expect(checkTarget('http://127.0.0.1:54321', false)).toBe('127.0.0.1')
    expect(checkTarget('http://localhost:54321', false)).toBe('localhost')
  })
  it('requires --yes for any other host, and returns the host (not keys) when confirmed', () => {
    expect(() => checkTarget('https://abc.supabase.co', false)).toThrow(/--yes/)
    expect(() => checkTarget(undefined, false)).toThrow(/--yes/)
    expect(checkTarget('https://abc.supabase.co', true)).toBe('abc.supabase.co')
  })
})
