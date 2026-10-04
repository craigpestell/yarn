import { describe, expect, it } from 'vitest'
import { handlePurge, RETENTION_DAYS, type PurgeDeps } from '../api/purge'

const SUPA = 'https://supa.test'
const U = '11111111-1111-4111-8111-111111111111'
const B1 = '22222222-2222-4222-8222-222222222222'
const B2 = '33333333-3333-4333-8333-333333333333'
const NOW = new Date('2026-11-01T00:00:00Z')

function setup(opts: { rows?: unknown; storageOk?: boolean; deleteOk?: boolean; secret?: string } = {}) {
  const calls: { method: string; url: string; body?: string; auth?: string }[] = []
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body as string | undefined, auth: (init?.headers as Record<string, string> | undefined)?.authorization })
    if (url.startsWith(`${SUPA}/storage/`)) return new Response('[]', { status: opts.storageOk === false ? 500 : 200 })
    if (method === 'DELETE') return new Response(null, { status: opts.deleteOk === false ? 500 : 204 })
    return Response.json(opts.rows ?? [{ id: B1, owner_id: U }, { id: B2, owner_id: U }])
  }) as typeof fetch
  const deps: PurgeDeps = { fetch: fakeFetch, supabaseUrl: SUPA, serviceKey: 'svc', cronSecret: opts.secret ?? 's3cret', now: NOW }
  return { calls, deps }
}
const req = (auth?: string) => new Request('https://app.test/api/purge', { headers: auth ? { authorization: auth } : {} })

describe('trash purge', () => {
  it('refuses requests without the cron secret, and everything when none is configured', async () => {
    const a = setup()
    expect((await handlePurge(req(), a.deps)).status).toBe(401)
    expect((await handlePurge(req('Bearer wrong'), a.deps)).status).toBe(401)
    expect(a.calls).toHaveLength(0)
    const b = setup({ secret: '' })
    expect((await handlePurge(req('Bearer '), b.deps)).status).toBe(401)
    expect(b.calls).toHaveLength(0)
  })

  it('removes both thumbnails per board, then deletes the boards, using a 30-day cutoff', async () => {
    const { calls, deps } = setup()
    const res = await handlePurge(req('Bearer s3cret'), deps)
    expect(await res.json()).toEqual({ purged: 2, kept: 0 })
    const cutoff = new Date(NOW.getTime() - RETENTION_DAYS * 86_400_000).toISOString()
    expect(calls[0]!.url).toContain(`deleted_at=lt.${encodeURIComponent(cutoff)}`)
    expect(calls[0]!.auth).toBe('Bearer svc')
    expect(JSON.parse(calls[1]!.body!)).toEqual({ prefixes: [`${U}/${B1}.png`, `${U}/pub-${B1}.png`, `${U}/${B2}.png`, `${U}/pub-${B2}.png`] })
    expect(calls[2]!.method).toBe('DELETE')
    expect(calls[2]!.url).toContain(`id=in.(${B1},${B2})`)
    expect(calls[2]!.url).toContain('deleted_at=lt.')
  })

  it('does nothing when the trash is empty', async () => {
    const { calls, deps } = setup({ rows: [] })
    expect(await (await handlePurge(req('Bearer s3cret'), deps)).json()).toEqual({ purged: 0, kept: 0 })
    expect(calls).toHaveLength(1)
  })

  it('keeps the boards when their thumbnails could not be removed', async () => {
    const { calls, deps } = setup({ storageOk: false })
    expect((await handlePurge(req('Bearer s3cret'), deps)).status).toBe(502)
    expect(calls.some((c) => c.url.startsWith(`${SUPA}/rest/v1/boards?id=in`))).toBe(false)
  })

  it('never deletes on malformed rows', async () => {
    const { calls, deps } = setup({ rows: [{ id: 'x),(1=1', owner_id: U }] })
    expect((await handlePurge(req('Bearer s3cret'), deps)).status).toBe(502)
    expect(calls).toHaveLength(1)
  })
})
