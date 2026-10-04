import { describe, expect, it } from 'vitest'
import { createResolver, isPrivateAddress, isPublicHttpsUrl } from '../../agents/lib/web'

describe('isPublicHttpsUrl', () => {
  it.each([
    'https://example.org/a', 'https://upload.wikimedia.org/x.jpg', 'https://example.org:443/a',
  ])('allows %s', (u) => expect(isPublicHttpsUrl(u)).toBe(true))
  it.each([
    'http://example.org', 'ftp://example.org', 'https://localhost/x', 'https://app.localhost/x', 'https://foo.local/x',
    'https://127.0.0.1/x', 'https://10.1.2.3/x', 'https://192.168.0.1/x', 'https://172.16.5.5/x', 'https://169.254.169.254/latest',
    'https://[::1]/x', 'https://[fd00::1]/x', 'https://[::ffff:127.0.0.1]/x', 'https://user:pw@example.org/', 'https://intranet/x', 'not a url',
    'https://0.0.0.0/x', 'https://100.64.0.1/x',
    'https://[::7f00:1]/x', 'https://[::a00:1]/x', 'https://[2002:7f00:1::]/x', 'https://[2002:c0a8:1::1]/x', 'https://[2001::1]/x',
    'https://[2001:0:4136:e378::1]/x', 'https://[2001:db8::1]/x', 'https://192.0.2.1/x', 'https://198.51.100.7/x', 'https://203.0.113.9/x',
    'https://example.com:22/x', 'https://commons.wikimedia.org:8443/x', 'https://example.com:80/x', 'https://[fec0::1]/x', 'https://192.88.99.1/x',
    'https://[::ffff:a00:1]/x', 'https://[64:ff9b::1]/x',
  ])('rejects %s', (u) => expect(isPublicHttpsUrl(u)).toBe(false))
  it('classifies addresses', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
    expect(isPrivateAddress('2606:4700::1111')).toBe(false)
    expect(isPrivateAddress('172.32.0.1')).toBe(false)
    expect(isPrivateAddress('fec0::1')).toBe(true)
    expect(isPrivateAddress('192.88.99.1')).toBe(true)
    expect(isPrivateAddress('192.88.98.1')).toBe(false)
    expect(isPrivateAddress('2002:0808:0808::1')).toBe(false) // 6to4 wrapping a public v4
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false)
  })
})

const res = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers })
const pub = async () => ['93.184.216.34']

describe('createResolver', () => {
  it('accepts a 200 on HEAD', async () => {
    const calls: string[] = []
    const r = createResolver({ lookup: pub, fetch: async (_u, init) => (calls.push(String(init?.method)), res(200)) })
    expect(await r('https://example.org/a')).toBe(true)
    expect(calls).toEqual(['HEAD'])
  })
  it('falls back to GET when HEAD is refused', async () => {
    const r = createResolver({ lookup: pub, fetch: async (_u, init) => (init?.method === 'HEAD' ? res(405) : res(200)) })
    expect(await r('https://example.org/a')).toBe(true)
  })
  it('rejects 404 on both methods', async () => {
    const r = createResolver({ lookup: pub, fetch: async () => res(404) })
    expect(await r('https://example.org/a')).toBe(false)
  })
  it('rejects hosts that resolve to private addresses, without fetching', async () => {
    let fetched = false
    const r = createResolver({ lookup: async () => ['93.184.216.34', '10.0.0.1'], fetch: async () => ((fetched = true), res(200)) })
    expect(await r('https://rebind.example/a')).toBe(false)
    expect(fetched).toBe(false)
  })
  it('re-checks redirects: a redirect to a private host is refused', async () => {
    const r = createResolver({
      lookup: async (h) => (h === 'internal.example' ? ['192.168.1.1'] : ['93.184.216.34']),
      fetch: async () => res(302, { location: 'https://internal.example/secret' }),
    })
    expect(await r('https://example.org/a')).toBe(false)
  })
  it('follows a safe redirect and caps redirect loops', async () => {
    const ok = createResolver({ lookup: pub, fetch: async (u) => (String(u).endsWith('/b') ? res(200) : res(301, { location: '/b' })) })
    expect(await ok('https://example.org/a')).toBe(true)
    const loop = createResolver({ lookup: pub, fetch: async () => res(301, { location: '/a' }) })
    expect(await loop('https://example.org/a')).toBe(false)
  })
  it('treats network errors and timeouts as unresolvable', async () => {
    const r = createResolver({ lookup: pub, fetch: async () => { throw new Error('boom') } })
    expect(await r('https://example.org/a')).toBe(false)
  })
  it('passes a timeout signal and never follows redirects itself', async () => {
    let init: RequestInit | undefined
    await createResolver({ lookup: pub, fetch: async (_u, i) => ((init = i), res(200)) })('https://example.org/a')
    expect(init?.redirect).toBe('manual')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })
  it('refuses http without any request', async () => {
    let fetched = false
    expect(await createResolver({ lookup: pub, fetch: async () => ((fetched = true), res(200)) })('http://example.org')).toBe(false)
    expect(fetched).toBe(false)
  })
})
