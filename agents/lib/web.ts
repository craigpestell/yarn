import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/** Injectable URL check: true when the URL is public https and answers with a 2xx. */
export type UrlResolver = (url: string) => Promise<boolean>

const v4Private = (o: [number, number, number, number]): boolean => {
  const [p, q, r] = o
  return (
    p === 0 || p === 10 || p === 127 || p >= 224 ||
    (p === 100 && q >= 64 && q <= 127) ||
    (p === 169 && q === 254) ||
    (p === 172 && q >= 16 && q <= 31) ||
    (p === 192 && q === 168) ||
    (p === 192 && q === 88 && r === 99) || // 6to4 relay anycast
    (p === 192 && q === 0) || // 192.0.0.0/24 and 192.0.2.0/24 (documentation)
    (p === 198 && (q === 18 || q === 19)) ||
    (p === 198 && q === 51 && r === 100) ||
    (p === 203 && q === 0 && r === 113)
  )
}

/** Expand an IPv6 literal to its 8 numeric groups (null when malformed). */
function expandV6(a: string): number[] | null {
  let addr = a
  const dotted = addr.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const [o1, o2, o3, o4] = (dotted[2] as string).split('.').map(Number) as [number, number, number, number]
    addr = `${dotted[1]}${((o1 << 8) | o2).toString(16)}:${((o3 << 8) | o4).toString(16)}`
  }
  const halves = addr.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? (halves[0] as string).split(':') : []
  const tail = halves.length === 2 && halves[1] ? (halves[1] as string).split(':') : []
  const fill = 8 - head.length - tail.length
  if ((halves.length === 1 && fill !== 0) || fill < 0) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill('0'), ...tail].map((g) => parseInt(g, 16))
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null
}

const v4From = (hi: number, lo: number): [number, number, number, number] => [hi >> 8, hi & 255, lo >> 8, lo & 255]

/** True for loopback, private, link-local, CGNAT, multicast, documentation, transition ranges and other non-public addresses. */
export function isPrivateAddress(addr: string): boolean {
  const a = addr.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(a) === 4) return v4Private(a.split('.').map(Number) as [number, number, number, number])
  if (isIP(a) === 6) {
    const g = expandV6(a)
    if (!g) return true
    const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [number, number, number, number, number, number, number, number]
    if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
      // ::/96 (unspecified, loopback, IPv4-compatible) is always blocked; ::ffff:a.b.c.d is judged by its v4 part
      return g5 === 0xffff ? v4Private(v4From(g6, g7)) : g5 === 0
    }
    if (g0 === 0x2002) return v4Private(v4From(g1, g2)) // 6to4
    if (g0 === 0x2001 && g1 === 0) return true // Teredo
    if (g0 === 0x2001 && g1 === 0xdb8) return true // documentation
    if (g0 === 0x64 && g1 === 0xff9b) return true // NAT64
    return (g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfec0 || (g0 & 0xffc0) === 0xfe80 || g0 >> 8 === 0xff
  }
  return false
}

export type Lookup = (host: string) => Promise<string[]>
const defaultLookup: Lookup = async (host) => (await dnsLookup(host, { all: true })).map((r) => r.address)

/** Static checks (no network): https only, default port only (443), no credentials, no localhost-ish names, no private IP literals. */
export function isPublicHttpsUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port !== '') return false
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (isIP(host.replace(/^\[|\]$/g, '')) && isPrivateAddress(host)) return false
  if (!host.includes('.') && !isIP(host.replace(/^\[|\]$/g, ''))) return false
  return true
}

/** Static checks plus DNS: every address the host resolves to must be public. Used by the resolver and the WebFetch gate. */
export async function isSafeFetchTarget(url: string, lookup: Lookup = defaultLookup): Promise<boolean> {
  if (!isPublicHttpsUrl(url)) return false
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) return true
  try {
    const addrs = await lookup(host)
    return addrs.length > 0 && addrs.every((x) => !isPrivateAddress(x))
  } catch {
    return false
  }
}

export interface ResolverOptions {
  fetch?: typeof fetch
  lookup?: Lookup
  timeoutMs?: number
  maxRedirects?: number
}

/**
 * Real resolver. SSRF guards: https only, every hop (including redirects, followed manually)
 * is re-checked statically and by DNS (all A/AAAA answers must be public). HEAD first, GET
 * as a fallback. Residual risk: DNS rebinding between lookup and connect; run agents without
 * access to internal networks.
 */
export function createResolver(opts: ResolverOptions = {}): UrlResolver {
  const doFetch = opts.fetch ?? fetch
  const lookup = opts.lookup ?? defaultLookup
  const timeoutMs = opts.timeoutMs ?? 8000
  const maxRedirects = opts.maxRedirects ?? 3

  const safeHost = (url: string) => isSafeFetchTarget(url, lookup)

  const probe = async (start: string, method: 'HEAD' | 'GET'): Promise<number | null> => {
    let url = start
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (!(await safeHost(url))) return null
      const res = await doFetch(url, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'yarns-agent-validator/1.0' },
      })
      void res.body?.cancel().catch(() => undefined)
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) return null
        url = new URL(loc, url).toString()
        continue
      }
      return res.status
    }
    return null
  }

  return async (url) => {
    try {
      const head = await probe(url, 'HEAD')
      if (head !== null && head >= 200 && head < 300) return true
      if (head === null) return false
      const get = await probe(url, 'GET')
      return get !== null && get >= 200 && get < 300
    } catch {
      return false
    }
  }
}
