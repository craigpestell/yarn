import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { overlaps, countCrossings, type Box } from '../layout/score'
import type { Doc } from '../shared/schema'

const PRIVATE_DIR = new URL('./fixtures/private/', import.meta.url)
const privateFile = existsSync(PRIVATE_DIR) ? readdirSync(PRIVATE_DIR).sort().find((f) => f.endsWith('.json')) : undefined
/** The private fixture dir is gitignored; the first *.json in it is used, and its tests are skipped when absent. */
export const hasFixture = privateFile !== undefined
export const loadFixture = (): unknown => JSON.parse(readFileSync(new URL(privateFile ?? '', PRIVATE_DIR), 'utf8'))

export const NOW = '2026-10-03T00:00:00.000Z'

export const boxesOf = (d: Doc) => new Map<string, Box>(d.widgets.map((w) => [w.id, { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }]))
export const linksOf = (d: Doc) => d.edges.map((e) => ({ source: e.source, target: e.target }))
export const crossings = (d: Doc) => countCrossings(boxesOf(d), linksOf(d))
export const anyOverlap = (d: Doc) => {
  const b = [...boxesOf(d).values()]
  return b.some((p, i) => b.slice(i + 1).some((q) => overlaps(p, q)))
}

export const note = (id: string, x: number, y: number, extra: { locked?: boolean; w?: number; h?: number } = {}) => ({
  id, type: 'note' as const, x, y, w: extra.w ?? 200, h: extra.h ?? 200, rotation: 3, sources: [],
  data: { text: '', color: '#fef08a' }, ...(extra.locked ? { locked: true } : {}),
})
export const edge = (id: string, source: string, target: string) => ({ id, source, target, color: '#e53e3e' })
