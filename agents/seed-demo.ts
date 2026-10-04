import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_ENV_FILE, loadEnv, requireEnv } from './lib/env'
import { createServiceClient } from './lib/supabase'
import { createResolver, type UrlResolver } from './lib/web'
import { supabaseDraftStore, writeDraft } from './lib/writeDraft'
import { DEMO_DOC, DEMO_TITLE } from './fixtures/demoBoard'
import { validateBoard } from './pipeline/validator'
import { isDeepStrictEqual } from 'node:util'
import { readFileSync } from 'node:fs'
import { uploadPublishedThumbnail } from '../src/boards/thumbnails'
import { checkTarget } from './seed-curator'

/** Validate the hand-authored fixture with the agents validator (same checks as a pipeline draft). */
export async function validateDemo(resolver: UrlResolver) {
  const res = await validateBoard(DEMO_DOC, { resolver })
  if (!res.ok) throw new Error(`demo fixture invalid:\n${res.errors.map((e) => `${e.path}: ${e.message}`).join('\n')}`)
  return res
}

export interface DemoRow {
  id: string
  owner_id: string
  title: string
  doc: unknown
  revision: number
  deleted_at: string | null
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
export const MAX_THUMBNAIL_BYTES = 262144

async function checkThumbnail(png: Blob): Promise<void> {
  if (png.size > MAX_THUMBNAIL_BYTES) throw new Error(`refusing to publish: thumbnail is larger than ${MAX_THUMBNAIL_BYTES} bytes`)
  const head = new Uint8Array(await png.slice(0, PNG_SIGNATURE.length).arrayBuffer())
  if (head.length !== PNG_SIGNATURE.length || !PNG_SIGNATURE.every((b, i) => head[i] === b)) throw new Error('refusing to publish: thumbnail is not a PNG')
}

/** Narrow storage port so the publish guards are testable with a fake. */
export interface DemoStore {
  findBySlug(curatorId: string, slug: string): Promise<DemoRow | null>
  hasDemoBoard(curatorId: string, title: string): Promise<boolean>
  uploadThumbnail(ownerId: string, boardId: string, png: Blob): Promise<void>
  publish(boardId: string, row: { doc: unknown; title: string; revision: number }): Promise<void>
}

export function supabaseDemoStore(client: SupabaseClient): DemoStore {
  return {
    async findBySlug(curatorId, slug) {
      const { data, error } = await client.from('boards').select('id, owner_id, doc, title, revision, deleted_at').eq('owner_id', curatorId).eq('slug', slug).maybeSingle<DemoRow>()
      if (error) throw new Error(`could not look up the demo board: ${error.message}`)
      return data ?? null
    },
    async hasDemoBoard(curatorId, title) {
      const { data, error } = await client.from('boards').select('id').eq('owner_id', curatorId).eq('title', title).is('deleted_at', null).limit(1)
      if (error) throw new Error(`could not check for an existing demo board: ${error.message}`)
      return (data?.length ?? 0) > 0
    },
    uploadThumbnail: (ownerId, boardId, png) => uploadPublishedThumbnail(client, ownerId, boardId, png),
    async publish(boardId, row) {
      // Same columns publish_board sets. The RPC itself needs auth.uid() = owner, which the service role lacks. The demo has no widget links.
      const { error } = await client
        .from('boards')
        .update({ visibility: 'public', published_doc: row.doc, published_title: row.title, published_revision: row.revision, published_links: [] })
        .eq('id', boardId)
      if (error) throw new Error(`publish failed: ${error.message}`)
    },
  }
}

/**
 * Separate, explicit step: make the curator's UNEDITED demo board public (service role; the curator cannot log in).
 * Refuses unless the row is the curator's, not deleted, titled DEMO_TITLE and its doc is valid and its widgets and edges equal the fixture's
 * (other doc fields, e.g. the background, are not compared). A thumbnail, if given, must be a PNG of at most MAX_THUMBNAIL_BYTES.
 * Reproduces publish_board's snapshot columns. The share-preview thumbnail needs a PNG: pass one, or og:image 404s.
 */
export async function publishDemo(store: DemoStore, curatorId: string, slug: string, resolver: UrlResolver, thumbnail?: Blob): Promise<void> {
  if (thumbnail) await checkThumbnail(thumbnail)
  const row = await store.findBySlug(curatorId, slug)
  if (!row || row.owner_id !== curatorId || row.deleted_at !== null) throw new Error('demo board not found for the curator')
  if (row.title !== DEMO_TITLE) throw new Error(`refusing to publish: title is not "${DEMO_TITLE}"`)
  const res = await validateBoard(row.doc, { resolver })
  if (!res.ok) throw new Error(`refusing to publish: stored doc invalid:\n${res.errors.map((e) => `${e.path}: ${e.message}`).join('\n')}`)
  if (!isDeepStrictEqual(res.doc.widgets, DEMO_DOC.widgets) || !isDeepStrictEqual(res.doc.edges, DEMO_DOC.edges)) {
    throw new Error('refusing to publish: the stored doc differs from the demo fixture (edited or not the demo)')
  }
  if (thumbnail) await store.uploadThumbnail(row.owner_id, row.id, thumbnail)
  await store.publish(row.id, { doc: res.doc, title: row.title, revision: row.revision })
}

/** Value of `--name <value>`, undefined if the flag is absent; throws if the value is missing or looks like another flag. */
export function optionValue(argv: string[], name: string, placeholder: string): string | undefined {
  if (argv.some((a) => a.startsWith(`${name}=`))) throw new Error(`usage: ${name} ${placeholder} (a separate argument, not ${name}=...)`)
  const at = argv.indexOf(name)
  if (at < 0) return undefined
  if (argv.indexOf(name, at + 1) >= 0) throw new Error(`usage: ${name} may be given only once`)
  const v = argv[at + 1]
  if (!v || v.startsWith('--')) throw new Error(`usage: ${name} ${placeholder}`)
  return v
}

/** Parses --publish / --thumbnail; --thumbnail without --publish is a usage error. */
export function parsePublishFlags(argv: string[]): { publishSlug?: string; thumbFile?: string } {
  const publishSlug = optionValue(argv, '--publish', '<slug>')
  const thumbFile = optionValue(argv, '--thumbnail', '<file.png>')
  if (thumbFile && !publishSlug) throw new Error('usage: --thumbnail requires --publish <slug>')
  return { publishSlug, thumbFile }
}

async function main() {
  const argv = process.argv.slice(2)
  const flag = (name: string) => argv.indexOf(name)
  const file = flag('--env') >= 0 ? (argv[flag('--env') + 1] ?? DEFAULT_ENV_FILE) : DEFAULT_ENV_FILE
  const env = loadEnv(file)
  const { publishSlug, thumbFile } = parsePublishFlags(argv)

  if (argv.includes('--dry-run')) {
    const res = await validateDemo(async () => true) // offline: shape, licences and grounding only
    console.log(`dry run ok: ${res.doc.widgets.length} widgets, ${res.doc.edges.length} edges (nothing written, no network)`)
    return
  }
  console.log(`target Supabase host: ${checkTarget(env.SUPABASE_URL, argv.includes('--yes'))}`)
  const e = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CURATOR_USER_ID')
  const client = createServiceClient(env)
  const store = supabaseDemoStore(client)
  if (publishSlug) {
    const thumb = thumbFile ? new Blob([readFileSync(thumbFile)], { type: 'image/png' }) : undefined
    await publishDemo(store, e.CURATOR_USER_ID, publishSlug, createResolver(), thumb)
    console.log(`published ${publishSlug} as public`)
    if (!thumb) console.log('WARNING: no --thumbnail given, so there is no published thumbnail and /api/og?image=1 will 404 for this board')
    return
  }
  if (!argv.includes('--force') && (await store.hasDemoBoard(e.CURATOR_USER_ID, DEMO_TITLE))) {
    throw new Error('the curator already has a demo board; re-run with --force to create another draft')
  }
  const res = await validateDemo(createResolver()) // probes every source URL over the network
  const board = await writeDraft(supabaseDraftStore(client), { curatorId: e.CURATOR_USER_ID, title: DEMO_TITLE, doc: res.doc })
  console.log(`private demo draft written: slug=${board.slug}. Review it, then publish with: npm run seed:demo -- --publish ${board.slug}`)
}

if (process.argv[1]?.endsWith('seed-demo.ts')) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'unknown error')
    process.exit(1)
  })
}
