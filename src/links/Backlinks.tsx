import { Link } from 'react-router'
import type { Backlink } from './schemas'

export function Backlinks({ items }: { items: Backlink[] }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="backlinks-h" className="backlinks">
      <h2 id="backlinks-h">Linked from</h2>
      <ul>
        {items.map((b) => (
          <li key={b.slug}><Link to={`/b/${b.slug}`}>{b.title}</Link></li>
        ))}
      </ul>
    </section>
  )
}
