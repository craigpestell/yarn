import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'

export interface Row {
  id: string
  slug: string
  title: string
  visibility: 'private' | 'unlisted' | 'public'
  revision: number
  updated_at: string
  deleted_at: string | null
  doc: { version: 1; widgets: unknown[]; edges: unknown[] }
}

export const row = (over: Partial<Row> & { id: string }): Row => ({
  slug: `slug-${over.id}`,
  title: `Board ${over.id}`,
  visibility: 'private',
  revision: 0,
  updated_at: '2026-10-03T00:00:00Z',
  deleted_at: null,
  doc: { version: 1, widgets: [], edges: [] },
  ...over,
})

const UID = '00000000-0000-4000-8000-000000000001'
export const USER_ID = UID
export const session = { user: { id: UID, email: 'me@example.com' } } as unknown as Session

type Listener = (event: string, s: Session | null) => void

/** In-memory stand-in for the slice of SupabaseClient the app uses. Fails the test on unexpected calls via vi.fn. */
type RpcResult = { data: unknown; error: { message: string } | null }
export type RpcHandlers = Record<string, (args: Record<string, unknown>) => RpcResult | Promise<RpcResult>>

export function fakeClient(opts: { rows?: Row[]; session?: Session | null; insertErrors?: { code: string; message: string }[]; rpc?: RpcHandlers } = {}) {
  const insertErrors = [...(opts.insertErrors ?? [])]
  const rows = opts.rows ?? []
  let current: Session | null = opts.session === undefined ? session : opts.session
  const listeners = new Set<Listener>()
  const emit = (e: string) => {
    // Like Supabase, recovery and sign-in events carry a live session; without it the post-login redirect to a
    // protected route would bounce back to /login, which made the tests race.
    if (e === 'PASSWORD_RECOVERY' || e === 'SIGNED_IN') current = current ?? session
    listeners.forEach((l) => l(e, current))
  }

  const auth = {
    getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    }),
    signInWithPassword: vi.fn(async () => {
      emit('SIGNED_IN')
      return { error: null }
    }),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => {
      current = null
      emit('SIGNED_OUT')
      return { error: null }
    }),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
  }

  const update = vi.fn()
  const insert = vi.fn()
  const from = vi.fn((table: string) => {
    if (table !== 'boards') throw new Error(`unexpected table ${table}`)
    return {
      select: () => ({
        order: async () => ({ data: rows, error: null }),
        eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: rows.find((r) => r.id === id) ?? null, error: null }) }),
      }),
      insert: (v: Record<string, unknown>) => {
        insert(v)
        const failure = insertErrors.shift()
        if (failure) return { select: () => ({ single: async () => ({ data: null, error: failure }) }) }
        const created = row({ id: '00000000-0000-4000-8000-0000000000aa', title: String(v.title), doc: v.doc as Row['doc'] })
        rows.push(created)
        return { select: () => ({ single: async () => ({ data: created, error: null }) }) }
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_c: string, id: string) => {
          update(id, patch)
          const r = rows.find((x) => x.id === id)
          if (r) Object.assign(r, patch)
          return { select: async () => ({ data: r ? [{ id }] : [], error: null }) }
        },
      }),
    }
  })

  let files = [{ name: 'a.png' }]
  const bucket = {
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    upload: vi.fn(async () => ({ error: null })),
    list: vi.fn(async () => ({ data: files, error: null })),
    remove: vi.fn(async (paths: string[]) => {
      const gone = files.filter((f) => paths.some((p) => p.endsWith(`/${f.name}`)))
      files = files.filter((f) => !gone.includes(f))
      return { data: gone, error: null }
    }),
  }
  const storage = { from: vi.fn(() => bucket) }
  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}): Promise<RpcResult> => {
    const handler = opts.rpc?.[name]
    return handler ? handler(args) : { data: null, error: null }
  })
  const client = { auth, from, storage, rpc } as unknown as SupabaseClient
  return { client, auth, rpc, update, insert, storage, bucket, rows, emit }
}
