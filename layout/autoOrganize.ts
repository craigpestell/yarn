import ELK from 'elkjs/lib/elk.bundled.js'
import { DocSchema, type Doc } from '../shared/schema'
import { makeRng } from './rng'
import { CROSSING_WEIGHT, countCrossings, overlaps, totalLength, type Box, type Link } from './score'

export interface AutoOrganizeOptions {
  seed: number
  /** Positive integer, default 20. */
  gridSize?: number
  /** Non-negative integer, default 6000. */
  iterations?: number
}

export interface AutoOrganizeMeta {
  /** Pairs of locked widget ids that overlap each other (unmovable, so the layout cannot fix them). */
  lockedOverlaps: [string, string][]
  /** True when the optimized layout was worse (crossings, then score) than a clean input, so the input positions were kept. */
  keptInput: boolean
  scoreBefore: number
  scoreAfter: number
}

interface Eval {
  crossings: number
  score: number
}
const evaluate = (boxes: Map<string, Box>, links: Link[]): Eval => {
  const crossings = countCrossings(boxes, links)
  return { crossings, score: crossings * CROSSING_WEIGHT + totalLength(boxes, links) }
}
/** Crossings first, then score: a layout never trades a crossing for shorter edges. */
const better = (a: Eval, b: Eval) => a.crossings < b.crossings || (a.crossings === b.crossings && a.score < b.score)

const snap = (v: number, g: number) => Math.round(v / g) * g
const RING_LIMIT = 100
const ANNEAL_DECAY = 7 // total cooling of ~e^-7 (= 0.001) over the run

/**
 * exp(-x) for x >= 0 from a Taylor series of exp(x) using only + * / (exactly
 * reproducible, unlike Math.exp). Heavier tail than exp, which is fine for annealing.
 */
function acceptProbability(x: number): number {
  let term = 1
  let sum = 1
  for (let k = 1; k <= 12; k++) {
    term = (term * x) / k
    sum += term
  }
  return 1 / sum
}

/**
 * Nearest free position for `box` avoiding `placed` (with a `g` gap). Ring search on the
 * grid first, then a bounded deterministic fallback over edge-aligned candidates; a spot
 * to the right of everything always exists, so this only throws on non-finite input.
 * Never returns an overlapping box.
 */
function findFree(box: Box, placed: Box[], g: number): Box {
  const free = (b: Box) => placed.every((p) => !overlaps(b, p, g))
  if (free(box)) return box
  for (let r = 1; r <= RING_LIMIT; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const c = { ...box, x: box.x + dx * g, y: box.y + dy * g }
        if (c.x >= 0 && c.y >= 0 && free(c)) return c
      }
    }
  }
  const up = (v: number) => Math.ceil(v / g) * g
  const xs = new Set<number>([box.x])
  const ys = new Set<number>([box.y, 0])
  let maxRight = 0
  for (const p of placed) {
    xs.add(up(p.x + p.w + g))
    ys.add(up(p.y + p.h + g))
    maxRight = Math.max(maxRight, p.x + p.w)
  }
  xs.add(Math.max(box.x, up(maxRight + g))) // guaranteed clear of every placed box
  let best: Box | undefined
  let bestKey: [number, number, number] | undefined
  for (const x of xs) {
    for (const y of ys) {
      if (x < 0 || y < 0) continue
      const c = { ...box, x, y }
      if (!free(c)) continue
      const key: [number, number, number] = [(x - box.x) * (x - box.x) + (y - box.y) * (y - box.y), y, x]
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
        best = c
        bestKey = key
      }
    }
  }
  if (!best) throw new Error(`autoOrganize: no free position found for widget ${box.id}`)
  return best
}

async function elkSeed(doc: Doc): Promise<Map<string, { x: number; y: number }>> {
  const elk = new ELK()
  const res = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.componentComponent': '80',
    },
    children: doc.widgets.map((w) => ({ id: w.id, width: w.w, height: w.h })),
    edges: doc.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })
  const out = new Map<string, { x: number; y: number }>()
  for (const c of res.children ?? []) out.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 })
  return out
}

function findOverlaps(boxes: Box[]): [string, string][] {
  const out: [string, string][] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i]!, boxes[j]!)) out.push([boxes[i]!.id, boxes[j]!.id])
    }
  }
  return out
}

/**
 * Returns a new Doc with widget x/y rearranged. Pure and deterministic for the
 * same (doc, seed, gridSize, iterations). Locked widgets (copied, not shared) and
 * rotation are untouched.
 *
 * Precondition: `doc` satisfies DocSchema (parsed on entry, so dangling edges etc. throw a ZodError).
 * Guarantees: movable widgets never overlap each other or any locked widget (grid-size gap).
 * The no-overlap guarantee for the whole board only holds if the locked widgets are
 * mutually disjoint; use autoOrganizeDetailed to learn about locked overlaps.
 * Never worse than the input: the best state seen is chosen by (crossings, then score), and if it is still worse than an overlap-free input, the input positions are returned, so crossings never increase for such inputs.
 */
export async function autoOrganize(doc: Doc, opts: AutoOrganizeOptions): Promise<Doc> {
  return (await autoOrganizeDetailed(doc, opts)).doc
}

export async function autoOrganizeDetailed(
  input: Doc,
  opts: AutoOrganizeOptions,
): Promise<{ doc: Doc; meta: AutoOrganizeMeta }> {
  const g = opts.gridSize ?? 20
  const iterations = opts.iterations ?? 6000
  if (!Number.isInteger(g) || g <= 0) throw new RangeError(`autoOrganize: gridSize must be a positive integer, got ${g}`)
  if (!Number.isInteger(iterations) || iterations < 0) {
    throw new RangeError(`autoOrganize: iterations must be a non-negative integer, got ${iterations}`)
  }
  const doc = DocSchema.parse(input)
  const rng = makeRng(opts.seed)
  const seedPos = await elkSeed(doc)

  const original = new Map<string, Box>(doc.widgets.map((w) => [w.id, { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }]))
  const boxes = new Map<string, Box>()
  const locked = new Set<string>()
  const placed: Box[] = []
  for (const w of doc.widgets) {
    if (w.locked) {
      const b = { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }
      boxes.set(w.id, b)
      locked.add(w.id)
      placed.push(b)
    }
  }
  const lockedOverlaps = findOverlaps(placed)
  const movable: string[] = []
  for (const w of doc.widgets) {
    if (w.locked) continue
    const p = seedPos.get(w.id) ?? { x: w.x, y: w.y }
    const b = findFree({ id: w.id, x: Math.max(0, snap(p.x, g)), y: Math.max(0, snap(p.y, g)), w: w.w, h: w.h }, placed, g)
    boxes.set(w.id, b)
    placed.push(b)
    movable.push(w.id)
  }

  const links = doc.edges.map((e) => ({ source: e.source, target: e.target }))
  const fits = (b: Box, ignore: string[]) => {
    if (b.x < 0 || b.y < 0) return false
    for (const o of boxes.values()) if (!ignore.includes(o.id) && overlaps(b, o, g)) return false
    return true
  }

  if (movable.length > 1 && links.length > 0 && iterations > 0) {
    let cur = evaluate(boxes, links).score
    let best = evaluate(boxes, links)
    let bestPos = new Map(boxes)
    let temp = 600
    const alpha = iterations > 14 ? 1 - ANNEAL_DECAY / iterations : 0.5
    for (let i = 0; i < iterations; i++, temp *= alpha) {
      const id = movable[Math.floor(rng() * movable.length)]!
      const a = boxes.get(id)!
      let undo: Box[]
      let next: Box[]
      if (rng() < 0.5) {
        const other = boxes.get(movable[Math.floor(rng() * movable.length)]!)!
        if (other.id === a.id) continue
        // swap centres snapped to grid, so differently sized boxes trade places
        const na = { ...a, x: Math.max(0, snap(other.x + other.w / 2 - a.w / 2, g)), y: Math.max(0, snap(other.y + other.h / 2 - a.h / 2, g)) }
        const nb = { ...other, x: Math.max(0, snap(a.x + a.w / 2 - other.w / 2, g)), y: Math.max(0, snap(a.y + a.h / 2 - other.h / 2, g)) }
        if (overlaps(na, nb, g) || !fits(na, [a.id, other.id]) || !fits(nb, [a.id, other.id])) continue
        undo = [a, other]
        next = [na, nb]
      } else {
        const radius = 1 + Math.floor(rng() * 12)
        const na = {
          ...a,
          x: a.x + (Math.floor(rng() * (2 * radius + 1)) - radius) * g,
          y: a.y + (Math.floor(rng() * (2 * radius + 1)) - radius) * g,
        }
        if (!fits(na, [a.id])) continue
        undo = [a]
        next = [na]
      }
      for (const b of next) boxes.set(b.id, b)
      const ev = evaluate(boxes, links)
      const s = ev.score
      if (s <= cur || rng() < acceptProbability((s - cur) / temp)) {
        cur = s
        if (better(ev, best)) {
          best = ev
          bestPos = new Map(boxes)
        }
      } else {
        for (const b of undo) boxes.set(b.id, b)
      }
    }
    for (const [k, v] of bestPos) boxes.set(k, v)
  }

  // Never worse than the input (crossings first, then score): fall back to the original
  // positions if it was overlap-free and the result is worse by that order.
  const before = evaluate(original, links)
  let after = evaluate(boxes, links)
  let keptInput = false
  if (better(before, after) && findOverlaps([...original.values()]).length === 0) {
    for (const [k, v] of original) boxes.set(k, v)
    after = before
    keptInput = true
  }
  const scoreBefore = before.score
  const scoreAfter = after.score

  return {
    doc: {
      ...doc,
      widgets: doc.widgets.map((w) => {
        if (locked.has(w.id)) return { ...w }
        const b = boxes.get(w.id)!
        return { ...w, x: b.x, y: b.y }
      }),
    },
    meta: { lockedOverlaps, keptInput, scoreBefore, scoreAfter },
  }
}
