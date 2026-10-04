import { useContext } from 'react'
import { LinksContext } from './LinksContext'
import { recordNavigation } from './trail'

/** The link badge on a widget. An unreadable target is just "unavailable": no title, no slug, no hint. */
export function LinkChip({ widgetId }: { widgetId: string }) {
  const { links, from } = useContext(LinksContext)
  const link = links.get(widgetId)
  if (!link) return null
  if (link.title === null || link.slug === null) {
    return <span className="link-chip link-unavailable nopan" role="note">Board unavailable</span>
  }
  const slug = link.slug
  return (
    <a
      className="link-chip nopan"
      href={`/b/${slug}`}
      onClick={() => {
        if (from) recordNavigation(window.sessionStorage, from, slug)
      }}
    >
      Open board: {link.title}
    </a>
  )
}
