import { z } from 'zod'

export const WIDGET_TYPES = ['photo', 'note', 'wanted', 'paper'] as const
export type WidgetType = (typeof WIDGET_TYPES)[number]

/** Upper bounds shared by the schema, convertV1 and (loosely) the SQL checks. */
export const LIMITS = {
  widgets: 500,
  edges: 2000,
  sources: 20,
  strokes: 500,
  strokeBytes: 100_000,
  id: 100,
  url: 2048,
  short: 200,
  photoTitle: 50,
  caption: 2000,
  noteText: 5000,
  paperContent: 20000,
  description: 2000,
  maxSize: 5000,
  maxCoord: 1_000_000,
} as const

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
/** Supabase Storage object path: `bucket/seg/seg`, no leading slash, no `.`/`..` segments. */
export const STORAGE_PATH_RE = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/

const Color = z.string().regex(HEX_COLOR)
const text = (max: number) => z.string().max(max).default('')

/** http(s) only: rejects javascript:, data:, file:, etc. */
export const SourceUrlSchema = z.url({ protocol: /^https?$/ }).max(LIMITS.url)
/** Image reference: an https URL or a Storage path. */
export const ImageRefSchema = z.union([
  z.url({ protocol: /^https$/ }).max(LIMITS.url),
  z.string().max(512).regex(STORAGE_PATH_RE),
])

export const SourceSchema = z.object({
  url: SourceUrlSchema,
  title: z.string().max(300).optional(),
  retrievedAt: z.iso.datetime({ offset: true }),
  license: z.string().max(300).optional(),
  attribution: z.string().max(300).optional(),
})
export type Source = z.infer<typeof SourceSchema>

const Coord = z.number().finite().min(-LIMITS.maxCoord).max(LIMITS.maxCoord)
const Size = z.number().finite().positive().max(LIMITS.maxSize)
/**
 * Freehand strokes: the shape is owned by the (not yet built) editor, so it is deliberately opaque here.
 * Bounded unknown: any JSON value is accepted as long as its serialised size stays under the cap, so a
 * later editor's stroke format is never rejected on read.
 */
export const StrokeSchema = z.unknown().superRefine((v, ctx) => {
  let size = Infinity
  try {
    size = JSON.stringify(v)?.length ?? 0
  } catch {
    // circular or otherwise unserialisable
  }
  if (size > LIMITS.strokeBytes) ctx.addIssue({ code: 'custom', message: 'stroke too large' })
})

const base = {
  id: z.string().min(1).max(LIMITS.id),
  x: Coord,
  y: Coord,
  w: Size,
  h: Size,
  rotation: z.number().finite().min(-360).max(360).default(0),
  sources: z.array(SourceSchema).max(LIMITS.sources).default([]),
  status: z.enum(['claim', 'disputed', 'verified', 'speculation']).optional(),
  strokes: z.array(StrokeSchema).max(LIMITS.strokes).optional(),
  locked: z.boolean().optional(),
}

export const PhotoWidgetSchema = z.object({
  ...base,
  type: z.literal('photo'),
  data: z.object({
    title: text(LIMITS.photoTitle),
    caption: text(LIMITS.caption),
    image: ImageRefSchema.optional(),
  }),
})
export const NoteWidgetSchema = z.object({
  ...base,
  type: z.literal('note'),
  data: z.object({ text: text(LIMITS.noteText), color: Color.default('#fef08a') }),
})
export const WantedWidgetSchema = z.object({
  ...base,
  type: z.literal('wanted'),
  data: z.object({
    name: text(LIMITS.short),
    alias: text(LIMITS.short),
    crime: text(LIMITS.short),
    description: text(LIMITS.description),
    reward: text(LIMITS.short),
    image: ImageRefSchema.optional(),
  }),
})
export const PaperWidgetSchema = z.object({
  ...base,
  type: z.literal('paper'),
  data: z.object({ content: text(LIMITS.paperContent) }),
})

export const WidgetSchema = z.discriminatedUnion('type', [
  PhotoWidgetSchema,
  NoteWidgetSchema,
  WantedWidgetSchema,
  PaperWidgetSchema,
])
export type Widget = z.infer<typeof WidgetSchema>

export const EdgeSchema = z.object({
  id: z.string().min(1).max(LIMITS.id),
  source: z.string().min(1).max(LIMITS.id),
  target: z.string().min(1).max(LIMITS.id),
  color: Color.default('#e53e3e'),
})
export type Edge = z.infer<typeof EdgeSchema>

export const DocSchema = z
  .object({
    version: z.literal(1),
    widgets: z.array(WidgetSchema).max(LIMITS.widgets),
    edges: z.array(EdgeSchema).max(LIMITS.edges),
  })
  .superRefine((doc, ctx) => {
    const widgetIds = new Set<string>()
    const allIds = new Set<string>()
    doc.widgets.forEach((w, i) => {
      if (allIds.has(w.id)) {
        ctx.addIssue({ code: 'custom', path: ['widgets', i, 'id'], message: `duplicate id ${w.id}` })
      }
      allIds.add(w.id)
      widgetIds.add(w.id)
    })
    const pairs = new Set<string>()
    doc.edges.forEach((e, i) => {
      if (allIds.has(e.id)) {
        ctx.addIssue({ code: 'custom', path: ['edges', i, 'id'], message: `duplicate id ${e.id}` })
      }
      allIds.add(e.id)
      for (const end of ['source', 'target'] as const) {
        if (!widgetIds.has(e[end])) {
          ctx.addIssue({ code: 'custom', path: ['edges', i, end], message: `dangling ${end} ${e[end]}` })
        }
      }
      if (e.source === e.target) {
        ctx.addIssue({ code: 'custom', path: ['edges', i], message: 'self-edge' })
        return
      }
      const key = [e.source, e.target].sort().join('\u0000')
      if (pairs.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['edges', i], message: 'duplicate edge pair' })
      }
      pairs.add(key)
    })
  })
export type Doc = z.infer<typeof DocSchema>
