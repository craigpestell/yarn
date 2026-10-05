import { useContext, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldError, Fieldset } from '@/components/ui/fieldset'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listBoards } from '../boards/api'
import type { BoardSummary } from '../boards/schemas'
import { clearWidgetLink, parseBoardUrl, resolveBoard, setWidgetLink } from './api'
import { LinksContext } from './LinksContext'

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** Inspector section (owner only): link the selected widget to one of your boards or to a pasted /b/ URL. */
export function WidgetLinkEditor({ widgetId }: { widgetId: string }) {
  const { links, editor } = useContext(LinksContext)
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [pick, setPick] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const client = editor?.client
  const boardId = editor?.boardId

  useEffect(() => {
    if (!client) return
    let live = true
    void listBoards(client).then((l) => live && setBoards(l.filter((b) => b.deleted_at === null)), () => undefined)
    return () => {
      live = false
    }
  }, [client])

  if (!editor || !boardId) return null
  const link = links.get(widgetId)
  const run = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
      editor.onChanged()
    } catch (e) {
      setError(message(e))
    }
  }
  const byUrl = () =>
    run(async () => {
      const slug = parseBoardUrl(url)
      if (!slug) throw new Error('Paste a board address like https://example.com/b/my-board')
      const target = await resolveBoard(editor.client, slug)
      if (!target) throw new Error('That board was not found or is not shared with you')
      await setWidgetLink(editor.client, boardId, widgetId, target.id)
      setUrl('')
    })

  return (
    <Fieldset>
      <legend>Linked board</legend>
      {link && (
        <p>
          {link.title === null ? 'Board unavailable' : link.title}{' '}
          <Button onClick={() => void run(() => clearWidgetLink(editor.client, boardId, widgetId))}>Clear link</Button>
        </p>
      )}
      <Label>
        Your boards
        <Select value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose a board</option>
          {boards.filter((b) => b.id !== boardId).map((b) => (
            <option key={b.id} value={b.id}>{b.title}</option>
          ))}
        </Select>
      </Label>
      <Button disabled={!pick} onClick={() => void run(() => setWidgetLink(editor.client, boardId, widgetId, pick))}>Link to this board</Button>
      <Label>
        Or paste a board address
        <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://.../b/board-name" />
      </Label>
      <Button disabled={!url.trim()} onClick={() => void byUrl()}>Link by address</Button>
      {error && <FieldError>{error}</FieldError>}
    </Fieldset>
  )
}
