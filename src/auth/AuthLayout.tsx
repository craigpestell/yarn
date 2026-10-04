import type { ReactNode } from 'react'
import { Link } from 'react-router'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="page narrow">
      <h1>{title}</h1>
      {children}
      <p className="muted"><Link to="/">Back to the sandbox board</Link></p>
    </main>
  )
}
