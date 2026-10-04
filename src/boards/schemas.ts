import { z } from 'zod'
import { DocSchema } from '../../shared/schema'

export const VisibilitySchema = z.enum(['private', 'unlisted', 'public'])
export type Visibility = z.infer<typeof VisibilitySchema>

/** Grid row: everything except the (large) doc. */
export const BoardSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  visibility: VisibilitySchema,
  revision: z.number().int(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
})
export type BoardSummary = z.infer<typeof BoardSummarySchema>
export const BOARD_SUMMARY_COLUMNS = 'id, slug, title, visibility, revision, updated_at, deleted_at'

export const BoardFullSchema = BoardSummarySchema.extend({ doc: DocSchema })
export type BoardFull = z.infer<typeof BoardFullSchema>
export const BOARD_FULL_COLUMNS = `${BOARD_SUMMARY_COLUMNS}, doc`

/** save_board returns the new revision, or null when the revision is stale / not owned / deleted. */
export const SaveResultSchema = z.number().int().nullable()
