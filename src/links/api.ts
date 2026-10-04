import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { BacklinkSchema, LinkRowSchema, ResolvedBoardSchema, SlugSchema, type Backlink, type LinkView, type ResolvedBoard } from './schemas'

export class LinksError extends Error {}

/** Extract a board slug from a pasted `/b/<slug>` URL or path. Returns null for anything else. */
export function parseBoardUrl(text: string): string | null {
  const raw = text.trim()
  if (!raw || raw.length > 2048) return null
  let path: string
  try {
    path = raw.startsWith('/') ? new URL(raw, 'https://x.invalid').pathname : new URL(raw).pathname
  } catch {
    return null
  }
  if (!/^https?:|^\//i.test(raw)) return null
  const m = /^\/b\/([^/]+)\/?$/.exec(path)
  const slug = SlugSchema.safeParse(m?.[1])
  return slug.success ? slug.data : null
}

/** Live links of a board (owner) or the published ones (everyone else), keyed per widget; the first link wins. */
export async function fetchLinks(client: SupabaseClient, boardId: string): Promise<Map<string, LinkView>> {
  const { data, error } = await client.rpc('get_board_links', { p_board_id: boardId })
  if (error) throw new LinksError(`Could not load links: ${error.message}`)
  const rows = z.array(LinkRowSchema).safeParse(data)
  if (!rows.success) throw new LinksError('Could not load links: unexpected data')
  const out = new Map<string, LinkView>()
  for (const r of rows.data) {
    if (r.from_widget_id === null || out.has(r.from_widget_id)) continue
    const readable = r.to_title !== null && r.to_slug !== null
    out.set(r.from_widget_id, {
      linkId: r.id,
      widgetId: r.from_widget_id,
      toBoardId: r.to_board_id,
      title: readable ? r.to_title : null,
      slug: readable ? r.to_slug : null,
    })
  }
  return out
}

export async function fetchBacklinks(client: SupabaseClient, boardId: string): Promise<Backlink[]> {
  const { data, error } = await client.rpc('get_backlinks', { p_board_id: boardId })
  if (error) throw new LinksError(`Could not load backlinks: ${error.message}`)
  const rows = z.array(BacklinkSchema).safeParse(data)
  if (!rows.success) throw new LinksError('Could not load backlinks: unexpected data')
  return rows.data
}

/** Resolve a slug to a board the caller can read; null when it is unknown or not readable. */
export async function resolveBoard(client: SupabaseClient, slug: string): Promise<ResolvedBoard | null> {
  const { data, error } = await client.rpc('resolve_board', { p_slug: slug })
  if (error) throw new LinksError(`Could not look up the board: ${error.message}`)
  const rows = z.array(ResolvedBoardSchema).safeParse(data)
  if (!rows.success) throw new LinksError('Could not look up the board: unexpected data')
  return rows.data[0] ?? null
}

export async function setWidgetLink(client: SupabaseClient, boardId: string, widgetId: string, toBoardId: string): Promise<void> {
  const { data, error } = await client.rpc('set_widget_link', { p_board_id: boardId, p_widget_id: widgetId, p_to_board_id: toBoardId })
  if (error) throw new LinksError(`Could not set the link: ${error.message}`)
  if (!z.uuid().safeParse(data).success) throw new LinksError('Could not set the link: you cannot link to that board')
}

export async function clearWidgetLink(client: SupabaseClient, boardId: string, widgetId: string): Promise<void> {
  const { error } = await client.from('board_links').delete().eq('from_board_id', boardId).eq('from_widget_id', widgetId)
  if (error) throw new LinksError(`Could not clear the link: ${error.message}`)
}
