import { z } from 'zod'
import { SlugSchema } from './schemas'

/**
 * Breadcrumb across boards (and owners), built from the navigation path. The path lives in sessionStorage
 * (tab-scoped) and is validated on every read: anything malformed or tampered with is discarded.
 * Titles stored here are ones the user already saw while on that board.
 */
export const TRAIL_MAX = 10
export const TRAIL_KEY = 'yarns.trail'

export const TrailEntrySchema = z.object({ slug: SlugSchema, title: z.string().max(200) })
export type TrailEntry = z.infer<typeof TrailEntrySchema>

const StateSchema = z.object({
  trail: z.array(TrailEntrySchema).max(TRAIL_MAX),
  /** Set when a link was followed: the board we are about to open. */
  pendingTo: SlugSchema.nullable(),
  /** The board the trail was last resolved for (so a reload keeps the trail). */
  current: SlugSchema.nullable(),
})
export type TrailState = z.infer<typeof StateSchema>
export type TrailStorage = Pick<Storage, 'getItem' | 'setItem'>

const EMPTY: TrailState = { trail: [], pendingTo: null, current: null }

export function readTrail(storage: TrailStorage): TrailState {
  try {
    const raw = storage.getItem(TRAIL_KEY)
    if (!raw) return EMPTY
    const parsed = StateSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : EMPTY
  } catch {
    return EMPTY
  }
}

function write(storage: TrailStorage, state: TrailState): void {
  try {
    storage.setItem(TRAIL_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable or full: no breadcrumb, nothing else breaks
  }
}

/** Following a link from `from` to `toSlug`. Linking back to a board already on the trail truncates it. */
export function recordNavigation(storage: TrailStorage, from: TrailEntry, toSlug: string): void {
  const state = readTrail(storage)
  const i = state.trail.findIndex((e) => e.slug === toSlug)
  const base = state.trail.filter((e) => e.slug !== from.slug)
  const trail = i >= 0 ? state.trail.slice(0, i) : [...base, from].slice(-TRAIL_MAX)
  write(storage, { trail, pendingTo: toSlug, current: state.current })
}

/** Pure: the trail to show for `slug` and the state to persist. */
export function nextTrail(state: TrailState, slug: string): TrailState {
  if (state.pendingTo === slug || state.current === slug) return { trail: state.trail.filter((e) => e.slug !== slug), pendingTo: null, current: slug }
  const i = state.trail.findIndex((e) => e.slug === slug)
  return { trail: i >= 0 ? state.trail.slice(0, i) : [], pendingTo: null, current: slug }
}

/** Resolve and persist the trail on arriving at `slug`; returns the ancestors to show before it. */
export function resolveTrail(storage: TrailStorage, slug: string): TrailEntry[] {
  const next = nextTrail(readTrail(storage), slug)
  write(storage, next)
  return next.trail
}
