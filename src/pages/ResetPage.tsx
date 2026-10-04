import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout } from '../auth/AuthLayout'
import { useAuth } from '../auth/AuthProvider'
import { ErrorScope, Field, FormAlert } from '../auth/Field'
import { MIN_PASSWORD } from './RegisterPage'

function RequestForm() {
  const { requestReset } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const err = await requestReset(String(new FormData(e.currentTarget).get('email') ?? ''))
    setError(err)
    setSent(err === null)
  }
  return (
    <AuthLayout title="Reset your password">
      {sent ? (
        <p role="status">If an account exists for that address, a reset link has been sent.</p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)}>
          <ErrorScope error={error}>
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <FormAlert message={error} />
            <button type="submit">Send reset link</button>
          </ErrorScope>
        </form>
      )}
      <p><Link to="/login">Back to log in</Link></p>
    </AuthLayout>
  )
}

function NewPasswordForm() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password') ?? '')
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`)
    if (password !== String(f.get('confirm') ?? '')) return setError('The passwords do not match.')
    const err = await updatePassword(password)
    setError(err)
    if (!err) void navigate('/boards', { replace: true })
  }
  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={(e) => void onSubmit(e)}>
        <ErrorScope error={error}>
          <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required />
          <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
          <FormAlert message={error} />
          <button type="submit">Set password</button>
        </ErrorScope>
      </form>
    </AuthLayout>
  )
}

export function ResetPage() {
  const { recovering } = useAuth()
  return recovering ? <NewPasswordForm /> : <RequestForm />
}
