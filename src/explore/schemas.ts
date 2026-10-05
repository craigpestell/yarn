import { z } from 'zod'
import { SlugSchema } from '../links/schemas'

/** One row of list_public_boards. The RPC never returns the doc, published_doc or a bare owner id. */
export const PublicBoardSchema = z.object({
  slug: SlugSchema,
  published_title: z.string(),
  published_at: z.string().min(1),
  id: z.uuid(),
  thumbnail_path: z.string().min(1),
})
export type PublicBoard = z.infer<typeof PublicBoardSchema>
