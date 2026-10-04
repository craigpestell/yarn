import { Link } from 'react-router'
import type { TrailEntry } from './trail'

export function Breadcrumb({ trail, current }: { trail: TrailEntry[]; current: string }) {
  if (trail.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol>
        {trail.map((e) => (
          <li key={e.slug}><Link to={`/b/${e.slug}`}>{e.title}</Link></li>
        ))}
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  )
}
