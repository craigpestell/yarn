import type { Doc, Widget } from '../../shared/schema'

export const THUMB_W = 320
export const THUMB_H = 200
const PAD = 12

const FILL: Record<Widget['type'], string> = {
  photo: '#ffffff',
  note: '#fef08a',
  wanted: '#e7d3a7',
  paper: '#f5f5f4',
}

const fmt = (n: number) => String(Math.round(n * 10) / 10)

/** Deterministic SVG of the board: widget rectangles and yarn lines on cork, scaled to fit. Pure; no I/O. */
export function renderThumbnailSvg(doc: Doc): string {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const w of doc.widgets) {
    minX = Math.min(minX, w.x)
    minY = Math.min(minY, w.y)
    maxX = Math.max(maxX, w.x + w.w)
    maxY = Math.max(maxY, w.y + w.h)
  }
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_W}" height="${THUMB_H}" viewBox="0 0 ${THUMB_W} ${THUMB_H}">`
  const bg = `<rect width="${THUMB_W}" height="${THUMB_H}" fill="#c89b6a"/>`
  if (doc.widgets.length === 0) return `${head}${bg}</svg>`
  const scale = Math.min((THUMB_W - 2 * PAD) / (maxX - minX), (THUMB_H - 2 * PAD) / (maxY - minY))
  const ox = (THUMB_W - (maxX - minX) * scale) / 2 - minX * scale
  const oy = (THUMB_H - (maxY - minY) * scale) / 2 - minY * scale
  const byId = new Map(doc.widgets.map((w) => [w.id, w]))
  const center = (w: Widget) => ({ x: ox + (w.x + w.w / 2) * scale, y: oy + (w.y + w.h / 2) * scale })

  const lines = doc.edges.flatMap((e) => {
    const a = byId.get(e.source)
    const b = byId.get(e.target)
    if (!a || !b) return []
    const p = center(a)
    const q = center(b)
    return [`<line x1="${fmt(p.x)}" y1="${fmt(p.y)}" x2="${fmt(q.x)}" y2="${fmt(q.y)}" stroke="${e.color}" stroke-width="2"/>`]
  })
  const rects = doc.widgets.map((w) => {
    const fill = w.type === 'note' ? w.data.color : FILL[w.type]
    const c = center(w)
    return `<rect x="${fmt(ox + w.x * scale)}" y="${fmt(oy + w.y * scale)}" width="${fmt(w.w * scale)}" height="${fmt(w.h * scale)}" fill="${fill}" stroke="#57534e" stroke-width="1" transform="rotate(${fmt(w.rotation)} ${fmt(c.x)} ${fmt(c.y)})"/>`
  })
  return `${head}${bg}${rects.join('')}${lines.join('')}</svg>`
}

/** Rasterise the SVG to a PNG in the browser. Uses a blob: URL only; no network. */
export async function renderThumbnailPng(doc: Doc): Promise<Blob> {
  const svg = new Blob([renderThumbnailSvg(doc)], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(svg)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = THUMB_W
    canvas.height = THUMB_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    ctx.drawImage(img, 0, 0)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
