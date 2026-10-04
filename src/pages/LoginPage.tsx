import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { AuthLayout } from '../auth/AuthLayout'
import { useAuth } from '../auth/AuthProvider'
import { ErrorScope, Field, FormAlert } from '../auth/Field'
import { OAuthButtons } from '../auth/OAuthButtons'

function redirectTarget(state: unknown): string {
  const from = typeof state === 'object' && state !== null && 'from' in state ? (state as { from: unknown }).from : null
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/boards'
}

export function LoginPage() {
  const { user, signIn, notice, clearNotice } = useAuth()
  // Show the one-off notice once, then clear it from the provider so it does not come back.
  const [shownNotice] = useState(notice)
  useEffect(() => {
    if (notice) clearNotice()
  }, [notice, clearNotice])
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const target = redirectTarget(location.state)

  if (user) return <Navigate to={target} replace />

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const err = await signIn(String(f.get('email') ?? ''), String(f.get('password') ?? ''))
    setBusy(false)
    setError(err)
    if (!err) void navigate(target, { replace: true })
  }

  return (
    <AuthLayout title="Log in">
      {shownNotice && <p role="status">{shownNotice}</p>}
      <form onSubmit={(e) => void onSubmit(e)}>
        <ErrorScope error={error}>
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          <FormAlert message={error} />
          <button type="submit" disabled={busy}>Log in</button>
        </ErrorScope>
      </form>
      <OAuthButtons />
      <p><Link to="/reset">Forgot your password?</Link></p>
      <p>No account? <Link to="/register">Register</Link></p>
    </AuthLayout>
  )
}
