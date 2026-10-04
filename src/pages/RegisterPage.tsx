import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { AuthLayout } from '../auth/AuthLayout'
import { useAuth } from '../auth/AuthProvider'
import { ErrorScope, Field, FormAlert } from '../auth/Field'
import { OAuthButtons } from '../auth/OAuthButtons'

export const MIN_PASSWORD = 8

export function RegisterPage() {
  const { user, signUp } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/boards" replace />

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password') ?? '')
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (password !== String(f.get('confirm') ?? '')) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    const r = await signUp(String(f.get('email') ?? ''), password)
    setBusy(false)
    setError(r.error)
    setSent(r.error === null && r.needsConfirmation)
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <p role="status">If this address can be registered, a confirmation link is on its way. Follow it to finish signing up.</p>
        <p><Link to="/login">Back to log in</Link></p>
      </AuthLayout>
    )
  }
  return (
    <AuthLayout title="Register">
      <form onSubmit={(e) => void onSubmit(e)}>
        <ErrorScope error={error}>
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required />
          <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
          <FormAlert message={error} />
          <button type="submit" disabled={busy}>Create account</button>
        </ErrorScope>
      </form>
      <OAuthButtons />
      <p>Already registered? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  )
}
