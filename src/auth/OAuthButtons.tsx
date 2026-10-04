import { useState } from 'react'
import { ErrorScope, FormAlert } from './Field'
import { useAuth, type OAuthProvider } from './AuthProvider'

/** GitHub is only offered once its OAuth app is set up in Supabase; then set VITE_OAUTH_GITHUB=true. */
export function oauthProviders(github = import.meta.env.VITE_OAUTH_GITHUB === 'true'): { id: OAuthProvider; label: string }[] {
  return [
    { id: 'google', label: 'Continue with Google' },
    ...(github ? [{ id: 'github' as const, label: 'Continue with GitHub' }] : []),
  ]
}

export function OAuthButtons() {
  const { signInOAuth } = useAuth()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="oauth" role="group" aria-label="Sign in with a provider">
      {oauthProviders().map((p) => (
        <button key={p.id} type="button" onClick={() => void signInOAuth(p.id).then(setError)}>{p.label}</button>
      ))}
      {error && <ErrorScope error={error}><FormAlert message={error} /></ErrorScope>}
    </div>
  )
}
