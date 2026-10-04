import { isIP } from 'node:net'

/** Common multi-part public suffixes. Small on purpose (no dependency); unknown ones fall back to the last two labels. */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'org.nz', 'govt.nz', 'ac.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.za', 'org.za', 'co.in', 'org.in', 'ac.in', 'gov.in',
  'com.br', 'org.br', 'gov.br', 'com.cn', 'org.cn', 'gov.cn', 'com.mx', 'com.tr', 'com.ar', 'co.kr', 'com.sg', 'com.hk',
])

/**
 * Registrable domain (eTLD+1) of a URL: lowercase, trailing dot and port dropped, subdomains collapsed
 * (en.wikipedia.org and fr.wikipedia.org are one site). IP literals are returned as is. Limitation: only the
 * suffixes above are recognised as multi-part, so exotic public suffixes (e.g. github.io project pages) collapse to the suffix owner.
 */
export function registrableDomain(url: string): string {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
  host = host.replace(/\.+$/, '')
  if (isIP(host.replace(/^\[|\]$/g, ''))) return host
  const labels = host.split('.')
  if (labels.length <= 2) return host
  const lastTwo = labels.slice(-2).join('.')
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo
}
