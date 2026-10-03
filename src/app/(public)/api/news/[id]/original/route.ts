import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * The clipping as it was captured, served rather than shown.
 *
 * A clipping's `url` is where it came from, and that page can be edited, deleted
 * or paywalled since. The archive kept its own copy, and a reader chasing a
 * citation deserves the version the archive actually answered from.
 *
 * That copy is third-party HTML — the markup of a site we do not control, kept
 * exactly as fetched because a cleaned-up version would not be the evidence. It
 * is therefore served with a sandbox and no sniffing, never as a same-origin
 * document a script in it could reach the rest of this site through:
 *
 *   `Content-Security-Policy: sandbox` drops the document out of its origin
 *     entirely — no scripts, no plugins, no form submission, no access to
 *     cookies or storage — while still letting the page render as a page.
 *   `X-Content-Type-Options: nosniff` stops a browser from deciding the stored
 *     bytes are something else.
 *   `Referrer-Policy: no-referrer` keeps this site's URL out of the paper's logs.
 *
 * `?download=1` serves the same bytes as an attachment instead, for a reader who
 * wants the file rather than the page. It is deliberately not the default: a
 * download of a third-party page is not what most readers clicking a citation
 * meant.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const item = await prisma.news.findUnique({
    where: { id: numericId },
    select: { id: true, rawHtml: true, url: true, title: true },
  })

  // The same 404 for "no such clipping" and "no captured copy": telling a caller
  // which ids hold stored HTML is a small thing to leak and no useful thing to
  // offer.
  if (!item?.rawHtml) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const html = Buffer.from(item.rawHtml, 'utf8')
  const wantsFile = request.nextUrl.searchParams.get('download') === '1'
  // The slug is only ever shown, never written to disk, and the quotes and
  // newlines are removed because the header is otherwise a header-injection
  // point: a stored title cannot choose this response's filename.
  const slug =
    (item.title ?? 'clipping')
      // Control characters first: a stored title is data, and a carriage return
      // inside a header value is the difference between a filename and a header.
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'clipping'
  return new NextResponse(new Uint8Array(html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': String(html.length),
      'Content-Security-Policy': 'sandbox',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'SAMEORIGIN',
      ...(wantsFile
        ? { 'Content-Disposition': `attachment; filename="${slug}.html"` }
        : {}),
      // The captured page is a fixed artefact: the same clipping must not serve
      // different bytes on Tuesday than it did on Monday.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}