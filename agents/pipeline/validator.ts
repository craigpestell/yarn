import { DocSchema, type Doc, type Widget } from '../../shared/schema'
import type { UrlResolver } from '../lib/web'
import { isPublicHttpsUrl } from '../lib/web'

export type ValidationCode = 'schema' | 'dangling' | 'duplicate' | 'self_edge' | 'ungrounded' | 'unresolvable_url' | 'unsafe_url' | 'unlicensed_image'

export interface ValidationError {
  code: ValidationCode
  path: string
  message: string
}
export interface ValidationWarning {
  code: 'image_dropped'
  path: string
  message: string
}
export type ValidationResult =
  | { ok: true; doc: Doc; errors: []; warnings: ValidationWarning[] }
  | { ok: false; doc?: undefined; errors: ValidationError[]; warnings: ValidationWarning[] }

/** Hosts whose images may be referenced. Wikimedia Commons file servers only; news photos are never hotlinked. */
export const IMAGE_HOSTS: readonly string[] = ['upload.wikimedia.org']
/** The licence record must come from the Commons file page on this exact host. */
export const LICENSE_HOST = 'commons.wikimedia.org'
/** Accepted licences, exact match after trim (case-insensitive): free-culture licences and public domain. NC/ND are excluded. */
export const LICENSE_RE = /^(?:CC0(?: 1\.0)?|CC BY(?: \d(?:\.\d)?)?|CC BY-SA(?: \d(?:\.\d)?)?|Public domain|PD)$/i
export const PROBE_CONCURRENCY = 6

export interface ValidateOptions {
  resolver: UrlResolver
  imageHosts?: readonly string[]
}

const codeFor = (message: string): ValidationCode => {
  if (message.startsWith('dangling')) return 'dangling'
  if (message.startsWith('duplicate')) return 'duplicate'
  if (message === 'self-edge') return 'self_edge'
  return 'schema'
}

const imageOf = (w: Widget): string | undefined => (w.type === 'photo' || w.type === 'wanted' ? w.data.image : undefined)
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}
const isLicenseSource = (s: { url: string; license?: string; attribution?: string }): boolean =>
  new URL(s.url).protocol === 'https:' &&
  new URL(s.url).port === '' &&
  hostOf(s.url) === LICENSE_HOST &&
  Boolean(s.license && LICENSE_RE.test(s.license.trim())) &&
  Boolean(s.attribution?.trim())

/** Run `fn` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) await fn(items[next++] as T)
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

interface Target {
  url: string
  path: string
  kind: 'source' | 'image'
  /** Every widget (and its image path) that uses this url as an image. */
  refs: { widget: number; path: string }[]
}

export async function validateBoard(input: unknown, opts: ValidateOptions): Promise<ValidationResult> {
  const parsed = DocSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ code: codeFor(i.message), path: i.path.join('.'), message: i.message })),
      warnings: [],
    }
  }
  const doc = parsed.data
  const hosts = opts.imageHosts ?? IMAGE_HOSTS
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const targets = new Map<string, Target>()
  const add = (t: Target) => {
    const prev = targets.get(t.url)
    if (!prev) targets.set(t.url, t)
    // a url used as a claim source is always fatal, even when it is also an image
    else if (prev.kind === 'image' && t.kind === 'source') targets.set(t.url, { ...t, refs: prev.refs })
    else if (prev.kind === 'image' && t.kind === 'image') prev.refs.push(...t.refs)
  }

  const dropped = new Set<number>()
  doc.widgets.forEach((w, i) => {
    const at = `widgets.${i}`
    if (w.sources.length === 0) errors.push({ code: 'ungrounded', path: `${at}.sources`, message: `widget ${w.id} has no source` })
    w.sources.forEach((s, j) => add({ url: s.url, path: `${at}.sources.${j}.url`, kind: 'source', refs: [] }))

    const image = imageOf(w)
    if (image === undefined) return
    const p = `${at}.data.image`
    const host = hostOf(image)
    // An image that is not provably free is removed (never published) rather than failing the whole draft.
    // Only photo and wanted widgets are valid without an image; anything else stays a hard error.
    const reject = (message: string) => {
      if (w.type === 'photo' || w.type === 'wanted') {
        dropped.add(i)
        warnings.push({ code: 'image_dropped', path: p, message: `image removed (unlicensed): ${message}` })
      } else errors.push({ code: 'unlicensed_image', path: p, message })
    }
    if (!host || !hosts.includes(host) || new URL(image).protocol !== 'https:' || new URL(image).port !== '') {
      reject(`image host not allowed (allowed: ${hosts.join(', ')})`)
      return
    }
    if (!w.sources.some(isLicenseSource)) {
      reject(`image needs a ${LICENSE_HOST} source (https) with an accepted licence and attribution`)
      return
    }
    add({ url: image, path: p, kind: 'image', refs: [{ widget: i, path: p }] })
  })

  await pool([...targets.values()], PROBE_CONCURRENCY, async (t) => {
    const problem = !isPublicHttpsUrl(t.url) ? 'unsafe_url' : (await opts.resolver(t.url)) ? null : 'unresolvable_url'
    if (!problem) return
    if (t.kind === 'image') {
      for (const ref of t.refs) {
        dropped.add(ref.widget)
        warnings.push({ code: 'image_dropped', path: ref.path, message: `image removed (${problem}): ${t.url}` })
      }
    } else {
      errors.push({ code: problem, path: t.path, message: `${problem === 'unsafe_url' ? 'url must be public https' : 'url did not resolve'}: ${t.url}` })
    }
  })

  errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code))
  warnings.sort((a, b) => a.path.localeCompare(b.path))
  if (errors.length) return { ok: false, errors, warnings }
  if (dropped.size) {
    // Remove the image from the widget (photos and posters are valid without one); re-validate to be sure.
    const widgets = doc.widgets.map((w, i) => {
      if (!dropped.has(i) || (w.type !== 'photo' && w.type !== 'wanted')) return w
      const { image: _image, ...data } = w.data
      // the Commons licence record only existed for the image; keep it only if nothing else would be left
      const rest = w.sources.filter((s) => !isLicenseSource(s))
      return { ...w, data, sources: rest.length ? rest : w.sources } as Widget
    })
    const again = DocSchema.safeParse({ ...doc, widgets })
    if (!again.success) {
      return { ok: false, errors: again.error.issues.map((i) => ({ code: codeFor(i.message), path: i.path.join('.'), message: i.message })), warnings }
    }
    return { ok: true, doc: again.data, errors: [], warnings }
  }
  return { ok: true, doc, errors: [], warnings }
}
