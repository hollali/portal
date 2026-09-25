import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { archiveRouteForKind, KIND_CONFIG, type ArchiveKind } from '@/lib/library'
import {
  ASK_SUGGESTIONS,
  queryTerms,
  termVariants,
  type AskCitation,
  type AskMatchMode,
  type AskResult,
} from '@/lib/askQuery'

export const dynamic = 'force-dynamic'

const DOC_FIELDS = ['title', 'excerpt', 'body', 'event', 'occasion', 'location', 'theme', 'parliament'] as const
const TESTIMONIAL_FIELDS = ['quote', 'author', 'role'] as const
const MILESTONE_FIELDS = ['title', 'description'] as const

const DOC_TAKE = 6

/** Loosely-typed Prisma filter — the generated client is project-local. */
type Where = Record<string, unknown>

function snippet(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

/**
 * For one term, every (surface form x field) pair it could match.
 * This is the OR-group for a single term.
 */
function termClause(term: string, fields: readonly string[]): Where {
  return {
    OR: termVariants(term).flatMap(variant =>
      fields.map(field => ({ [field]: { contains: variant, mode: 'insensitive' } })),
    ),
  }
}

/**
 * `all` requires every term to match somewhere (AND of ORs) — precise.
 * `any` requires only one (flat OR) — the loose fallback used when the user's
 * phrasing is broader than any single record.
 */
function buildWhere(
  fields: readonly string[],
  terms: string[],
  mode: 'all' | 'any',
): Where {
  const clauses = terms.map(term => termClause(term, fields))
  return {
    status: 'published',
    ...(mode === 'all' ? { AND: clauses } : { OR: clauses.flat() }),
  }
}

function noMatchSummary(terms: string[]): string {
  const shown = terms.slice(0, 3).join(', ')
  return `Nothing in the archive matched ${shown ? `“${shown}”` : 'that search'}. Try one of the suggested topics, or browse the collections.`
}

/**
 * Suggestions are derived from the themes that actually have published items,
 * so a suggested question can never point at material the archive does not hold.
 */
export async function GET() {
  const fallback = ASK_SUGGESTIONS.slice(0, 3)
  try {
    const grouped = await prisma.archiveItem.groupBy({
      by: ['theme'],
      where: { status: 'published', NOT: { theme: null } },
      _count: { _all: true },
      orderBy: { _count: { theme: 'desc' } },
      take: 3,
    })

    const questions = grouped
      .map(row => row.theme)
      .filter((theme): theme is string => Boolean(theme))
      .map(theme => `What has the archive on “${theme}”?`)

    return NextResponse.json({ suggested: questions.length > 0 ? questions : fallback })
  } catch {
    return NextResponse.json({ suggested: fallback })
  }
}

export async function POST(request: NextRequest) {
  let body: { question?: string; messages?: { role?: string; content?: string }[] } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Prefer the explicit `question`; fall back to the last user turn for older clients.
  const raw =
    typeof body.question === 'string'
      ? body.question
      : [...(body.messages || [])].reverse().find(m => m.role === 'user')?.content || ''

  const terms = queryTerms(raw.slice(0, 500))

  const empty = (summary: string): AskResult => ({
    summary,
    terms,
    match: 'none',
    citations: [],
    timeline: [],
    testimonials: [],
    suggested: ASK_SUGGESTIONS,
  })

  if (terms.length === 0) {
    return NextResponse.json(
      empty('Ask me about a speech, a letter, a theme or a period of the Speaker’s career — for example “parliamentary independence” or “education and the youth”.'),
    )
  }

  // Pass 1 requires every term; pass 2 relaxes to any term so a broad question
  // still returns the closest material instead of a dead end.
  let mode: AskMatchMode = 'all'
  let docs = await prisma.archiveItem.findMany({
    where: buildWhere(DOC_FIELDS, terms, 'all'),
    orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
    take: DOC_TAKE,
  })

  if (docs.length === 0 && terms.length > 1) {
    mode = 'any'
    docs = await prisma.archiveItem.findMany({
      where: buildWhere(DOC_FIELDS, terms, 'any'),
      orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
      take: DOC_TAKE,
    })
  }

  if (docs.length === 0) {
    return NextResponse.json(empty(noMatchSummary(terms)))
  }

  const [testimonials, milestones] = await Promise.all([
    prisma.testimonial.findMany({
      where: buildWhere(TESTIMONIAL_FIELDS, terms, 'any'),
      orderBy: [{ sortOrder: 'asc' }, { year: 'desc' }],
      take: 2,
    }),
    prisma.milestone.findMany({
      where: buildWhere(MILESTONE_FIELDS, terms, 'any'),
      orderBy: [{ year: 'asc' }],
      take: 3,
    }),
  ])

  const citations: AskCitation[] = docs.map(d => ({
    kind: d.kind,
    kindLabel: KIND_CONFIG[d.kind as ArchiveKind]?.label || d.kind,
    title: d.title,
    href: `/archives/${archiveRouteForKind(d.kind)}/${d.slug}`,
    year: d.year,
    excerpt: snippet(d.excerpt || d.body || d.title, 150),
    hasTranscript: Boolean(d.body),
  }))

  const n = citations.length
  const summary =
    mode === 'all'
      ? `The archive holds ${n} item${n === 1 ? '' : 's'} matching every term in your question.`
      : `No single item covers every term, but ${n} item${n === 1 ? '' : 's'} in the archive match${n === 1 ? 'es' : ''} at least one.`

  const result: AskResult = {
    summary,
    terms,
    match: mode,
    citations,
    timeline: milestones.map(m => ({ year: m.year, title: m.title })),
    testimonials: testimonials.map(t => ({
      quote: snippet(t.quote, 160),
      author: t.author,
      role: t.role,
    })),
    suggested: ASK_SUGGESTIONS,
  }

  return NextResponse.json(result)
}
