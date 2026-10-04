import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Third-party font hosts: the app must never request them at runtime. */
export const FONT_HOSTS = /fonts\.googleapis\.com|fonts\.gstatic\.com/i

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

/** Files (under `dir`, or the single file) that mention a third-party font host. */
export function scanFonts(path: string): string[] {
  const files = statSync(path).isDirectory() ? [...walk(path)] : [path]
  return files.filter((f) => FONT_HOSTS.test(readFileSync(f, 'latin1')))
}

if (process.argv[1]?.endsWith('checkFonts.ts')) {
  const targets = process.argv.length > 2 ? process.argv.slice(2) : ['dist', 'index.html']
  let hits: string[]
  try {
    hits = targets.flatMap(scanFonts)
  } catch {
    console.error(`${targets.join(', ')} not found: run npm run build first`)
    process.exit(2)
  }
  if (hits.length) {
    console.error(`third-party font host referenced in:\n${hits.join('\n')}`)
    process.exit(1)
  }
  console.log(`${targets.join(', ')} clean: no fonts.googleapis.com / fonts.gstatic.com`)
}
