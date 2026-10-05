import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { PublicBoardSchema, type PublicBoard } from './schemas'

export class ExploreError extends Error {}

export const EXPLORE_PAGE_SIZE = 24

export interface ExplorePage {
  items: PublicBoard[]
  hasMore: boolean
}

/** One page of public boards, newest first. `after` is the last item of the previous page. */
export async function listPublicBoards(client: SupabaseClient, after?: PublicBoard): Promise<ExplorePage> {
  // Ask for one extra row to know whether another page exists.
  const { data, error } = await client.rpc('list_public_boards', {
    p_before_at: after?.published_at ?? null,
    p_before_id: after?.id ?? null,
    p_limit: EXPLORE_PAGE_SIZE + 1,
  })
  if (error) throw new ExploreError(`Could not load boards: ${error.message}`)
  const parsed = z.array(PublicBoardSchema).safeParse(data)
  if (!parsed.success) throw new ExploreError('The server returned data in an unexpected format')
  return { items: parsed.data.slice(0, EXPLORE_PAGE_SIZE), hasMore: parsed.data.length > EXPLORE_PAGE_SIZE }
}
