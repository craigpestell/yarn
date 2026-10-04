import { useEffect } from 'react'
import type { SaveStatus } from './autosave'

const UNSAVED: ReadonlySet<SaveStatus['kind']> = new Set(['dirty', 'saving', 'offline', 'rejected', 'unauthenticated', 'conflict'])

/** Ask the browser to confirm leaving while edits are unsaved. */
export function useUnloadGuard(status: SaveStatus) {
  const unsaved = UNSAVED.has(status.kind)
  useEffect(() => {
    if (!unsaved) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [unsaved])
}
