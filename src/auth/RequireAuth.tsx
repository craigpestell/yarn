import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'

/** The provider's error text when an OAuth round-trip landed here with an error (query in PKCE, hash otherwise). */
export function oauthErrorFrom(search: string, hash: string): string | null {
  for (const raw of [search, hash.replace(/^#/, '')]) {
    const p = new URLSearchParams(raw)
    const msg = p.get('error_description') ?? p.get('error')
    if (msg) return `Sign-in failed: ${msg.slice(0, 200)}`
  }
  return null
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p role="status" className="page">Loading...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname, authError: oauthErrorFrom(location.search, location.hash) }} />
  return children
}
