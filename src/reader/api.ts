import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ForkSourceRowSchema, OwnRowSchema, PublishedRowSchema, type ForkSource, type ReaderBoard } from './schemas'

export class ReaderError extends Error {}

/**
 * Load a board for /b/:slug. The owner gets their live `doc` (owner-only RLS select); everyone else gets
 * `published_doc` through get_published_board, never `doc`. Returns null for private/unknown/unshared boards
 * alike, so the page cannot tell them apart.
 */
export async function loadReaderBoard(client: SupabaseClient, slug: string, signedIn: boolean): Promise<ReaderBoard | null> {
  if (signedIn) {
    const own = await client.from('boards').select('id, slug, title, deleted_at, doc').eq('slug', slug).maybeSingle()
    if (own.error) throw new ReaderError(`Could not load the board: ${own.error.message}`)
    if (own.data) {
      const row = OwnRowSchema.safeParse(own.data)
      if (!row.success) throw new ReaderError('This board could not be loaded because its data is invalid.')
      if (row.data.deleted_at === null) return { id: row.data.id, slug: row.data.slug, title: row.data.title, doc: row.data.doc, isOwner: true }
      return null
    }
  }
  const { data, error } = await client.rpc('get_published_board', { p_slug: slug })
  if (error) throw new ReaderError(`Could not load the board: ${error.message}`)
  const rows = z.array(PublishedRowSchema).safeParse(data)
  if (!rows.success) throw new ReaderError('This board could not be loaded because its data is invalid.')
  const row = rows.data[0]
  if (!row || row.published_doc === null) return null
  return { id: row.id, slug: row.slug, title: row.title, doc: row.published_doc, isOwner: false }
}

/** Provenance of a fork: null when the board is not a fork. Unreadable sources come back without a title. */
export async function fetchForkSource(client: SupabaseClient, boardId: string): Promise<ForkSource | null> {
  const { data, error } = await client.rpc('get_fork_source', { p_board_id: boardId })
  if (error) throw new ReaderError(`Could not load the fork source: ${error.message}`)
  const rows = z.array(ForkSourceRowSchema).safeParse(data)
  if (!rows.success) throw new ReaderError('Could not load the fork source: unexpected data')
  const row = rows.data[0]
  if (!row) return null
  return row.source_slug !== null && row.source_title !== null
    ? { kind: 'available', slug: row.source_slug, title: row.source_title }
    : { kind: 'unavailable' }
}
