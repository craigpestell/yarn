import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { flushActiveSave, markDiscarding } from '../boards/activeSave'

export function NavBar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const finish = async () => {
    await signOut()
    void navigate('/', { replace: true })
  }
  const onLogout = async () => {
    if (busy) return
    setBusy(true)
    setBlocked(false)
    try {
      // Persist (and wait, bounded, for) any open board's edits before the session goes away.
      if (await flushActiveSave()) await finish()
      else setBlocked(true)
    } finally {
      setBusy(false)
    }
  }
  const onLogoutAnyway = async () => {
    markDiscarding()
    setBlocked(false)
    await finish()
  }
  return (
    <>
      <nav className="navbar" aria-label="Account">
        <Link to="/">Sandbox</Link>
        {user ? (
          <>
            <Link to="/boards">My boards</Link>
            <Link to="/account">Account</Link>
            <button type="button" disabled={busy} aria-busy={busy} onClick={() => void onLogout()}>
              {busy ? 'Saving...' : 'Log out'}
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
      {blocked && (
        <div role="alert" className="form-alert page">
          <p>You were not logged out because your latest edits could not be saved. Fix the problem shown above, or download a copy, then try again.</p>
          <button type="button" onClick={() => void onLogoutAnyway()}>Log out anyway (discard unsaved edits)</button>
        </div>
      )}
    </>
  )
}
