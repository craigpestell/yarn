import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p role="status" className="page">Loading...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
