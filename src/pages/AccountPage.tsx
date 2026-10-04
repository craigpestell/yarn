import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ErrorScope, Field, FormAlert } from '../auth/Field'
import { NavBar } from './NavBar'

export function AccountPage() {
  const { user, deleteAccount } = useAuth()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const email = user?.email ?? ''
  const confirmed = email !== '' && typed.trim().toLowerCase() === email.toLowerCase()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!confirmed) return
    setBusy(true)
    const err = await deleteAccount()
    setBusy(false)
    setError(err) // on success the session ends and the protected route redirects to /login with a notice
  }

  return (
    <>
      <NavBar />
      <main className="page narrow">
        <h1>Account</h1>
        <p>Signed in as <strong>{email}</strong></p>
        <section aria-labelledby="del-h">
          <h2 id="del-h">Delete account</h2>
          <p>This permanently deletes your account and every board you own, including the trash. It cannot be undone.</p>
          <form onSubmit={(e) => void onSubmit(e)}>
            <ErrorScope error={error}>
              <Field label={`Type ${email} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              <FormAlert message={error} />
              <button type="submit" className="danger" disabled={!confirmed || busy}>Delete my account</button>
            </ErrorScope>
          </form>
        </section>
      </main>
    </>
  )
}
