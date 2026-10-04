import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface Logged {
  method: string
  url: string
  body: string
  response: string
}

export interface SBoard {
  id: string
  slug: string
  title: string
  visibility: 'private' | 'unlisted' | 'public'
  doc: unknown
  publishedDoc: unknown | null
  publishedTitle: string | null
}

export interface Link {
  id: string
  widget: string
  to: string
}

/**
 * A stand-in for PostgREST that follows the same visibility rules as the SQL (anon role): readers get
 * published data only, never `doc`, and a link to a board they cannot read has null title and slug.
 * Used with a real supabase-js client so tests can assert on the actual HTTP requests and responses.
 */
export function fakeServer(boards: SBoard[], links: Record<string, Link[]>, backlinks: Record<string, { slug: string; title: string }[]> = {}) {
  const log: Logged[] = []
  const readable = (b: SBoard | undefined) => !!b && b.publishedDoc !== null && (b.visibility === 'public' || b.visibility === 'unlisted')
  const byId = (id: string) => boards.find((b) => b.id === id)

  const route = (url: URL, body: Record<string, string>): { status: number; json: unknown } => {
    const name = /\/rest\/v1\/rpc\/(\w+)/.exec(url.pathname)?.[1]
    if (name === 'get_published_board') {
      const b = boards.find((x) => x.slug === body.p_slug)
      return {
        status: 200,
        json: readable(b) && b ? [{ id: b.id, owner_id: '00000000-0000-4000-8000-0000000000f0', slug: b.slug, title: b.publishedTitle, visibility: b.visibility, published_revision: 1, published_doc: b.publishedDoc }] : [],
      }
    }
    if (name === 'get_board_links') {
      const rows = (links[body.p_board_id ?? ''] ?? []).map((l) => {
        const t = byId(l.to)
        const ok = readable(t)
        return { id: l.id, from_widget_id: l.widget, to_board_id: l.to, label: null, pinned_revision: null, to_title: ok && t ? t.publishedTitle : null, to_slug: ok && t ? t.slug : null }
      })
      return { status: 200, json: rows }
    }
    if (name === 'get_backlinks') return { status: 200, json: backlinks[body.p_board_id ?? ''] ?? [] }
    return { status: 404, json: { message: `unexpected ${url.pathname}` } }
  }

  const fetchFn: typeof fetch = async (input, init) => {
    const req = new Request(input, init)
    const url = new URL(req.url)
    const text = await req.text()
    const { status, json } = route(url, text ? (JSON.parse(text) as Record<string, string>) : {})
    const response = JSON.stringify(json)
    log.push({ method: req.method, url: req.url, body: text, response })
    return new Response(response, { status, headers: { 'content-type': 'application/json' } })
  }
  const client: SupabaseClient = createClient('http://supa.test', 'anon-key', {
    global: { fetch: fetchFn },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { client, log }
}
