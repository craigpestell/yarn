import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The base64 forms of `needle` at each of the three byte alignments (e.g. inside a JWT payload). */
export function base64Markers(needle: string): string[] {
  return [0, 1, 2].map((pad) => {
    const bytes = pad + needle.length
    const b64 = Buffer.from('x'.repeat(pad) + needle).toString('base64')
    return b64.slice(pad ? 4 : 0, Math.floor(bytes / 3) * 4)
  })
}

/** Markers that must never appear in the shipped bundle. Matched case-insensitively. */
export const FORBIDDEN: { label: string; re: RegExp }[] = [
  { label: 'SERVICE_ROLE', re: /service[_-]?role/i },
  { label: 'sb_secret_ key value', re: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { label: 'service_role JWT payload', re: new RegExp(base64Markers('"role":"service_role"').join('|')) },
  { label: 'agents env var', re: /CURATOR_USER_ID|ANTHROPIC_API_KEY|SUPABASE_DB_PASSWORD/ },
  { label: 'Claude Agent SDK', re: /claude-agent-sdk|@anthropic-ai/i },
]

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

/** Returns "file: label" for every hit. Binary-ish files are scanned as latin1 so no byte is skipped. */
export function scanDir(dir: string): string[] {
  const hits: string[] = []
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'latin1')
    for (const { label, re } of FORBIDDEN) if (re.test(text)) hits.push(`${file}: ${label}`)
  }
  return hits
}

if (process.argv[1]?.endsWith('checkBundle.ts')) {
  const dir = process.argv[2] ?? 'dist'
  let hits: string[]
  try {
    hits = scanDir(dir)
  } catch {
    console.error(`${dir}/ not found: run npm run build first`)
    process.exit(2)
  }
  if (hits.length) {
    console.error(`forbidden markers in ${dir}/:\n${hits.join('\n')}`)
    process.exit(1)
  }
  console.log(`${dir}/ clean: no service-role or agent markers`)
}
