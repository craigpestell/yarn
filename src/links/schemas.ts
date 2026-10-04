import { z } from 'zod'

/** Same rule as the DB slug check (lowercase url-safe, 3-80 chars, no `--`). */
export const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/).refine((s) => !s.includes('--'))

/** One row of get_board_links. A null to_title / to_slug means "unavailable": the server never sends the title then. */
export const LinkRowSchema = z.object({
  id: z.uuid(),
  from_widget_id: z.string().nullable(),
  to_board_id: z.uuid(),
  label: z.string().nullable(),
  pinned_revision: z.number().int().nullable(),
  to_title: z.string().nullable(),
  to_slug: SlugSchema.nullable(),
})

export const BacklinkSchema = z.object({ slug: SlugSchema, title: z.string() })
export type Backlink = z.infer<typeof BacklinkSchema>

export const ResolvedBoardSchema = z.object({ id: z.uuid(), slug: SlugSchema, title: z.string() })
export type ResolvedBoard = z.infer<typeof ResolvedBoardSchema>

/** What a widget needs to draw its link: a readable target, or null fields for "unavailable". */
export interface LinkView {
  linkId: string
  widgetId: string
  toBoardId: string
  title: string | null
  slug: string | null
}
