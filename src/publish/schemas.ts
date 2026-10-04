import { z } from 'zod'
import { VisibilitySchema } from '../boards/schemas'

export const PublishStateSchema = z.object({
  visibility: VisibilitySchema,
  revision: z.number().int(),
  published_revision: z.number().int().nullable(),
  show_backlinks: z.boolean(),
})
export type PublishState = z.infer<typeof PublishStateSchema>
export const PUBLISH_STATE_COLUMNS = 'visibility, revision, published_revision, show_backlinks'

export const ShareSchema = z.object({ email: z.string() })
export type Share = z.infer<typeof ShareSchema>

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))
