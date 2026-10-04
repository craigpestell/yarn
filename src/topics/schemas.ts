import { z } from 'zod'
import { SlugSchema } from '../links/schemas'

export const TopicSchema = z.object({
  slug: z.string().min(1).max(100),
  title: z.string(),
  summary: z.string().nullable(),
  tags: z.array(z.string()),
})
export type Topic = z.infer<typeof TopicSchema>
export const TOPIC_COLUMNS = 'slug, title, summary, tags'

export const TopicBoardSchema = z.object({ slug: SlugSchema, title: z.string() })
export type TopicBoard = z.infer<typeof TopicBoardSchema>
