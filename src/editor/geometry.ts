export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 3
/** Screen pixels the pointer must travel before a press becomes a drag. */
export const DRAG_THRESHOLD = 4

export const clampZoom = (z: number): number =>
  Number.isFinite(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : 1

/** Convert a screen-space pointer delta into a board-space delta at the given zoom. */
export function dragDelta(screenDx: number, screenDy: number, zoom: number): { dx: number; dy: number } {
  const z = clampZoom(zoom)
  return { dx: screenDx / z, dy: screenDy / z }
}

export const passesThreshold = (dx: number, dy: number): boolean => Math.hypot(dx, dy) >= DRAG_THRESHOLD

const NUDGE = 10
const NUDGE_BIG = 50
export function nudgeFor(key: string, shift: boolean): { dx: number; dy: number } | null {
  const s = shift ? NUDGE_BIG : NUDGE
  switch (key) {
    case 'ArrowLeft':
      return { dx: -s, dy: 0 }
    case 'ArrowRight':
      return { dx: s, dy: 0 }
    case 'ArrowUp':
      return { dx: 0, dy: -s }
    case 'ArrowDown':
      return { dx: 0, dy: s }
    default:
      return null
  }
}

/** Quadratic yarn path between two pins with a gentle downward sag. */
export function yarnPath(sx: number, sy: number, tx: number, ty: number): string {
  const dist = Math.hypot(tx - sx, ty - sy)
  const sag = Math.min(80, Math.max(12, dist * 0.18))
  const cx = (sx + tx) / 2
  const cy = (sy + ty) / 2 + sag
  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`
}

/** Dark or light ink for a #rgb / #rrggbb background, by WCAG relative luminance. */
export function readableText(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const lin = (i: number) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4)
  return lum > 0.179 ? '#1c1917' : '#fafaf9'
}

/** Per-type resize limits. Types not listed here are not resizable. keepAspect scales height with width. */
export const RESIZE_RULES = {
  photo: { minW: 120, minH: 150, keepAspect: true },
  paper: { minW: 140, minH: 140, keepAspect: false },
} as const
export type ResizableType = keyof typeof RESIZE_RULES
export const isResizable = (type: string): type is ResizableType => type in RESIZE_RULES

/** Screen-space pointer delta -> delta along the widget's own (rotated, zoomed) axes. */
export function localDelta(screenDx: number, screenDy: number, rotationDeg: number, zoom: number): { dx: number; dy: number } {
  const z = clampZoom(zoom)
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { dx: (screenDx * cos + screenDy * sin) / z, dy: (-screenDx * sin + screenDy * cos) / z }
}

/** New integer size for a bottom-right drag of (dx, dy) from `start`, clamped to the type's limits and `max`. */
export function resizedSize(
  start: { w: number; h: number },
  dx: number,
  dy: number,
  rule: { minW: number; minH: number; keepAspect: boolean },
  max: number,
): { w: number; h: number } {
  const clamp = (v: number, lo: number) => Math.min(max, Math.max(lo, Math.round(v)))
  if (rule.keepAspect) {
    const ratio = start.h / start.w
    const scale = Math.max((start.w + dx) / start.w, (start.h + dy) / start.h)
    // Floor on width so that neither dimension drops below its minimum.
    const lo = Math.max(rule.minW, rule.minH / ratio)
    const w = Math.min(max / Math.max(1, ratio), Math.max(lo, start.w * scale))
    return { w: Math.round(w), h: Math.round(w * ratio) }
  }
  return { w: clamp(start.w + dx, rule.minW), h: clamp(start.h + dy, rule.minH) }
}
