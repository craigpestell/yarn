import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Doc } from '../../shared/schema'
import { TITLE_MAX } from '../editor/boardIO'
import {
  BOARD_FULL_COLUMNS,
  BOARD_SUMMARY_COLUMNS,
  BoardFullSchema,
  BoardSummarySchema,
  type BoardFull,
  type BoardSummary,
} from './schemas'
import { makeSlug } from './slug'

export const EMPTY_DOC: Doc = { version: 1, widgets: [], edges: [] }

export class BoardsError extends Error {}

function fail(action: string, message: string): never {
  throw new BoardsError(`Could not ${action}: ${message}`)
}

/** Parse at the boundary; a mismatch becomes a plain BoardsError, never raw zod JSON. */
function parse<T>(schema: z.ZodType<T>, data: unknown, action: string): T {
  const r = schema.safeParse(data)
  if (!r.success) fail(action, 'the server returned data in an unexpected format')
  return r.data
}

/** All own boards (live and trashed), newest first. Rows are parsed at the boundary. */
export async function listBoards(client: SupabaseClient): Promise<BoardSummary[]> {
  const { data, error } = await client.from('boards').select(BOARD_SUMMARY_COLUMNS).order('updated_at', { ascending: false })
  if (error) fail('load your boards', error.message)
  return parse(z.array(BoardSummarySchema), data, 'load your boards')
}

export async function getBoard(client: SupabaseClient, id: string): Promise<BoardFull> {
  const { data, error } = await client.from('boards').select(BOARD_FULL_COLUMNS).eq('id', id).maybeSingle()
  if (error) fail('load the board', error.message)
  if (!data) fail('load the board', 'it was not found')
  return parse(BoardFullSchema, data, 'load the board')
}

export async function createBoard(
  client: SupabaseClient,
  ownerId: string,
  title: string,
  doc: Doc = EMPTY_DOC,
): Promise<BoardFull> {
  // A random slug can in theory collide with an existing one (unique violation); retry once with a fresh slug.
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await client
      .from('boards')
      .insert({ owner_id: ownerId, slug: makeSlug(title), title, doc, visibility: 'private' })
      .select(BOARD_FULL_COLUMNS)
      .single()
    if (error?.code === '23505' && attempt === 0) continue
    if (error) fail('create the board', error.message)
    return parse(BoardFullSchema, data, 'create the board')
  }
}

export const copyTitle = (title: string): string => `Copy of ${title}`.slice(0, TITLE_MAX)

/** Duplicate: a private copy with the same doc. Returns the new board (including its doc, for thumbnailing). */
export async function duplicateBoard(client: SupabaseClient, ownerId: string, id: string): Promise<BoardFull> {
  const source = await getBoard(client, id)
  return createBoard(client, ownerId, copyTitle(source.title), source.doc)
}

async function updateColumns(client: SupabaseClient, id: string, action: string, patch: Record<string, unknown>): Promise<void> {
  const { data, error } = await client.from('boards').update(patch).eq('id', id).select('id')
  if (error) fail(action, error.message)
  if (!Array.isArray(data) || data.length === 0) fail(action, 'the board was not found')
}

export async function renameBoard(client: SupabaseClient, id: string, title: string): Promise<void> {
  const t = z.string().trim().min(1).max(TITLE_MAX).safeParse(title)
  if (!t.success) fail('rename the board', `title must be 1-${TITLE_MAX} characters`)
  await updateColumns(client, id, 'rename the board', { title: t.data })
}

export const softDeleteBoard = (client: SupabaseClient, id: string, now: Date = new Date()) =>
  updateColumns(client, id, 'move the board to trash', { deleted_at: now.toISOString() })

export const restoreBoard = (client: SupabaseClient, id: string) =>
  updateColumns(client, id, 'restore the board', { deleted_at: null })
