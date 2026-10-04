import type { SupabaseClient } from '@supabase/supabase-js'
import { makeSlug } from '../../src/boards/slug'
import { DocSchema, type Doc } from '../../shared/schema'

export interface DraftRow {
  owner_id: string
  slug: string
  title: string
  doc: Doc
  visibility: 'private'
}
export type InsertResult = { id: string; slug: string } | { error: { code?: string; message: string } }

/** Narrow storage port so the writer is testable with a fake. */
export interface DraftStore {
  insertBoard(row: DraftRow): Promise<InsertResult>
}

export function supabaseDraftStore(client: SupabaseClient): DraftStore {
  return {
    async insertBoard(row) {
      const { data, error } = await client.from('boards').insert(row).select('id, slug').single<{ id: string; slug: string }>()
      if (error || !data) return { error: { code: error?.code, message: error?.message ?? 'no row returned' } }
      return data
    },
  }
}

export interface WriteDraftInput {
  curatorId: string
  title: string
  doc: unknown
  /** Slug suffix source; injectable for tests. */
  rand?: () => string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Insert the board as the curator, always private (a DRAFT). Re-validates the doc with the shared
 * schema, uses the app's slug rules, and retries once with a fresh slug on a unique violation.
 */
export async function writeDraft(store: DraftStore, input: WriteDraftInput): Promise<{ id: string; slug: string }> {
  if (!UUID_RE.test(input.curatorId)) throw new Error('CURATOR_USER_ID is not a uuid')
  const doc = DocSchema.parse(input.doc)
  const title = input.title.trim().slice(0, 200)
  if (!title) throw new Error('title is required')
  let last = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await store.insertBoard({
      owner_id: input.curatorId,
      slug: makeSlug(title, input.rand),
      title,
      doc,
      visibility: 'private',
    })
    if ('id' in res) return res
    last = res.error.message
    if (res.error.code !== '23505') break
  }
  throw new Error(`could not write draft board: ${last}`)
}
