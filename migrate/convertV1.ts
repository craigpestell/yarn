import { z } from 'zod'
import {
  DocSchema,
  ImageRefSchema,
  LIMITS,
  SourceUrlSchema,
  type Doc,
  type Widget,
} from '../shared/schema'

const Str = z.string().default('')
const Hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
const Pos = { x: z.number(), y: z.number(), rotation: z.number().default(0) }

/** Loose v1 shape: only what we map. Drawings, groupId/groupIndex, charlieImage are ignored. */
export const V1BoardSchema = z.object({
  timestamp: z.string().optional(),
  photos: z.array(z.object({ id: z.string(), url: Str, title: Str, notes: Str, imageUrl: Str, ...Pos })).default([]),
  notes: z.array(z.object({ id: z.string(), text: Str, color: z.string().default('#fef08a'), ...Pos })).default([]),
  wantedPosters: z
    .array(z.object({ id: z.string(), name: Str, alias: Str, crime: Str, description: Str, reward: Str, imageUrl: Str, ...Pos }))
    .default([]),
  papers: z.array(z.object({ id: z.string(), content: Str, ...Pos })).default([]),
  connections: z.array(z.object({ id: z.string(), fromItemId: z.string(), toItemId: z.string(), color: z.string().default('#e53e3e') })).default([]),
})

export const SIZES = {
  photo: { w: 200, h: 240 },
  note: { w: 200, h: 200 },
  wanted: { w: 220, h: 300 },
  paper: { w: 250, h: 200 },
} as const

export interface ConvertOptions {
  /** Conversion time (ISO, e.g. `new Date().toISOString()` from the caller). Used when the v1 board has no valid timestamp. */
  now: string
  /** ISO date stamped on sources; overrides the board timestamp and `now`. */
  retrievedAt?: string
}

const IsoDate = z.iso.datetime()

/** Truncate to `max` UTF-16 units without leaving a dangling high surrogate. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

const color = (c: string, fallback: string) => (Hex.safeParse(c).success ? c : fallback)
const rotation = (r: number) => (r >= -360 && r <= 360 ? r : r % 360)
const image = (u: string) => (u && ImageRefSchema.safeParse(u).success ? u : undefined)

export type DropReason = 'dangling' | 'self' | 'duplicate' | 'bad-id'
export interface DroppedEdge {
  id: string
  source: string
  target: string
  reason: DropReason
}

/**
 * Pure; throws a ZodError if the input is malformed or the result violates DocSchema (e.g. duplicate widget ids).
 * Invalid connections are dropped, see convertV1Detailed.
 * Widget order is deterministic: photos, notes, wanted, papers, each in v1 array order
 * (v1 has no cross-type z-index), so later widgets render on top.
 * Unusable optional v1 data (non-http(s) `url`, non-https `imageUrl`, bad colors) is dropped,
 * not fatal; over-long strings are truncated to the v2 limits.
 */
export function convertV1(input: unknown, opts: ConvertOptions): Doc {
  return convertV1Detailed(input, opts).doc
}

/**
 * Like convertV1, but also reports the invalid connections that were dropped instead of
 * aborting: dangling endpoints, self-edges, duplicate unordered pairs (first wins) and
 * bad ids (empty/over-long, or colliding with a widget id or an earlier edge id).
 */
export function convertV1Detailed(input: unknown, opts: ConvertOptions): { doc: Doc; dropped: DroppedEdge[] } {
  const now = IsoDate.parse(opts.now)
  const v1 = V1BoardSchema.parse(input)
  const retrievedAt =
    opts.retrievedAt ?? (v1.timestamp && IsoDate.safeParse(v1.timestamp).success ? v1.timestamp : now)
  IsoDate.parse(retrievedAt)
  const widgets: Widget[] = []

  for (const p of v1.photos) {
    const title = clip(p.title, LIMITS.photoTitle)
    widgets.push({
      id: p.id, type: 'photo', x: p.x, y: p.y, ...SIZES.photo, rotation: rotation(p.rotation),
      sources: p.url && SourceUrlSchema.safeParse(p.url).success
        ? [{ url: p.url, title: title ? clip(p.title, 300) : undefined, retrievedAt }]
        : [],
      data: { title, caption: clip(p.notes, LIMITS.caption), image: image(p.imageUrl) },
    })
  }
  for (const n of v1.notes) {
    widgets.push({
      id: n.id, type: 'note', x: n.x, y: n.y, ...SIZES.note, rotation: rotation(n.rotation), sources: [],
      data: { text: clip(n.text, LIMITS.noteText), color: color(n.color, '#fef08a') },
    })
  }
  for (const p of v1.wantedPosters) {
    widgets.push({
      id: p.id, type: 'wanted', x: p.x, y: p.y, ...SIZES.wanted, rotation: rotation(p.rotation), sources: [],
      data: {
        name: clip(p.name, LIMITS.short), alias: clip(p.alias, LIMITS.short), crime: clip(p.crime, LIMITS.short),
        description: clip(p.description, LIMITS.description), reward: clip(p.reward, LIMITS.short), image: image(p.imageUrl),
      },
    })
  }
  for (const p of v1.papers) {
    widgets.push({
      id: p.id, type: 'paper', x: p.x, y: p.y, ...SIZES.paper, rotation: rotation(p.rotation), sources: [],
      data: { content: clip(p.content, LIMITS.paperContent) },
    })
  }

  const widgetIds = new Set(widgets.map((w) => w.id))
  const usedIds = new Set(widgetIds)
  const pairs = new Set<string>()
  const edges: Doc['edges'] = []
  const dropped: DroppedEdge[] = []
  const okId = (s: string) => s.length >= 1 && s.length <= LIMITS.id
  for (const c of v1.connections) {
    const drop = (reason: DropReason) => dropped.push({ id: c.id, source: c.fromItemId, target: c.toItemId, reason })
    const pair = [c.fromItemId, c.toItemId].sort().join('\u0000')
    if (!okId(c.id) || !okId(c.fromItemId) || !okId(c.toItemId) || usedIds.has(c.id)) drop('bad-id')
    else if (!widgetIds.has(c.fromItemId) || !widgetIds.has(c.toItemId)) drop('dangling')
    else if (c.fromItemId === c.toItemId) drop('self')
    else if (pairs.has(pair)) drop('duplicate')
    else {
      usedIds.add(c.id)
      pairs.add(pair)
      edges.push({ id: c.id, source: c.fromItemId, target: c.toItemId, color: color(c.color, '#e53e3e') })
    }
  }

  return { doc: DocSchema.parse({ version: 1, widgets, edges }), dropped }
}
