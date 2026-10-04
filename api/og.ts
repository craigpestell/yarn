/// <reference types="node" />
import { z } from 'zod'

/**
 * Vercel function behind `/b/:slug` (see vercel.json): serves the SPA shell with Open Graph meta injected.
 * Public/unlisted published boards get their title and thumbnail; private, unpublished and unknown boards all
 * get the same generic, title-less meta (and the same status), so the response never reveals which it was.
 * Uses the anon key only, so Postgres RLS / the get_board_og RPC decide what is visible.
 */
export interface OgDeps {
  fetch: typeof fetch
  supabaseUrl: string
  anonKey: string
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/
const OgRowsSchema = z.array(z.object({ title: z.string(), thumbnail_path: z.string(), visibility: z.enum(['private', 'unlisted', 'public']) }))
const SITE = 'Yarns'
const GENERIC_DESCRIPTION = 'Yarns: conspiracy boards you can build, source and share.'
// Short on purpose, and no stale-while-revalidate: an unpublished board's title or thumbnail may still be served
// from the edge for up to this long (residual risk, see the issue's Risks section).
const CACHE = 'public, max-age=0, s-maxage=10'
const FALLBACK_SHELL = '<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Yarns</title></head><body><div id="root"></div></body></html>'

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function slugOf(url: URL): string | null {
  const raw = url.searchParams.get('slug') ?? /^\/b\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? ''
  return SLUG_RE.test(raw) && !raw.includes('--') ? raw : null
}

async function lookup(slug: string, deps: OgDeps): Promise<z.infer<typeof OgRowsSchema>[number] | null> {
  try {
    const res = await deps.fetch(`${deps.supabaseUrl}/rest/v1/rpc/get_board_og`, {
      method: 'POST',
      headers: { apikey: deps.anonKey, authorization: `Bearer ${deps.anonKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    })
    if (!res.ok) return null
    const rows = OgRowsSchema.safeParse(await res.json())
    const row = rows.success ? (rows.data[0] ?? null) : null
    // Defense in depth: the RPC already filters, but never expose anything that is not public/unlisted.
    return row && row.visibility !== 'private' ? row : null
  } catch {
    return null
  }
}

const meta = (property: string, content: string) => `<meta property="${property}" content="${escapeHtml(content)}" />`

export function metaTags(origin: string, board: { title: string; slug: string } | null): string {
  if (!board) {
    return [`<meta name="description" content="${escapeHtml(GENERIC_DESCRIPTION)}" />`, meta('og:site_name', SITE), meta('og:title', SITE), meta('og:description', GENERIC_DESCRIPTION), meta('og:type', 'website'), '<meta name="twitter:card" content="summary" />'].join('\n')
  }
  const page = `${origin}/b/${board.slug}`
  const image = `${origin}/api/og?slug=${board.slug}&image=1`
  return [
    meta('og:site_name', SITE),
    meta('og:type', 'article'),
    meta('og:title', board.title),
    meta('og:description', `${board.title} on ${SITE}`),
    meta('og:url', page),
    meta('og:image', image),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(board.title)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].join('\n')
}

async function shell(origin: string, deps: OgDeps): Promise<string> {
  try {
    const res = await deps.fetch(`${origin}/index.html`)
    return res.ok ? await res.text() : FALLBACK_SHELL
  } catch {
    return FALLBACK_SHELL
  }
}

async function thumbnail(path: string, deps: OgDeps): Promise<Response> {
  try {
    const res = await deps.fetch(`${deps.supabaseUrl}/storage/v1/object/authenticated/thumbnails/${path}`, {
      headers: { apikey: deps.anonKey, authorization: `Bearer ${deps.anonKey}` },
    })
    if (res.ok) return new Response(await res.arrayBuffer(), { status: 200, headers: { 'content-type': 'image/png', 'cache-control': CACHE } })
  } catch {
    // fall through
  }
  return new Response('Not found', { status: 404 })
}

export async function handleOg(request: Request, deps: OgDeps): Promise<Response> {
  const url = new URL(request.url)
  const slug = slugOf(url)
  const row = slug ? await lookup(slug, deps) : null
  if (url.searchParams.get('image') === '1') {
    return row ? thumbnail(row.thumbnail_path, deps) : new Response('Not found', { status: 404 })
  }
  const tags = metaTags(url.origin, slug && row ? { title: row.title, slug } : null)
  const title = row ? `${escapeHtml(row.title)} - ${SITE}` : SITE
  const html = (await shell(url.origin, deps))
    // Replacer functions: a string replacement would expand `$&`, `$'` and `$\`` found in a board title.
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${title}</title>`)
    .replace('</head>', () => `${tags}\n</head>`)
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': CACHE } })
}

export function GET(request: Request): Promise<Response> {
  const env = process.env
  return handleOg(request, {
    fetch,
    supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '',
    anonKey: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? '',
  })
}
