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
