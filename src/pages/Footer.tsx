import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

const EMAIL_RE = /^[^\s@<>"',;:()[\]\\?&#]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]+$/

/** The configured contact address, or null when unset or not a plain email (the contact part of the footer is then hidden). */
export function contactEmail(raw: string | undefined): string | null {
  const v = raw?.trim()
  return v && EMAIL_RE.test(v) ? v : null
}

export function Footer({ email = contactEmail(import.meta.env.VITE_CONTACT_EMAIL) }: { email?: string | null }) {
  return (
    <footer className="site-footer">
      <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      {email && <> · Copyright or takedown requests: <a href={`mailto:${email}`}>{email}</a></>}
    </footer>
  )
}

/** Site-wide nav so every page (privacy, terms, reader...) has a way back to the boards. */
export function SiteHeader() {
  const { user } = useAuth()
  return (
    <header className="site-header">
      <Link to={user ? '/boards' : '/'} className="site-brand">Yarns</Link>
      <nav aria-label="Main">
        {user && <NavLink to="/boards">My boards</NavLink>}
        <NavLink to="/topics">Topics</NavLink>
        {user ? <NavLink to="/account">Account</NavLink> : <NavLink to="/login">Log in</NavLink>}
      </nav>
    </header>
  )
}

/** Root layout: a slim header, the routed page filling the space, and a small footer. */
export function Layout() {
  return (
    <div className="site">
      <SiteHeader />
      <div className="site-body"><Outlet /></div>
      <Footer />
    </div>
  )
}
