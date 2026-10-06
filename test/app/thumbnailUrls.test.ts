import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { thumbnailUrls } from '../../src/boards/thumbnails'

const clientWith = (data: unknown): SupabaseClient =>
  ({ storage: { from: () => ({ createSignedUrls: async () => ({ data, error: null }) }) } }) as unknown as SupabaseClient

describe('thumbnailUrls', () => {
  it('skips boards whose thumbnail does not exist (signedUrl null) instead of failing the list', async () => {
    const client = clientWith([
      { path: 'u/a.png', signedUrl: 'https://x/a' },
      { path: 'u/b.png', signedUrl: null, error: 'Object not found' },
    ])
    const urls = await thumbnailUrls(client, 'u', ['a', 'b'])
    expect([...urls]).toEqual([['a', 'https://x/a']])
  })

  it('returns an empty map for an unexpected response shape', async () => {
    expect((await thumbnailUrls(clientWith('nope'), 'u', ['a'])).size).toBe(0)
  })
})
