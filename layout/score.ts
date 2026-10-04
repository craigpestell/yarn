export interface Box {
  id: string
  x: number
  y: number
  w: number
  h: number
}
export interface Link {
  source: string
  target: string
}
type Pt = { x: number; y: number }

/** Edges anchor at the pin (top centre); rotation is cosmetic and ignored. */
export function pin(b: Box): Pt {
  return { x: b.x + b.w / 2, y: b.y + 10 }
}

function orient(a: Pt, b: Pt, c: Pt): number {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0
}

export function countCrossings(boxes: Map<string, Box>, links: Link[]): number {
  const segs: { s: string; t: string; a: Pt; b: Pt }[] = []
  for (const l of links) {
    const s = boxes.get(l.source)
    const t = boxes.get(l.target)
    if (s && t) segs.push({ s: l.source, t: l.target, a: pin(s), b: pin(t) })
  }
  let n = 0
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const p = segs[i]!
      const q = segs[j]!
      if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) continue
      if (segmentsCross(p.a, p.b, q.a, q.b)) n++
    }
  }
  return n
}

export function totalLength(boxes: Map<string, Box>, links: Link[]): number {
  let sum = 0
  for (const l of links) {
    const s = boxes.get(l.source)
    const t = boxes.get(l.target)
    if (s && t) {
      const dx = pin(s).x - pin(t).x
      const dy = pin(s).y - pin(t).y
      sum += Math.sqrt(dx * dx + dy * dy) // sqrt is correctly rounded; Math.hypot is not
    }
  }
  return sum
}

export const CROSSING_WEIGHT = 1000

export function score(boxes: Map<string, Box>, links: Link[]): number {
  return countCrossings(boxes, links) * CROSSING_WEIGHT + totalLength(boxes, links)
}

export function overlaps(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
}
