import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext } from 'react'
import type { LinkView } from './schemas'
import type { TrailEntry } from './trail'

/** Owner-only: lets the inspector set and clear the link of the selected widget. */
export interface LinkEditorApi {
  client: SupabaseClient
  boardId: string
  /** Re-fetch links after a change. */
  onChanged: () => void
}

export interface LinksValue {
  /** Links keyed by widget id. */
  links: ReadonlyMap<string, LinkView>
  /** The board being viewed, recorded in the breadcrumb when a link is followed. */
  from: TrailEntry | null
  editor: LinkEditorApi | null
}

export const NO_LINKS: LinksValue = { links: new Map(), from: null, editor: null }
export const LinksContext = createContext<LinksValue>(NO_LINKS)
