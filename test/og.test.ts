import { afterEach, describe, expect, it, vi } from 'vitest'
import { escapeHtml, GET, handleOg, type OgDeps } from '../api/og'

const SUPA = 'https://supa.test'
const KEY = 'anon-key'
const SECRET = 'TOP SECRET <b>TITLE</b>'

type Row = { title: string; thumbnail_path: string; visibility: 'private' | 'unlisted' | 'public' }

interface Call {
  url: string
  headers: Record<string, string>
}

/** Fake of the three upstreams: the SPA shell, the get_board_og RPC (as anon RLS would answer) and Storage. */
function setup(rows: Record<string, Row>) {
  const calls: Call[] = []
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)) })
    if (url === 'https://app.test/index.html') return new Response('<html><head><title>Yarns</title></head><body></body></html>')
    if (url === `${SUPA}/rest/v1/rpc/get_board_og`) {
      const slug = (JSON.parse(String(init?.body)) as { p_slug: string }).p_slug
      return Response.json(rows[slug] ? [rows[slug]] : [])
    }
    if (url.startsWith(`${SUPA}/storage/v1/object/authenticated/thumbnails/`)) return new Response(new Uint8Array([137, 80, 78, 71]))
    return new Response('nope', { status: 404 })
  }) as typeof fetch
  const deps: OgDeps = { fetch: fakeFetch, supabaseUrl: SUPA, anonKey: KEY }
  return { calls, deps }
}
const rows: Record<string, Row> = { 'good-board': { title: 'Good <Board> & "co"', thumbnail_path: 'u1/pub-b1.png', visibility: 'public' } }
const req = (path: string) => new Request(`https://app.test${path}`)

describe('OG function (AC 8)', () => {
  it('returns title and thumbnail meta (escaped) for a public/unlisted board, on top of the SPA shell', async () => {
    const { deps } = setup(rows)
    const res = await handleOg(req('/api/og?slug=good-board'), deps)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(html).toContain('<meta property="og:title" content="Good &lt;Board&gt; &amp; &quot;co&quot;" />')
    expect(html).toContain('<meta property="og:image" content="https://app.test/api/og?slug=good-board&amp;image=1" />')
    expect(html).toContain('<title>Good &lt;Board&gt; &amp; &quot;co&quot; - Yarns</title>')
    expect(html).toContain('</body>')
  })

  it('returns generic title-less meta for private and unknown boards, identical in both cases', async () => {
    // Even if the upstream wrongly answered with a titled row for the private board, the handler must not use it.
    const { deps } = setup({ 'private-board': { title: SECRET, thumbnail_path: 'u/pub-p.png', visibility: 'private' } })
    const priv = await handleOg(req('/api/og?slug=private-board'), deps)
    const unknown = await handleOg(req('/api/og?slug=no-such-board'), deps)
    const [a, b] = [await priv.text(), await unknown.text()]
    expect(priv.status).toBe(unknown.status)
    expect(a).toBe(b)
    expect(a).toContain('<meta property="og:title" content="Yarns" />')
    expect(a).not.toContain('SECRET')
    expect(a).not.toContain('og:image')
    expect(a).not.toContain('private-board')
    expect((await handleOg(req('/api/og?slug=private-board&image=1'), deps)).status).toBe(404)
  })

  it('uses a short edge cache with no stale-while-revalidate for both the page and the image', async () => {
    const { deps } = setup(rows)
    for (const path of ['/api/og?slug=good-board', '/api/og?slug=good-board&image=1']) {
      const cc = (await handleOg(req(path), deps)).headers.get('cache-control') ?? ''
      expect(cc).not.toContain('stale-while-revalidate')
      expect(Number(/s-maxage=(\d+)/.exec(cc)?.[1])).toBeLessThanOrEqual(10)
    }
  })

  it.each([
    ['$&'],
    ["$'"],
    ['$`'],
    ['$$'],
    ['</title><script>alert(1)</script>'],
    ["a $& b $' c $` d $$ e </title><script>"],
  ])('keeps a hostile title literal and escaped: %s', async (title) => {
    const { deps } = setup({ 'good-board': { title, thumbnail_path: 'u1/pub-b1.png', visibility: 'public' } })
    const html = await (await handleOg(req('/api/og?slug=good-board'), deps)).text()
    const esc = escapeHtml(title)
    expect(html).toContain(`<title>${esc} - Yarns</title>`)
    expect(html).toContain(`<meta property="og:title" content="${esc}" />`)
    expect(html).not.toContain('<script')
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/<\/head>/g)).toHaveLength(1)
    expect(html).toContain('</body>')
  })

  it('reads the slug from /b/:slug paths and rejects malformed slugs without querying', async () => {
    const { deps, calls } = setup(rows)
    expect(await (await handleOg(req('/b/good-board'), deps)).text()).toContain('Good &lt;Board&gt;')
    const before = calls.filter((c) => c.url.includes('/rpc/')).length
    for (const bad of ['/api/og?slug=..%2Fetc', '/api/og?slug=A', '/api/og?slug=a--b-c', '/api/og']) {
      expect(await (await handleOg(req(bad), deps)).text()).toContain('content="Yarns"')
    }
    expect(calls.filter((c) => c.url.includes('/rpc/')).length).toBe(before)
  })

  it('talks to Supabase with the anon key only', async () => {
    const { deps, calls } = setup(rows)
    await handleOg(req('/api/og?slug=good-board'), deps)
    await handleOg(req('/api/og?slug=good-board&image=1'), deps)
    const upstream = calls.filter((c) => c.url.startsWith(SUPA))
    expect(upstream.length).toBeGreaterThan(1)
    for (const c of upstream) {
      expect(c.headers.apikey).toBe(KEY)
      expect(c.headers.authorization).toBe(`Bearer ${KEY}`)
    }
  })

  it('serves the published thumbnail bytes for the image URL, 404 when not visible', async () => {
    const { deps } = setup(rows)
    const ok = await handleOg(req('/api/og?slug=good-board&image=1'), deps)
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await ok.arrayBuffer())[0]).toBe(137)
    expect((await handleOg(req('/api/og?slug=private-board&image=1'), deps)).status).toBe(404)
  })

  it('degrades to generic meta when the database is unreachable', async () => {
    const deps: OgDeps = { fetch: (async () => { throw new Error('down') }) as typeof fetch, supabaseUrl: SUPA, anonKey: KEY }
    const res = await handleOg(req('/api/og?slug=good-board'), deps)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('content="Yarns"')
  })

  describe('GET', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })
    it('calls handleOg with the global fetch and the anon-key environment', async () => {
      vi.stubEnv('SUPABASE_URL', SUPA)
      vi.stubEnv('SUPABASE_ANON_KEY', KEY)
      const { deps, calls } = setup(rows)
      vi.stubGlobal('fetch', deps.fetch)
      const res = await GET(req('/api/og?slug=good-board'))
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('og:title" content="Good &lt;Board&gt;')
      const rpc = calls.find((c) => c.url === `${SUPA}/rest/v1/rpc/get_board_og`)
      expect(rpc?.headers.apikey).toBe(KEY)
    })
  })
})
