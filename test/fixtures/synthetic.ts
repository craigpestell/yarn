import { makeRng } from '../../layout/rng'

/**
 * Deterministic synthetic v1 board with neutral content: 8 photos, 5 notes, 2 wanted posters,
 * 3 papers and 16 connections between far-apart widgets, so the starting layout has many crossings.
 * Same shape as a real v1 export; used to cover the layout and convert acceptance criteria on a clean checkout.
 */
export function syntheticV1Board(seed = 1): Record<string, unknown> {
  const rng = makeRng(seed)
  const ids = [
    ...Array.from({ length: 8 }, (_, i) => `photo-${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `note-${i + 1}`),
    ...Array.from({ length: 2 }, (_, i) => `wanted-${i + 1}`),
    ...Array.from({ length: 3 }, (_, i) => `paper-${i + 1}`),
  ]
  // 6 columns x 3 rows, generously spaced so no widgets overlap (largest is 250x300).
  const pos = (n: number) => ({
    x: (n % 6) * 500 + 40,
    y: Math.floor(n / 6) * 450 + 40,
    rotation: ((n * 7) % 11) - 5,
  })
  const at = (id: string) => pos(ids.indexOf(id))
  const pairs = new Set<string>()
  const connections: { id: string; fromItemId: string; toItemId: string; color: string }[] = []
  while (connections.length < 16) {
    const a = ids[Math.floor(rng() * ids.length)]!
    const b = ids[Math.floor(rng() * ids.length)]!
    const key = [a, b].sort().join('|')
    if (a === b || pairs.has(key)) continue
    pairs.add(key)
    connections.push({ id: `conn-${connections.length + 1}`, fromItemId: a, toItemId: b, color: '#e53e3e' })
  }
  return {
    timestamp: '2025-01-02T03:04:05.000Z',
    photos: ids.filter((i) => i.startsWith('photo')).map((id, i) => ({
      id, url: `https://example.com/source/${i + 1}`, title: `Photo ${i + 1}`, notes: `Caption ${i + 1}`,
      imageUrl: `https://example.com/images/${i + 1}.png`, ...at(id),
    })),
    notes: ids.filter((i) => i.startsWith('note')).map((id, i) => ({ id, text: `Note ${i + 1}`, color: '#fef08a', ...at(id) })),
    wantedPosters: ids.filter((i) => i.startsWith('wanted')).map((id, i) => ({
      id, name: `Person ${i + 1}`, alias: '', crime: 'Example', description: 'Neutral text', reward: '$1', imageUrl: '', ...at(id),
    })),
    papers: ids.filter((i) => i.startsWith('paper')).map((id, i) => ({ id, content: `Paper ${i + 1}`, ...at(id) })),
    connections,
  }
}

/** A wide ladder (two rows, rungs and rails, no crossings) whose edges are very long, so
 * shortening edges is worth far more than CROSSING_WEIGHT per crossing. */
export function stretchedLadder(rungs = 24, spacing = 4000): Record<string, unknown> {
  const notes = Array.from({ length: rungs * 2 }, (_, i) => {
    const col = i % rungs
    return { id: `${i < rungs ? 't' : 'b'}${col}`, text: '', x: col * spacing, y: i < rungs ? 0 : spacing, rotation: 0 }
  })
  const connections: { id: string; fromItemId: string; toItemId: string }[] = []
  for (let c = 0; c < rungs; c++) {
    connections.push({ id: `r${c}`, fromItemId: `t${c}`, toItemId: `b${c}` })
    if (c + 1 < rungs) {
      connections.push({ id: `tr${c}`, fromItemId: `t${c}`, toItemId: `t${c + 1}` })
      connections.push({ id: `br${c}`, fromItemId: `b${c}`, toItemId: `b${c + 1}` })
    }
  }
  return { notes, connections }
}
