import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The one route that serves somebody else's markup.
 *
 * `rawHtml` is the page a scraper fetched from a paper we do not control, kept
 * byte for byte because a cleaned-up version would not be the evidence. Serving
 * it is therefore a decision about what this site will let third-party HTML do
 * inside a browser — and the answer has to be "nothing", enforced in headers that
 * a browser reads before it parses a byte of the page.
 *
 * The headers are the assertions here. A test that checked "it returns the HTML"
 * would pass just as happily against a version that served it unsandboxed.
 */

const findUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({ prisma: { news: { findUnique: (...args: unknown[]) => findUnique(...args) } } }))

import { NextRequest } from 'next/server'
import { GET } from '@/app/(public)/api/news/[id]/original/route'

const CAPTURED = `<!doctype html><html><head><title>Original</title></head><body><p>The speech.</p></body></html>`

const request = (id: string, query = '') =>
  new NextRequest(`https://example.test/api/news/${id}/original${query}`)

const call = (id: string, query = '') => GET(request(id, query), { params: Promise.resolve({ id }) })

beforeEach(() => {
  findUnique.mockReset()
})

describe('GET /api/news/[id]/original', () => {
  it('serves the captured page out of a sandbox, as text, un-sniffable', async () => {
    findUnique.mockResolvedValue({ id: 12, rawHtml: CAPTURED, url: 'https://example.test/story', title: 'A story' })
    const response = await call('12')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(CAPTURED)
    const headers = response.headers
    // The three that matter. `sandbox` with no allow-list takes the document out
    // of this origin: no scripts, no forms, no cookies, no storage.
    expect(headers.get('Content-Security-Policy')).toBe('sandbox')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Content-Type')).toMatch(/^text\/html/)
    // And this site's URL stays out of the paper's logs.
    expect(headers.get('Referrer-Policy')).toBe('no-referrer')
    // Read as a page, not downloaded, unless asked.
    expect(headers.get('Content-Disposition')).toBeNull()
  })

  it('offers the same bytes as a file when the reader asks for one', async () => {
    findUnique.mockResolvedValue({ id: 12, rawHtml: CAPTURED, url: 'https://example.test/story', title: 'A story' })
    const response = await call('12', '?download=1')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    // The sandbox travels with the file: it is served from the same origin.
    expect(response.headers.get('Content-Security-Policy')).toBe('sandbox')
  })

  it('names the file after the clipping, not after anything a stored title could inject', async () => {
    findUnique.mockResolvedValue({
      id: 12,
      rawHtml: CAPTURED,
      url: 'https://ghanaian-times.example.gh/story',
      // A stored title is data. It must not be able to close the filename
      // quotation or add a header of its own.
      title: 'Council\\r\\nX-Injected: yes\\r\\n" ; drop -- .story',
    })
    const response = await call('12', '?download=1')
    const disposition = response.headers.get('Content-Disposition') ?? ''
    expect(disposition).not.toMatch(/[\r\n]/)
    expect(response.headers.get('X-Injected')).toBeNull()
    expect(disposition).toMatch(/^attachment; filename="[a-z0-9-]+\.html"$/)
    // And the host of the original never reaches the header either.
    expect(disposition).not.toMatch(/ghanaian-times\.example\.gh/)
  })

  it('gives the same 404 for a missing clipping and one with no capture', async () => {
    findUnique.mockResolvedValue({ id: 12, rawHtml: null, url: 'https://example.test/story', title: 'A story' })
    const noCapture = await call('12')
    findUnique.mockResolvedValue(null)
    const missing = await call('13')

    expect(noCapture.status).toBe(404)
    expect(missing.status).toBe(404)
    // Answering differently would report which ids hold stored pages.
    const bodies = [await noCapture.text(), await missing.text()]
    expect(bodies[0]).toBe(bodies[1])
    expect(bodies[0]).not.toMatch(/rawHtml|raw_html/)
  })

  it('refuses an id that is not a row', async () => {
    for (const id of ['0', '-3', 'abc', '1.5']) {
      const response = await call(id)
      expect(response.status).toBe(404)
    }
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('does not query the database for an unusable id', async () => {
    await call('12')
    expect(findUnique).toHaveBeenCalledTimes(1)
    // Only the captured page is fetched, not the row's other fields.
    expect(findUnique.mock.calls[0][0].select).toEqual({
      id: true,
      rawHtml: true,
      url: true,
      title: true,
    })
  })
})