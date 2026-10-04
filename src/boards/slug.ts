import { customAlphabet } from 'nanoid'

const suffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8)

/** Lowercase url-safe slug satisfying the DB check: `<title words>-<random suffix>`, 3-80 chars, no `--`. */
export function makeSlug(title: string, rand: () => string = suffix): string {
  const base = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return `${base || 'board'}-${rand()}`
}
