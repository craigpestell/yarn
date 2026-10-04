import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listShares, shareBoard, unshareBoard } from './api'
import type { Share } from './schemas'

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** Owner's invite list (by email, never matched to accounts): read-only access to the published snapshot, even while the board is private. */
export function SharePanel({ client, boardId }: { client: SupabaseClient; boardId: string }) {
  const [shares, setShares] = useState<Share[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setShares(await listShares(client, boardId))
    } catch (e) {
      setError(message(e))
    }
  }, [client, boardId])
  useEffect(() => {
    void reload()
  }, [reload])

  const act = async (fn: () => Promise<void>, ok: string | null) => {
    setError(null)
    setNotice(null)
    try {
      await fn()
      setNotice(ok)
      await reload()
    } catch (e) {
      setError(message(e))
    }
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void act(async () => {
      await shareBoard(client, boardId, email)
      setEmail('')
    }, 'Shared. Anyone who signs in with that email can read the published board.')
  }
  return (
    <section aria-labelledby="share-h" className="share-panel">
      <h3 id="share-h">Share with people</h3>
      <form onSubmit={onSubmit} className="rename-form" noValidate>
        <label className="visually-hidden" htmlFor="share-email">Email address</label>
        <input id="share-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
        <button type="submit" disabled={!email.trim()}>Share</button>
      </form>
      {shares.length > 0 && (
        <ul aria-label="Shared with">
          {shares.map((s) => (
            <li key={s.email}>
              {s.email}{' '}
              <button type="button" aria-label={`Stop sharing with ${s.email}`} onClick={() => void act(() => unshareBoard(client, boardId, s.email), null)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p className="err" role="alert">{error}</p>}
    </section>
  )
}
