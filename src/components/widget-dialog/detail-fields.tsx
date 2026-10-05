import type { Source, Widget } from '../../../shared/schema'
import { FIELDS } from '../../editor/fields'
import type { LinkView } from '../../links/schemas'

const TEXT = 'whitespace-pre-wrap [overflow-wrap:anywhere]'

/** Full, unclipped text of every field in the generic field table, as plain paragraphs (no labels). */
export function DetailFields({ widget }: { widget: Widget }) {
  const data: Record<string, unknown> = widget.data
  return (
    <>
      {FIELDS[widget.type].map((f, i) => {
        const v = data[f.key]
        if (typeof v !== 'string' || v.trim() === '') return null
        return <p key={f.key} className={i === 0 ? `font-marker text-xl leading-snug ${TEXT}` : TEXT}>{v}</p>
      })}
    </>
  )
}

/** Only http(s) URLs become links; anything else is shown as text. Sources are untrusted. */
const isHttp = (url: string) => /^https?:\/\//i.test(url)

export function SourcesList({ sources }: { sources: readonly Source[] }) {
  if (sources.length === 0) return null
  return (
    <ul className="flex flex-col gap-2 text-[0.85rem]">
      {sources.map((s, i) => (
        <li key={`${s.url}-${i}`} className="flex flex-col [overflow-wrap:anywhere]">
          {s.title && <span className="font-semibold">{s.title}</span>}
          {isHttp(s.url) ? (
            <a href={s.url} rel="noopener noreferrer" target="_blank" className="underline">{s.url}</a>
          ) : (
            <span>{s.url}</span>
          )}
          {s.license && <span>{s.license}</span>}
          {s.attribution && <span>{s.attribution}</span>}
        </li>
      ))}
    </ul>
  )
}

/** The linked board: a plain anchor when readable, otherwise a "Board unavailable" note (no title, slug or hint). */
export function BoardLink({ link, onFollow }: { link: LinkView; onFollow?: (slug: string) => void }) {
  const slug = link.slug
  if (link.title === null || slug === null) return <p role="note">Board unavailable</p>
  return (
    <p>
      <a href={`/b/${slug}`} className="underline" onClick={() => onFollow?.(slug)}>Open board: {link.title}</a>
    </p>
  )
}
