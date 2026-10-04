/// <reference types="node" />
import { z } from 'zod'

/**
 * Vercel Cron function (see vercel.json): permanently deletes boards that have been in the trash for 30 days.
 * Deleting the boards row cascades to links, shares and topic tags. Thumbnail files cannot be removed from SQL,
 * so they are deleted through the Storage API first; a board whose files could not be removed is kept for the
 * next run. Uses the service-role key (RLS bypass), so it only answers a request carrying CRON_SECRET, which
 * Vercel adds to cron invocations; with no secret configured it refuses everything.
 */
export interface PurgeDeps {
  fetch: typeof fetch
  supabaseUrl: string
  serviceKey: string
  cronSecret: string
  now: Date
}

export const RETENTION_DAYS = 30
const BATCH = 100
const THUMB_BUCKET = 'thumbnails'
const Rows = z.array(z.object({ id: z.string().uuid(), owner_id: z.string().uuid() }))

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function handlePurge(request: Request, deps: PurgeDeps): Promise<Response> {
  if (!deps.cronSecret || request.headers.get('authorization') !== `Bearer ${deps.cronSecret}`) return json(401, { error: 'unauthorized' })
  if (!deps.supabaseUrl || !deps.serviceKey) return json(500, { error: 'not configured' })
  const headers = { apikey: deps.serviceKey, authorization: `Bearer ${deps.serviceKey}` }
  const rest = `${deps.supabaseUrl}/rest/v1/boards`

  const cutoff = new Date(deps.now.getTime() - RETENTION_DAYS * 86_400_000).toISOString()
  const listed = await deps.fetch(`${rest}?select=id,owner_id&deleted_at=lt.${encodeURIComponent(cutoff)}&order=deleted_at.asc&limit=${BATCH}`, { headers })
  if (!listed.ok) return json(502, { error: 'could not list boards' })
  const parsed = Rows.safeParse(await listed.json())
  if (!parsed.success) return json(502, { error: 'unexpected board rows' })
  const boards = parsed.data
  if (boards.length === 0) return json(200, { purged: 0, kept: 0 })

  // Missing files are not an error for Storage, so a non-OK answer means the files may still exist.
  const prefixes = boards.flatMap((b) => [`${b.owner_id}/${b.id}.png`, `${b.owner_id}/pub-${b.id}.png`])
  const removed = await deps.fetch(`${deps.supabaseUrl}/storage/v1/object/${THUMB_BUCKET}`, {
    method: 'DELETE',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes }),
  })
  if (!removed.ok) return json(502, { error: 'could not remove thumbnails', purged: 0, kept: boards.length })

  const ids = boards.map((b) => b.id).join(',')
  const deleted = await deps.fetch(`${rest}?id=in.(${ids})&deleted_at=lt.${encodeURIComponent(cutoff)}`, { method: 'DELETE', headers })
  if (!deleted.ok) return json(502, { error: 'could not delete boards', purged: 0, kept: boards.length })
  return json(200, { purged: boards.length, kept: 0 })
}

export function GET(request: Request): Promise<Response> {
  const env = process.env
  return handlePurge(request, {
    fetch,
    supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '',
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    cronSecret: env.CRON_SECRET ?? '',
    now: new Date(),
  })
}
