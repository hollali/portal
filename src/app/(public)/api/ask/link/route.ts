import { NextResponse } from 'next/server'
import { WebFetchError, readWebSource } from '@/lib/askWeb'

export const dynamic = 'force-dynamic'

const MAX_URL_LENGTH = 2_048
const MAX_QUESTION_LENGTH = 500

/**
 * Read one page the reader pasted into the chat.
 *
 * A separate route from /api/ask because it performs network I/O against a
 * third-party address. Keeping it isolated means the archive search cannot be
 * slowed down or failed by a page that is down, and the SSRF checks live in one
 * place rather than being folded into the search route.
 */
export async function POST(request: Request) {
  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const body = parsed as { url?: unknown; question?: unknown }
  if (typeof body.url !== 'string' || !body.url.trim()) {
    return NextResponse.json({ error: 'A link is required' }, { status: 400 })
  }
  if (body.url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: 'That link is too long' }, { status: 400 })
  }
  if (body.question !== undefined && typeof body.question !== 'string') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const question = typeof body.question === 'string' ? body.question.slice(0, MAX_QUESTION_LENGTH) : ''

  try {
    return NextResponse.json(await readWebSource(body.url.trim(), question))
  } catch (error) {
    if (error instanceof WebFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'I could not read that page.' }, { status: 502 })
  }
}
