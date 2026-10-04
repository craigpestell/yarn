import { LIMITS, type Doc, type Edge, type Source, type Widget } from '../../shared/schema'
import type { Claim, Entity, ImageCandidate } from './types'

export interface BuildInput {
  entities: Entity[]
  claims: Claim[]
  images: ImageCandidate[]
  /** Unique id source (nanoid in production, a counter in tests). */
  newId: () => string
}

type Status = NonNullable<Widget['status']>
const SEVERITY: Status[] = ['verified', 'claim', 'speculation', 'disputed']
const worst = (claims: Claim[]): Status => claims.reduce<Status>((a, c) => (SEVERITY.indexOf(c.status) > SEVERITY.indexOf(a) ? c.status : a), 'verified')

/** The schema has no notes field, so the review flag is the first line of the wanted poster's description. */
export const REVIEW_NOTE = 'DRAFT: needs human review before publishing.'
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)
const SIZE = { photo: [200, 240], note: [200, 200], wanted: [220, 300], paper: [250, 280] } as const
const COLS = 4
const CELL = { x: 320, y: 400 }

const dedupeSources = (sources: Source[]): Source[] => {
  const seen = new Set<string>()
  return sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, LIMITS.sources)
}

/**
 * Deterministic board builder. Every widget is grounded: entities without a claim are dropped,
 * widget sources are exactly the sources of its claims (plus its image's licence record), and
 * an edge exists only where a claim about one entity names the other. Positions are a plain grid;
 * autoOrganize lays the board out afterwards.
 */
export function buildDoc(input: BuildInput): Doc {
  const byEntity = new Map<string, Claim[]>()
  for (const c of input.claims) byEntity.set(c.entity, [...(byEntity.get(c.entity) ?? []), c])
  const imageOf = new Map<string, ImageCandidate>()
  for (const im of input.images) if (!imageOf.has(im.entity)) imageOf.set(im.entity, im)

  const widgets: Widget[] = []
  const idOf = new Map<string, string>()
  for (const entity of input.entities) {
    const claims = byEntity.get(entity.name)
    if (!claims?.length) continue
    const image = imageOf.get(entity.name)
    const id = input.newId()
    idOf.set(entity.name, id)
    const n = widgets.length
    const sources = dedupeSources([...claims.flatMap((c) => [c.source, ...c.corroborating]), ...(image ? [image.source] : [])])
    const lines = claims.map((c) => `[${c.status}] ${c.text}`)
    const pos = { x: (n % COLS) * CELL.x, y: Math.floor(n / COLS) * CELL.y, rotation: 0, sources, status: worst(claims) }
    const common = (type: keyof typeof SIZE) => ({ id, ...pos, w: SIZE[type][0], h: SIZE[type][1] })
    if (entity.kind === 'person_of_interest') {
      widgets.push({
        ...common('wanted'), type: 'wanted',
        data: {
          name: clip(entity.name, LIMITS.short), alias: '', crime: 'Named in public records',
          description: clip(`${REVIEW_NOTE}\n${lines.join('\n')}`, LIMITS.description), reward: '',
          ...(image ? { image: image.url } : {}),
        },
      })
    } else if (image) {
      widgets.push({
        ...common('photo'), type: 'photo',
        data: { title: clip(entity.name, LIMITS.photoTitle), caption: clip(lines.join('\n'), LIMITS.caption), image: image.url },
      })
    } else if (entity.kind === 'document') {
      widgets.push({
        ...common('paper'), type: 'paper',
        data: { content: clip(`${entity.name}\n\n${lines.join('\n')}`, LIMITS.paperContent) },
      })
    } else {
      widgets.push({
        ...common('note'), type: 'note',
        data: { text: clip(`${entity.name}\n${lines.join('\n')}`, LIMITS.noteText), color: '#fef08a' },
      })
    }
  }

  const edges: Edge[] = []
  const pairs = new Set<string>()
  for (const c of input.claims) {
    const a = idOf.get(c.entity)
    for (const rel of c.relatedEntities) {
      const b = idOf.get(rel)
      if (!a || !b || a === b) continue
      const key = [a, b].sort().join('\u0000')
      if (pairs.has(key)) continue
      pairs.add(key)
      edges.push({ id: input.newId(), source: a, target: b, color: '#e53e3e' })
    }
  }
  return { version: 1, widgets, edges }
}
