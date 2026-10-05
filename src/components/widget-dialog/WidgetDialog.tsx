import { useContext, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { widgetLabel } from '../../editor/docOps'
import { Inspector } from '../../editor/Inspector'
import { useBoard } from '../../editor/store'
import { LinksContext } from '../../links/LinksContext'
import { recordNavigation } from '../../links/trail'
import { DetailView } from './DetailView'

const TITLE_ID = 'widget-dialog-title'

/** First editable control of the edit part (where a freshly added widget starts). */
const firstField = (panel: HTMLElement) => panel.querySelector<HTMLElement>('[data-edit-part] input:not([type="hidden"]), [data-edit-part] textarea')

/**
 * The widget dialog: open exactly while a widget or yarn is selected. Detail view (widgets only) beside the Inspector.
 * Close and Escape deselect and ask the Canvas to focus the node again; the Canvas focus effect is the only thing that restores focus.
 */
export function WidgetDialog() {
  const selection = useBoard((s) => s.selection)
  const doc = useBoard((s) => s.doc)
  const select = useBoard((s) => s.select)
  const requestFocus = useBoard((s) => s.requestFocus)
  const focusSeq = useBoard((s) => s.focus?.seq)
  const { links, from } = useContext(LinksContext)

  // addWidget selects and requests focus in one update; a click or Enter only selects. That tells the two openings apart.
  const seen = useRef(focusSeq)
  const added = focusSeq !== seen.current
  useEffect(() => {
    seen.current = focusSeq
  }, [focusSeq])

  const widget = selection?.kind === 'widget' ? doc.widgets.find((w) => w.id === selection.id) : undefined
  const edge = selection?.kind === 'edge' ? doc.edges.find((e) => e.id === selection.id) : undefined
  if (!selection || (!widget && !edge)) return null

  const close = () => {
    select(null)
    requestFocus(selection.id)
  }
  const wide = widget !== undefined

  return (
    <Dialog key={`${selection.kind}:${selection.id}`} labelledBy={TITLE_ID} onClose={close} initialFocus={added && wide ? firstField : undefined} className={wide ? 'max-w-5xl' : 'max-w-md'}>
      <div className="flex items-start justify-between gap-2">
        <h2 id={TITLE_ID} className="font-marker text-xl leading-tight [overflow-wrap:anywhere]">{widget ? widgetLabel(widget) : 'Yarn'}</h2>
        <Button onClick={close}>Close</Button>
      </div>
      <div className={wide ? 'grid gap-4 md:grid-cols-2' : undefined}>
        {widget && (
          <DetailView
            widget={widget}
            link={links.get(widget.id)}
            onFollow={(slug) => {
              if (from) recordNavigation(window.sessionStorage, from, slug)
            }}
          />
        )}
        <Inspector />
      </div>
    </Dialog>
  )
}
