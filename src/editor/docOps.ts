import { customAlphabet } from 'nanoid'
import { LIMITS, WidgetSchema, type Doc, type Edge, type Widget, type WidgetType } from '../../shared/schema'
import { isResizable, RESIZE_RULES } from './geometry'

const newId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12)
export const makeId = (): string => newId()

const SIZES: Record<WidgetType, { w: number; h: number }> = {
  photo: { w: 200, h: 240 },
  note: { w: 200, h: 200 },
  wanted: { w: 220, h: 300 },
  paper: { w: 250, h: 300 },
}
const DATA: Record<WidgetType, Record<string, string>> = {
  photo: { title: '', caption: '' },
  note: { text: '', color: '#fef08a' },
  wanted: { name: '', alias: '', crime: '', description: '', reward: '' },
  paper: { content: '' },
}

/** Random rotation in [-max, max], rounded to 0.1 degrees. rng returns [0,1). */
export function randomRotation(type: WidgetType, rng: () => number): number {
  const max = type === 'photo' ? 10 : 5
  return Math.round((rng() * 2 - 1) * max * 10) / 10
}

export function makeWidget(type: WidgetType, x: number, y: number, rng: () => number): Widget {
  const { w, h } = SIZES[type]
  return WidgetSchema.parse({
    id: makeId(),
    type,
    x,
    y,
    w,
    h,
    rotation: randomRotation(type, rng),
    sources: [],
    data: DATA[type],
  })
}

export const addWidget = (doc: Doc, w: Widget): Doc => ({ ...doc, widgets: [...doc.widgets, w] })

/** Removes a widget and every edge touching it. */
export const removeWidget = (doc: Doc, id: string): Doc => ({
  ...doc,
  widgets: doc.widgets.filter((w) => w.id !== id),
  edges: doc.edges.filter((e) => e.source !== id && e.target !== id),
})

export const removeEdge = (doc: Doc, id: string): Doc => ({ ...doc, edges: doc.edges.filter((e) => e.id !== id) })

/**
 * Connect a and b, or remove the edge if the pair is already connected (either direction).
 * Self-edges, unknown widgets and the edge cap leave the doc unchanged.
 */
export function toggleEdge(doc: Doc, a: string, b: string, id: string = makeId()): Doc {
  if (a === b) return doc
  const ids = new Set(doc.widgets.map((w) => w.id))
  if (!ids.has(a) || !ids.has(b)) return doc
  const same = (e: Edge) => (e.source === a && e.target === b) || (e.source === b && e.target === a)
  if (doc.edges.some(same)) return { ...doc, edges: doc.edges.filter((e) => !same(e)) }
  if (doc.edges.length >= LIMITS.edges) return doc
  return { ...doc, edges: [...doc.edges, { id, source: a, target: b, color: '#e53e3e' }] }
}

export const connectedTo = (doc: Doc, id: string): Set<string> =>
  new Set(doc.edges.flatMap((e) => (e.source === id ? [e.target] : e.target === id ? [e.source] : [])))

const clampCoord = (v: number) => Math.round(Math.min(LIMITS.maxCoord, Math.max(-LIMITS.maxCoord, v)))

/** Move a widget by a board-space delta. Locked widgets do not move. */
export const moveWidget = (doc: Doc, id: string, dx: number, dy: number): Doc => ({
  ...doc,
  widgets: doc.widgets.map((w) =>
    w.id === id && !w.locked ? { ...w, x: clampCoord(w.x + dx), y: clampCoord(w.y + dy) } : w,
  ),
})

/** Patch a widget (top-level and/or data fields). The result is re-validated; an invalid patch returns `doc` itself. */
export function patchWidget(
  doc: Doc,
  id: string,
  patch: { data?: Record<string, unknown> } & Record<string, unknown>,
): Doc {
  const w = doc.widgets.find((x) => x.id === id)
  if (!w) return doc
  const { data, ...top } = patch
  const next = WidgetSchema.safeParse({ ...w, ...top, data: { ...w.data, ...data } })
  if (!next.success) return doc
  return { ...doc, widgets: doc.widgets.map((x) => (x.id === id ? next.data : x)) }
}

export const patchEdge = (doc: Doc, id: string, patch: Partial<Pick<Edge, 'color'>>): Doc => ({
  ...doc,
  edges: doc.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
})

/** Set a widget's size, clamped to its type's limits. Locked and non-resizable widgets are unchanged. */
export function resizeWidget(doc: Doc, id: string, w: number, h: number): Doc {
  const target = doc.widgets.find((x) => x.id === id)
  if (!target || target.locked || !isResizable(target.type) || !Number.isFinite(w) || !Number.isFinite(h)) return doc
  const rule = RESIZE_RULES[target.type]
  const nw = Math.min(LIMITS.maxSize, Math.max(rule.minW, Math.round(w)))
  const nh = Math.min(LIMITS.maxSize, Math.max(rule.minH, Math.round(h)))
  if (nw === target.w && nh === target.h) return doc
  return { ...doc, widgets: doc.widgets.map((x) => (x.id === id ? { ...x, w: nw, h: nh } : x)) }
}

const clip = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n)}...` : s)
export function widgetLabel(w: Widget): string {
  switch (w.type) {
    case 'photo':
      return `Photo: ${w.data.title || 'untitled'}`
    case 'note':
      return `Note: ${clip(w.data.text) || 'empty'}`
    case 'wanted':
      return `Wanted poster: ${w.data.name || 'unnamed'}`
    case 'paper':
      return `Paper: ${clip(w.data.content.split('\n')[0] ?? '') || 'empty'}`
  }
}
