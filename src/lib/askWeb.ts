/**
 * Read one page a reader explicitly supplied to /ask.
 *
 * This is not a web search and it does not crawl. The reader pastes a link, the
 * server fetches that one page, and the assistant reports the title and the
 * passage closest to the question. Keeping it to an explicit link avoids
 * inventing a search provider, an API key, or a claim that the page was vetted.
 *
 * The fetch is deliberately defensive. A server-side URL fetcher is an SSRF
 * primitive if it follows arbitrary addresses, so this one:
 *   - accepts only http/https on the standard ports,
 *   - refuses credentials in the URL,
 *   - resolves the host and rejects every private, loopback, link-local and
 *     metadata address,
 *   - pins the connection to the address it checked, so DNS rebinding cannot
 *     swap it between check and connect,
 *   - follows at most three redirects, revalidating each one,
 *   - bounds time and response size, and accepts only HTML/plain text.
 */

import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { load } from 'cheerio'
import { termVariants } from '@/lib/askQuery'

const MAX_BYTES = 1_500_000
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8_000
const MAX_TEXT = 20_000

export class WebFetchError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'WebFetchError'
    this.status = status
  }
}

export interface WebSource {
  title: string
  url: string
  siteName: string | null
  description: string | null
  /** The passage closest to the reader's question, or the opening of the page. */
  excerpt: string
  /** Which of the reader's terms appear in that passage. */
  matched: string[]
  retrievedAt: string
}

function privateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && parts[2] === 0) ||
    (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  )
}

const BLOCKED_IPV6 = new BlockList()
BLOCKED_IPV6.addSubnet('::', 128, 'ipv6') // unspecified
BLOCKED_IPV6.addSubnet('::1', 128, 'ipv6') // loopback
BLOCKED_IPV6.addSubnet('fc00::', 7, 'ipv6') // unique-local
BLOCKED_IPV6.addSubnet('fe80::', 10, 'ipv6') // link-local
BLOCKED_IPV6.addSubnet('ff00::', 8, 'ipv6') // multicast
// IPv4-mapped and NAT64 addresses can reach arbitrary IPv4, including
// loopback. Normalise through BlockList so full and compressed spellings match.
BLOCKED_IPV6.addSubnet('::ffff:0:0', 96, 'ipv6')
BLOCKED_IPV6.addSubnet('64:ff9b::', 96, 'ipv6')

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return privateIpv4(address)
  if (family !== 6) return true
  return BLOCKED_IPV6.check(address.split('%')[0], 'ipv6')
}

interface ValidatedTarget {
  url: URL
  address: string
  family: number
}

export async function validatePublicUrl(raw: string): Promise<ValidatedTarget> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new WebFetchError('That does not look like a valid web address.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebFetchError('Only http and https links can be read.')
  }
  if (url.username || url.password) {
    throw new WebFetchError('Links with a username or password are not accepted.')
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new WebFetchError('Only standard web ports are accepted.')
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home') ||
    host.endsWith('.lan')
  ) {
    throw new WebFetchError('That address is not a public web page.')
  }

  const literal = host.replace(/^\[|\]$/g, '')
  if (isIP(literal) && isPrivateAddress(literal)) {
    throw new WebFetchError('That address is not a public web page.')
  }

  let resolved: Array<{ address: string; family: number }>
  try {
    resolved = await lookup(literal, { all: true, verbatim: true })
  } catch {
    throw new WebFetchError('I could not resolve that web address.', 502)
  }
  if (resolved.length === 0 || resolved.some(entry => isPrivateAddress(entry.address))) {
    throw new WebFetchError('That address is not a public web page.')
  }

  // Prefer IPv4 when a host has both. A container with no IPv6 route often
  // resolves an AAAA first and then fails to connect even though the page is
  // reachable over IPv4.
  const chosen = resolved.find(entry => entry.family === 4) ?? resolved[0]
  return { url, address: chosen.address, family: chosen.family }
}

/**
 * Pin DNS to one already-checked address.
 *
 * Node's happy-eyeballs connect asks for `all: true` and expects an array;
 * older callers expect a single address. Returning the wrong shape surfaces as
 * `ERR_INVALID_IP_ADDRESS: undefined` and every fetch fails.
 */
export function pinnedLookup(address: string, family: number) {
  return (
    _hostname: string,
    options: { all?: boolean },
    callback: (error: NodeJS.ErrnoException | null, result: string | Array<{ address: string; family: number }>, family?: number) => void,
  ) => {
    if (options?.all) {
      callback(null, [{ address, family }])
    } else {
      callback(null, address, family)
    }
  }
}

interface PageResponse {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: Buffer
  url: string
}

function fetchPinned(target: ValidatedTarget): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const { url, address, family } = target
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        method: 'GET',
        headers: {
          'user-agent': 'BagbinArchiveBot/1.0 (+https://example.invalid/ask)',
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
        },
        // Pin the socket to the address that was checked above. `servername`
        // keeps TLS verification tied to the hostname rather than the IP.
        lookup: pinnedLookup(address, family) as never,
        servername: url.hostname,
        timeout: TIMEOUT_MS,
      },
      response => {
        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_BYTES) {
            response.destroy()
            reject(new WebFetchError('That page is too large to read.', 413))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
            url: url.toString(),
          })
        })
        response.on('error', reject)
      },
    )
    request.on('timeout', () => {
      request.destroy()
      reject(new WebFetchError('That page took too long to respond.', 504))
    })
    request.on('error', () => {
      reject(new WebFetchError('I could not reach that page.', 502))
    })
    request.end()
  })
}

function header(headers: PageResponse['headers'], name: string): string | null {
  const value = headers[name]
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function pageText(html: string): {
  title: string
  siteName: string | null
  description: string | null
  text: string
} {
  const $ = load(html)
  $('script, style, noscript, svg, iframe, form, nav, footer, header, aside, template').remove()

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    'Untitled page'
  const siteName =
    $('meta[property="og:site_name"]').attr('content')?.trim() ||
    $('meta[name="application-name"]').attr('content')?.trim() ||
    null
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const article = $('article').first()
  const main = $('main').first()
  const root = article.length > 0 ? article : main.length > 0 ? main : $('body')
  const text = root.text().replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
  return { title, siteName, description, text }
}

function passage(text: string, terms: string[], max = 420): { excerpt: string; matched: string[] } {
  if (!text) return { excerpt: '', matched: [] }
  const variants = [...new Set(terms.flatMap(termVariants).filter(Boolean))]
  const matched = terms.filter(term =>
    termVariants(term).some(variant =>
      new RegExp(`(?:^|[^a-z0-9])${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text),
    ),
  )

  let at = -1
  for (const variant of variants) {
    const found = text.toLowerCase().indexOf(variant)
    if (found >= 0 && (at < 0 || found < at)) at = found
  }
  if (at < 0) return { excerpt: text.length > max ? `${text.slice(0, max).trim()}…` : text, matched }

  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, at - 80)))
  const end = Math.min(text.length, start + max)
  return {
    excerpt: `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`,
    matched,
  }
}

const PAGE_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at',
  'for', 'from', 'by', 'with', 'about', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'do', 'does', 'did', 'has', 'have', 'had', 'can', 'could',
  'will', 'would', 'should', 'this', 'that', 'these', 'those', 'it', 'its',
  'who', 'what', 'when', 'where', 'why', 'how', 'page', 'link', 'site', 'say',
  'says', 'said', 'tell', 'me', 'you', 'your', 'my', 'there', 'here', 'they',
  'them', 'his', 'her', 'he', 'she', 'we', 'us', 'our', 'any', 'all', 'not',
])

/**
 * Pull meaningful words from the reader's question.
 *
 * This does not use the archive's term list: words like "speaker" are
 * collection names there but ordinary content words on a linked page.
 */
export function pageTerms(question: string): string[] {
  const words = question.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []
  return [...new Set(words)].filter(word => !PAGE_STOP_WORDS.has(word)).slice(0, 8)
}

/** Fetch and read one reader-supplied page. */
export async function readWebSource(rawUrl: string, question = ''): Promise<WebSource> {
  let current = await validatePublicUrl(rawUrl)
  let response: PageResponse | null = null

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    response = await fetchPinned(current)
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = header(response.headers, 'location')
    if (!location) break
    if (redirect === MAX_REDIRECTS) {
      throw new WebFetchError('That link redirects too many times.', 502)
    }
    current = await validatePublicUrl(new URL(location, current.url).toString())
  }

  if (!response) throw new WebFetchError('I could not reach that page.', 502)
  if (response.status < 200 || response.status >= 300) {
    throw new WebFetchError(`That page returned HTTP ${response.status}.`, 502)
  }

  const contentType = (header(response.headers, 'content-type') ?? '').toLowerCase()
  const readable =
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml+xml') ||
    contentType.includes('text/plain') ||
    contentType === ''
  if (!readable) {
    throw new WebFetchError('That link is not an HTML or text page, so I cannot read it here.', 415)
  }

  const raw = response.body.toString('utf8')
  const parsed = contentType.includes('text/plain')
    ? { title: current.url.hostname, siteName: current.url.hostname, description: null, text: raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) }
    : pageText(raw)

  const terms = pageTerms(question.slice(0, 500))
  const found = passage(parsed.text, terms)
  return {
    title: parsed.title,
    url: response.url,
    siteName: parsed.siteName ?? current.url.hostname,
    description: parsed.description,
    excerpt: found.excerpt || parsed.description || '',
    matched: found.matched,
    retrievedAt: new Date().toISOString(),
  }
}
