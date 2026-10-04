import type { SupabaseClient } from '@supabase/supabase-js'
import type { Doc } from '../../shared/schema'
import { BoardFullSchema, SaveResultSchema } from './schemas'

export type SaveOutcome =
  | { kind: 'saved'; revision: number }
  /** The server revision no longer matches (another tab/device saved, or the board was deleted). Nothing was written. */
  | { kind: 'conflict' }
  /** There is no valid session, so the server ignored the save. Not a conflict: log in again. */
  | { kind: 'unauthenticated' }
  /** Transport failure: worth retrying. The server may or may not have applied the write. */
  | { kind: 'offline'; message: string }
  /** The server refused the save (e.g. validation, auth); retrying the same payload will not help. */
  | { kind: 'rejected'; message: string }

export interface SavePayload {
  id: string
  expectedRevision: number
  /** null leaves the stored title untouched. */
  title: string | null
  doc: Doc
}

export type SaveFn = (p: SavePayload) => Promise<SaveOutcome>

/** After an uncertain (lost-response) attempt: did our own write land? */
export type ReconcileOutcome = { kind: 'applied'; revision: number } | { kind: 'conflict' } | { kind: 'offline'; message: string }
export type ReconcileFn = (p: SavePayload) => Promise<ReconcileOutcome>

/** Calls the revision-checked save_board RPC. Never throws. */
export function createSaveFn(client: SupabaseClient): SaveFn {
  return async (p) => {
    try {
      const { data, error } = await client.rpc('save_board', {
        p_id: p.id,
        p_expected_revision: p.expectedRevision,
        p_doc: p.doc,
        p_title: p.title,
      })
      if (error) {
        // Network failures surface as errors without a Postgres/PostgREST code.
        return error.code ? { kind: 'rejected', message: error.message } : { kind: 'offline', message: error.message }
      }
      const parsed = SaveResultSchema.safeParse(data)
      if (!parsed.success) return { kind: 'rejected', message: 'Unexpected response from the server' }
      if (parsed.data !== null) return { kind: 'saved', revision: parsed.data }
      // null = stale revision, not the owner, deleted, or no session at all. Tell the session case apart.
      const { data: s } = await client.auth.getSession()
      return s.session ? { kind: 'conflict' } : { kind: 'unauthenticated' }
    } catch (e) {
      return { kind: 'offline', message: e instanceof Error ? e.message : 'Network error' }
    }
  }
}

/** JSON round-trip: drops undefined-valued keys, as the database copy never has them. */
const normalize = (v: unknown): unknown => JSON.parse(JSON.stringify(v)) as unknown

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/**
 * Re-reads the board after a lost response. If the server revision advanced past ours and its doc equals what we
 * tried to save (and title, when we sent one), our own write landed: treat as saved, not as a conflict.
 */
export function createReconcileFn(client: SupabaseClient): ReconcileFn {
  return async (p) => {
    try {
      const { data, error } = await client
        .from('boards')
        .select('id, slug, title, visibility, revision, updated_at, deleted_at, doc')
        .eq('id', p.id)
        .maybeSingle()
      if (error) return { kind: 'offline', message: error.message }
      const row = BoardFullSchema.safeParse(data)
      if (!row.success) return { kind: 'conflict' }
      const b = row.data
      const ours = b.revision > p.expectedRevision && deepEqual(normalize(b.doc), normalize(p.doc)) && (p.title === null || b.title === p.title)
      return ours ? { kind: 'applied', revision: b.revision } : { kind: 'conflict' }
    } catch (e) {
      return { kind: 'offline', message: e instanceof Error ? e.message : 'Network error' }
    }
  }
}
