import { useState } from 'react'
import { ErrorScope, FormAlert } from './Field'
import { useAuth, type OAuthProvider } from './AuthProvider'

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'github', label: 'Continue with GitHub' },
]

export function OAuthButtons() {
  const { signInOAuth } = useAuth()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="oauth" role="group" aria-label="Sign in with a provider">
      {PROVIDERS.map((p) => (
        <button key={p.id} type="button" onClick={() => void signInOAuth(p.id).then(setError)}>{p.label}</button>
      ))}
      {error && <ErrorScope error={error}><FormAlert message={error} /></ErrorScope>}
    </div>
  )
}
