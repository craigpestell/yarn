import type { Widget } from '../../../shared/schema'
import { readableText } from '../../editor/geometry'
import { PhotoImage } from '../../editor/nodes/PhotoNode'
import type { LinkView } from '../../links/schemas'
import { BoardLink, DetailFields, SourcesList } from './detail-fields'

/** Read-only, full view of a widget. Takes plain props only (no editor store), so the reader can reuse it. */
export function DetailView({ widget, link, onFollow }: { widget: Widget; link?: LinkView; onFollow?: (slug: string) => void }) {
  const image = widget.type === 'photo' || widget.type === 'wanted' ? widget.data.image : undefined
  const alt = widget.type === 'photo' ? widget.data.title : widget.type === 'wanted' ? widget.data.name : ''
  const note = widget.type === 'note' ? widget.data.color : undefined
  return (
    <div className="flex min-w-0 flex-col gap-3" data-detail-view>
      {image && (
        <div className="aspect-square w-full max-w-sm overflow-hidden bg-paper [&_img]:size-full [&_img]:object-cover [&_svg]:size-full">
          <PhotoImage image={image} title={alt} />
        </div>
      )}
      <div
        className="flex flex-col gap-2 p-3 bg-paper"
        style={note ? { backgroundColor: note, color: readableText(note) } : undefined}
      >
        <DetailFields widget={widget} />
      </div>
      {widget.status && <p className="font-semibold">{widget.status}</p>}
      <SourcesList sources={widget.sources} />
      {link && <BoardLink link={link} onFollow={onFollow} />}
    </div>
  )
}
