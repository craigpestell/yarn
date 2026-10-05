import { Link } from 'react-router'
import type { PublicBoard } from './schemas'

/** Read-only card. The title is the only link: the thumbnail is decorative so the card has one tab stop. */
export function ExploreCard({ board, thumbUrl }: { board: PublicBoard; thumbUrl?: string }) {
  return (
    <li className="board-card">
      <div className="thumb-link">
        {thumbUrl ? <img src={thumbUrl} alt="" width={320} height={200} loading="lazy" /> : <div className="thumb-empty" aria-hidden="true" />}
      </div>
      <div className="board-meta">
        <h2><Link to={`/b/${board.slug}`}>{board.published_title}</Link></h2>
      </div>
    </li>
  )
}
