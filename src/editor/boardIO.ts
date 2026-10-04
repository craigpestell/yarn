import { z } from 'zod'
import { DocSchema, type Doc } from '../../shared/schema'

export const TITLE_MAX = 50
export const MAX_IMPORT_BYTES = 5_000_000

export const TitleSchema = z.string().trim().min(1).max(TITLE_MAX)
const BoardFileSchema = z.object({ title: TitleSchema, doc: DocSchema })

export type ParseResult = { ok: true; title: string | null; doc: Doc } | { ok: false; error: string }

export const exportBoard = (title: string, doc: Doc): string => JSON.stringify({ title, doc }, null, 2)

function describe(err: z.ZodError): string {
  const parts = err.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
  return `Invalid board data (${parts.join('; ')}${err.issues.length > 3 ? '; ...' : ''})`
}

/** Parse and validate an exported board. Accepts `{title, doc}` or a bare Doc (title is then null). */
export function parseBoard(text: string): ParseResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'File is too large to import' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'File is not valid JSON' }
  }
  const full = BoardFileSchema.safeParse(raw)
  if (full.success) return { ok: true, title: full.data.title, doc: full.data.doc }
  const bare = DocSchema.safeParse(raw)
  if (bare.success) return { ok: true, title: null, doc: bare.data }
  const isEnvelope = typeof raw === 'object' && raw !== null && 'doc' in raw
  return { ok: false, error: describe(isEnvelope ? full.error : bare.error) }
}
