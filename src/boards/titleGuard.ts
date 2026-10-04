import type { Doc } from '../../shared/schema'
import { TITLE_MAX } from '../editor/boardIO'

interface Store {
  getState: () => { title: string; doc: Doc }
  subscribe: (fn: (s: { title: string; doc: Doc }, prev: { title: string; doc: Doc }) => void) => () => void
}

/** What the editor shows for a stored title (the DB allows 200 chars, the editor 50). */
export const editorTitle = (t: string): string => t.slice(0, TITLE_MAX).trim() || 'Untitled board'

/**
 * Wraps the editor store for server saves: the title is reported as null (leave the stored title alone)
 * until the user has actually changed it from what was loaded. The full stored title is therefore never
 * overwritten by its truncated editor form. Once touched, the title stays sent.
 */
export function guardTitle(store: Store, storedTitle: string) {
  const loaded = editorTitle(storedTitle)
  let touched = false
  const view = (s: { title: string; doc: Doc }) => {
    if (s.title !== loaded) touched = true
    return { title: touched ? s.title : null, doc: s.doc }
  }
  return {
    getState: () => view(store.getState()),
    subscribe: (fn: (s: { title: string | null; doc: Doc }, prev: { title: string | null; doc: Doc }) => void) =>
      store.subscribe((s, prev) => {
        const wasTouched = touched
        const cur = view(s)
        fn(cur, { title: wasTouched ? prev.title : null, doc: prev.doc })
      }),
  }
}
