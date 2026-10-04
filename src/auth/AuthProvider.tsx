import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { removeAllThumbnails } from '../boards/thumbnails'

export type OAuthProvider = 'google' | 'github'
/** Every action resolves to an error message (shown in a role=alert) or null on success. */
export type ActionResult = string | null

export interface AuthApi {
  client: SupabaseClient | null
  user: User | null
  /** True until the first session lookup finishes. */
  loading: boolean
  /** True after a password-recovery link was opened: the user may set a new password. */
  recovering: boolean
  /** One-off message for the login screen (e.g. after account deletion). */
  notice: string | null
  clearNotice: () => void
  signUp: (email: string, password: string) => Promise<{ error: ActionResult; needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<ActionResult>
  signInOAuth: (provider: OAuthProvider) => Promise<ActionResult>
  signOut: () => Promise<ActionResult>
  requestReset: (email: string) => Promise<ActionResult>
  updatePassword: (password: string) => Promise<ActionResult>
  deleteAccount: () => Promise<ActionResult>
}

const Ctx = createContext<AuthApi | null>(null)

export function useAuth(): AuthApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}

const NOT_CONFIGURED = 'Accounts are not configured in this build.'
const origin = () => globalThis.location?.origin ?? ''

export function AuthProvider({ client, children }: { client: SupabaseClient | null; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(client !== null)
  const [recovering, setRecovering] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!client) return
    let live = true
    void client.auth.getSession().then(({ data }) => {
      if (!live) return
      setSession(data.session)
      setLoading(false)
    })
    const { data } = client.auth.onAuthStateChange((event, s) => {
      setSession(s)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
    })
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const signUp = useCallback<AuthApi['signUp']>(
    async (email, password) => {
      if (!client) return { error: NOT_CONFIGURED, needsConfirmation: false }
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${origin()}/boards` } })
      if (error) return { error: error.message, needsConfirmation: false }
      // The UI shows the same notice whenever no session is returned, so this form does not itself reveal whether the
      // address is registered. (Supabase may still disclose that elsewhere, e.g. via the error text or email timing.)
      return { error: null, needsConfirmation: data.session === null }
    },
    [client],
  )
  const signIn = useCallback<AuthApi['signIn']>(
    async (email, password) => {
      if (!client) return NOT_CONFIGURED
      const { error } = await client.auth.signInWithPassword({ email, password })
      return error ? error.message : null
    },
    [client],
  )
  const signInOAuth = useCallback<AuthApi['signInOAuth']>(
    async (provider) => {
      if (!client) return NOT_CONFIGURED
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin()}/boards` } })
      return error ? error.message : null
    },
    [client],
  )
  const signOut = useCallback<AuthApi['signOut']>(async () => {
    if (!client) return NOT_CONFIGURED
    const { error } = await client.auth.signOut()
    return error ? error.message : null
  }, [client])
  const requestReset = useCallback<AuthApi['requestReset']>(
    async (email) => {
      if (!client) return NOT_CONFIGURED
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset` })
      return error ? error.message : null
    },
    [client],
  )
  const updatePassword = useCallback<AuthApi['updatePassword']>(
    async (password) => {
      if (!client) return NOT_CONFIGURED
      const { error } = await client.auth.updateUser({ password })
      if (!error) setRecovering(false)
      return error ? error.message : null
    },
    [client],
  )
  const clearNotice = useCallback(() => setNotice(null), [])
  const user = session?.user ?? null
  const deleteAccount = useCallback<AuthApi['deleteAccount']>(async () => {
    if (!client || !user) return NOT_CONFIGURED
    // Files first: once the account is gone nothing can authorise their removal. Never delete the account
    // while thumbnails may remain.
    let thumbError: string | null
    try {
      thumbError = await removeAllThumbnails(client, user.id)
    } catch (e) {
      thumbError = e instanceof Error ? e.message : 'unknown error'
    }
    if (thumbError) return `Your account was not deleted because your board thumbnails could not be removed (${thumbError}). Please try again.`
    const { error } = await client.rpc('delete_my_account')
    if (error) return error.message
    setNotice('Your account and boards were deleted.')
    await client.auth.signOut({ scope: 'local' })
    return null
  }, [client, user])

  const value = useMemo<AuthApi>(
    () => ({ client, user, loading, recovering, notice, clearNotice, signUp, signIn, signInOAuth, signOut, requestReset, updatePassword, deleteAccount }),
    [client, user, loading, recovering, notice, clearNotice, signUp, signIn, signInOAuth, signOut, requestReset, updatePassword, deleteAccount],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
