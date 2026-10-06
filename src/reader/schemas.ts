import { z } from 'zod'
import { DocSchema } from '../../shared/schema'
import { VisibilitySchema } from '../boards/schemas'
import { SlugSchema } from '../links/schemas'

/** A row of get_published_board: only published data, never `doc`. Title is the published title for non-owners. */
export const PublishedRowSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  slug: SlugSchema,
  title: z.string(),
  visibility: VisibilitySchema,
  published_revision: z.number().int().nullable(),
  published_doc: DocSchema.nullable(),
})

/** The owner's own row looked up by slug (owner-only RLS): the live doc. */
export const OwnRowSchema = z.object({
  id: z.uuid(),
  slug: SlugSchema,
  title: z.string(),
  deleted_at: z.string().nullable(),
  doc: DocSchema,
})

export interface ReaderBoard {
  id: string
  slug: string
  title: string
  doc: z.infer<typeof DocSchema>
  isOwner: boolean
}

/** get_fork_source: no row = not a fork; null slug and title = the source is not readable by the caller (never a title leak). */
export const ForkSourceRowSchema = z.object({ source_slug: SlugSchema.nullable(), source_title: z.string().nullable() })

export type ForkSource = { kind: 'unavailable' } | { kind: 'available'; slug: string; title: string }
