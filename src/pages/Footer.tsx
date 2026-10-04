import { Outlet } from 'react-router'
import { NavBar } from './NavBar'

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

/** Root layout: the nav bar, the routed page filling the space, and a small footer. */
export function Layout() {
  return (
    <div className="site">
      <NavBar />
      <div className="site-body"><Outlet /></div>
      <Footer />
    </div>
  )
}
