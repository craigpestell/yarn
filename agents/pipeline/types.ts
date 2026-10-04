import { z } from 'zod'
import { SourceSchema, SourceUrlSchema, WidgetSchema } from '../../shared/schema'

const name = z.string().min(1).max(100)
const text = (n: number) => z.string().min(1).max(n)

export const ENTITY_KINDS = ['person', 'person_of_interest', 'place', 'event', 'object', 'document'] as const

export const ScoutResultSchema = z.object({
  subtopics: z.array(z.object({ name, summary: text(500) })).min(1).max(6),
  entities: z.array(z.object({ name, kind: z.enum(ENTITY_KINDS), summary: text(500) })).min(1).max(12),
})
export type ScoutResult = z.infer<typeof ScoutResultSchema>
export type Entity = ScoutResult['entities'][number]

/** What the researcher model returns. retrievedAt is stamped by code, not trusted from the model. */
export const ResearchReplySchema = z.object({
  facts: z
    .array(
      z.object({
        entity: name,
        text: text(500),
        source: z.object({ url: SourceUrlSchema, title: z.string().max(300).optional() }),
        /** Independent sources that back the same fact (used to cap `confirmed`). */
        corroborating: z.array(z.object({ url: SourceUrlSchema, title: z.string().max(300).optional() })).max(3).default([]),
        relatedEntities: z.array(name).max(5).default([]),
      }),
    )
    .max(60),
  images: z
    .array(
      z.object({
        entity: name,
        /** Direct file URL (upload.wikimedia.org). */
        url: z.url({ protocol: /^https$/ }).max(2048),
        /** The Commons file page, which carries the licence. */
        pageUrl: SourceUrlSchema,
        license: text(300),
        attribution: text(300),
      }),
    )
    .max(20)
    .default([]),
})
export type ResearchReply = z.infer<typeof ResearchReplySchema>

export const FactSchema = z.object({
  id: z.string().min(1),
  entity: name,
  text: text(500),
  source: SourceSchema,
  corroborating: z.array(SourceSchema).default([]),
  relatedEntities: z.array(name),
})
export type Fact = z.infer<typeof FactSchema>

export const ImageCandidateSchema = z.object({
  entity: name,
  url: z.url({ protocol: /^https$/ }).max(2048),
  source: SourceSchema,
})
export type ImageCandidate = z.infer<typeof ImageCandidateSchema>

export interface Research {
  facts: Fact[]
  images: ImageCandidate[]
}

export const CLAIM_VERDICTS = ['confirmed', 'alleged', 'disputed', 'speculative'] as const
export const ClassifierReplySchema = z.object({
  verdicts: z.array(z.object({ factId: z.string(), verdict: z.enum(CLAIM_VERDICTS), rationale: z.string().max(300).default('') })),
})

/** Verdict vocabulary -> the status enum in shared/schema.ts. */
export const STATUS_FOR_VERDICT = {
  confirmed: 'verified',
  alleged: 'claim',
  disputed: 'disputed',
  speculative: 'speculation',
} as const

export const ClaimSchema = FactSchema.extend({ status: WidgetSchema.options[0].shape.status.unwrap() })
export type Claim = z.infer<typeof ClaimSchema>
