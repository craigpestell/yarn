import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

/**
 * Ensure `NAME=value` exists in an env file without printing anything.
 * Returns 'added' | 'present' (set and non-empty: left untouched, even if different).
 * An empty `NAME=` placeholder line is filled in. The file ends up mode 600.
 */
export function setEnvIfMissing(file: string, name: string, value: string): 'added' | 'present' {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const lines = text === '' ? [] : text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  const re = new RegExp(`^${name}=(.*)$`)
  const idx = lines.findIndex((l) => re.test(l))
  let result: 'added' | 'present' = 'added'
  if (idx >= 0) {
    if ((lines[idx]?.match(re)?.[1] ?? '').trim() !== '') result = 'present'
    else lines[idx] = `${name}=${value}`
  } else {
    lines.push(`${name}=${value}`)
  }
  if (result === 'added') writeFileSync(file, lines.join('\n') + '\n', { mode: 0o600 })
  chmodSync(file, 0o600)
  return result
}
