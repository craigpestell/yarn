import { withTimeout } from './withTimeout'

export const FLUSH_TIMEOUT_MS = 8000

/** The editor currently syncing to the server registers its flush here so navigation/logout can await it. */
let active: (() => Promise<boolean>) | null = null
let discarding = false

export function registerActiveSave(flush: () => Promise<boolean>): () => void {
  active = flush
  discarding = false
  return () => {
    if (active === flush) active = null
  }
}

/** Resolves true when there is nothing unsaved (or no server board is open); false on failure or timeout. */
export async function flushActiveSave(timeoutMs: number = FLUSH_TIMEOUT_MS): Promise<boolean> {
  return active ? withTimeout(active(), timeoutMs, false) : true
}

/** The user chose to leave and discard unsaved edits: navigation guards must stand down. */
export function markDiscarding(): void {
  discarding = true
}
export const isDiscarding = (): boolean => discarding
