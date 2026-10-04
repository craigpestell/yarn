import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Visibility } from '../boards/schemas'
import { EmailSchema, PUBLISH_STATE_COLUMNS, PublishStateSchema, ShareSchema, type PublishState, type Share } from './schemas'

export class PublishError extends Error {}
const fail = (action: string, message: string): never => {
  throw new PublishError(`Could not ${action}: ${message}`)
}

export async function getPublishState(client: SupabaseClient, boardId: string): Promise<PublishState> {
  const { data, error } = await client.from('boards').select(PUBLISH_STATE_COLUMNS).eq('id', boardId).maybeSingle()
  if (error) fail('load publish settings', error.message)
  if (!data) return fail('load publish settings', 'the board was not found')
  const parsed = PublishStateSchema.safeParse(data)
  return parsed.success ? parsed.data : fail('load publish settings', 'unexpected data')
}

/** Snapshot the saved doc (and its links) for readers, optionally changing visibility in the same step. */
export async function publishBoard(client: SupabaseClient, boardId: string, visibility: Visibility | null): Promise<number> {
  const { data, error } = await client.rpc('publish_board', { p_id: boardId, p_visibility: visibility })
  if (error) fail('publish', error.message)
  const rev = z.number().int().nullable().safeParse(data)
  if (!rev.success || rev.data === null) return fail('publish', 'the board was not found')
  return rev.data
}

export async function unpublishBoard(client: SupabaseClient, boardId: string): Promise<void> {
  const { data, error } = await client.rpc('unpublish_board', { p_id: boardId })
  if (error) fail('unpublish', error.message)
  if (data !== true) fail('unpublish', 'the board was not found')
}

export async function setShowBacklinks(client: SupabaseClient, boardId: string, show: boolean): Promise<void> {
  const { data, error } = await client.from('boards').update({ show_backlinks: show }).eq('id', boardId).select('id')
  if (error) fail('update backlinks setting', error.message)
  if (!Array.isArray(data) || data.length === 0) fail('update backlinks setting', 'the board was not found')
}

export async function listShares(client: SupabaseClient, boardId: string): Promise<Share[]> {
  const { data, error } = await client.rpc('list_board_shares', { p_board_id: boardId })
  if (error) fail('load the share list', error.message)
  const rows = z.array(ShareSchema).safeParse(data)
  return rows.success ? rows.data : fail('load the share list', 'unexpected data')
}

/** Invite a person by email. The server stores the address without checking for an account and answers the same for every address, so callers must not imply the account exists. */
export async function shareBoard(client: SupabaseClient, boardId: string, email: string): Promise<void> {
  const e = EmailSchema.safeParse(email)
  if (!e.success) fail('share', 'enter a valid email address')
  const { data, error } = await client.rpc('share_board', { p_board_id: boardId, p_email: e.data })
  if (error) fail('share', error.message)
  if (data !== true) fail('share', 'the board was not found')
}

export async function unshareBoard(client: SupabaseClient, boardId: string, email: string): Promise<void> {
  const { data, error } = await client.rpc('unshare_board', { p_board_id: boardId, p_email: email })
  if (error) fail('remove the share', error.message)
  if (data !== true) fail('remove the share', 'the board was not found')
}
