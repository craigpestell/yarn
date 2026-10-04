import { Outlet } from 'react-router'

const EMAIL_RE = /^[^\s@<>"',;:()[\]\\?&#]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]+$/

/** The configured contact address, or null when unset or not a plain email (the footer line is then hidden). */
export function contactEmail(raw: string | undefined): string | null {
  const v = raw?.trim()
  return v && EMAIL_RE.test(v) ? v : null
}

export function Footer({ email = contactEmail(import.meta.env.VITE_CONTACT_EMAIL) }: { email?: string | null }) {
  if (!email) return null
  return (
    <footer className="site-footer">
      Copyright or takedown requests: <a href={`mailto:${email}`}>{email}</a>
    </footer>
  )
}

/** Root layout: the routed page fills the space above a small footer. */
export function Layout() {
  return (
    <div className="site">
      <div className="site-body"><Outlet /></div>
      <Footer />
    </div>
  )
}
