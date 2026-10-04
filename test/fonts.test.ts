import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanFonts } from '../scripts/checkFonts'

describe('font host check', () => {
  it('flags third-party font hosts and passes clean files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fonts-'))
    writeFileSync(join(dir, 'ok.css'), "@font-face{src:url(/assets/a.woff2)}")
    expect(scanFonts(dir)).toEqual([])
    writeFileSync(join(dir, 'bad.html'), '<link href="https://fonts.googleapis.com/css2?family=X">')
    writeFileSync(join(dir, 'bad.css'), '@import url(https://fonts.gstatic.com/s/x.woff2)')
    expect(scanFonts(dir).map((f) => f.split('/').pop()).sort()).toEqual(['bad.css', 'bad.html'])
  })
  it('index.html in the repo is clean', () => {
    expect(scanFonts('index.html')).toEqual([])
  })
})
