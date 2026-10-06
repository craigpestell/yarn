import type { SupabaseClient } from '@supabase/supabase-js'
import { ForkResultSchema } from './schemas'

/** Shown for every failure: the server answers the same for unreadable, missing and rate-limited, so the UI must too. */
export const FORK_FAILED = 'Could not fork this board. It may no longer be available, or you have forked too many boards recently. Try again later.'

export class ForkError extends Error {
  constructor() {
    super(FORK_FAILED)
  }
}

/** Create a private copy of a readable, published board (server side: published snapshot only). */
export async function forkBoard(client: SupabaseClient, sourceId: string): Promise<{ id: string; slug: string }> {
  const { data, error } = await client.rpc('fork_board', { p_source_id: sourceId })
  if (error) throw new ForkError()
  const rows = ForkResultSchema.safeParse(data)
  if (!rows.success) throw new ForkError()
  return { id: rows.data[0].new_id, slug: rows.data[0].new_slug }
}
