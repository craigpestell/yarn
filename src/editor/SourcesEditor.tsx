import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldError, Fieldset } from '@/components/ui/fieldset'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LIMITS, SourceSchema, type Widget } from '../../shared/schema'
import { useBoard } from './store'

export function SourcesEditor({ widget }: { widget: Widget }) {
  const patch = useBoard((s) => s.patchWidget)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const parsed = SourceSchema.safeParse({ url: url.trim(), retrievedAt: new Date().toISOString() })
    if (!parsed.success) {
      setError('Enter a valid http(s) URL')
      return
    }
    patch(widget.id, { sources: [...widget.sources, parsed.data] })
    setUrl('')
    setError(null)
  }

  return (
    <Fieldset>
      <legend>Sources ({widget.sources.length})</legend>
      <ul className="flex flex-col gap-1">
        {widget.sources.map((s, i) => (
          <li key={`${s.url}-${i}`} className="flex items-start justify-between gap-1.5 text-[0.8rem]">
            <span className="[overflow-wrap:anywhere]">{s.url}</span>
            <Button aria-label={`Remove source ${s.url}`} onClick={() => patch(widget.id, { sources: widget.sources.filter((_, j) => j !== i) })}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {widget.sources.length < LIMITS.sources && (
        <>
          <Label>
            New source URL
            <Input type="url" value={url} maxLength={LIMITS.url} onChange={(e) => setUrl(e.target.value)} />
          </Label>
          <Button onClick={add}>Add source</Button>
          {error && <FieldError>{error}</FieldError>}
        </>
      )}
    </Fieldset>
  )
}
